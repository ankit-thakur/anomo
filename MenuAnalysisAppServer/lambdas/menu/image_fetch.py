"""
ImageFetch Lambda — triggered by DDB Stream INSERT events on RestaurantTable.

Flow per new restaurant:
  1.  Download up to 10 Google Places photos → upload to S3 {restaurantId}/places/{n}.jpg
  2.  Poll MenuItemsTable until dishes appear (max 30 s)
  3.  Scrape restaurant website for images (if menuUrl set) → upload to S3 {restaurantId}/web/{n}.jpg
  4.  Single Vision call across ALL images (Places + web, labelled by source):
        - classify each photo (is_food? which dish from the menu?)
        - pick the single best hero image across both sources
  5.  Write heroImage + images (Places gallery) to RestaurantTable
  6.  Write imageUrl to matched dishes in MenuItemsTable
  
{                                                                                                                                                                    
    "Records": [                                                                                                                                                       
        {                                                                                                                                                                
            "eventName": "INSERT",                                                                                                                                         
            "dynamodb": {                                                                                                                                                  
                "NewImage": {                                                                                                                                                
                "restaurantId": { "S": "ChIJGfdZtJdbwokREUPcjASYSr4" },
                "menuUrl":      { "S": "https://www.glinthaibistro.com/brooklyn-fort-greene-glin-thai-bistro-food-menu#content" }
                }
            }
        }
    ]
}

"""

import base64
import json
import os
import re
import time

import boto3
from boto3.dynamodb.conditions import Key
import requests

GOOGLE_API_KEY    = os.environ['GOOGLE_API_KEY']
IMAGES_BUCKET     = os.environ['IMAGES_BUCKET']
CLOUDFRONT_URL    = os.environ.get('CLOUDFRONT_URL', '')
CLAUDE_MODEL      = os.environ.get('CLAUDE_HAIKU', 'us.anthropic.claude-haiku-4-5-20251001-v1:0')
RESTAURANT_TABLE  = os.environ.get('RESTAURANT_TABLE', 'DdbStack-RestaurantTableBDE2029A-1QA3XQE9B836T')
MENU_ITEMS_TABLE  = os.environ.get('MENU_ITEMS_TABLE', 'DdbStack-MenuItemsTableBDB50838-124BTKBL895OK')
FIRECRAWL_API_KEY = os.environ.get('FIRECRAWL_API_KEY', '')

FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape'

dynamodb = boto3.resource('dynamodb')
s3       = boto3.client('s3')
bedrock  = boto3.client('bedrock-runtime', region_name='us-east-1')

PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json'
PLACES_PHOTO_URL   = 'https://maps.googleapis.com/maps/api/place/photo'

MAX_PLACES_PHOTOS = 10
MAX_WEB_IMAGES    = 10   # keeps combined total ≤ 20 for Vision API
MIN_IMAGE_BYTES   = 5_000
POLL_ATTEMPTS     = 6
POLL_DELAY_SECS   = 5


def _norm_name(s: str) -> str:
    """Collapse a dish name to lowercase alphanumeric for fuzzy alt-text matching."""
    return re.sub(r'[^a-z0-9]', '', s.lower())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    for record in event.get('Records', []):
        if record.get('eventName') != 'INSERT':
            continue
        new_image     = record['dynamodb'].get('NewImage', {})
        restaurant_id = new_image.get('restaurantId', {}).get('S')
        menu_url      = new_image.get('menuUrl', {}).get('S', '')
        if not restaurant_id:
            continue
        try:
            _process_restaurant(restaurant_id, menu_url)
        except Exception as exc:
            print(f'[ImageFetch] Fatal error for {restaurant_id}: {exc}')
            raise


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------

def _process_restaurant(restaurant_id: str, menu_url: str):
    print(f'[ImageFetch] Processing: {restaurant_id}  menu_url={menu_url or "(none)"}')

    # 1. Download all Google Places photos
    places_pairs = _download_places_photos(restaurant_id)

    # 2. Poll for dishes (do this while scraping so the wait overlaps)
    dishes        = _poll_for_dishes(restaurant_id)
    dish_names    = [d['name'] for d in dishes if d.get('name')]
    dish_name_set = set(dish_names)

    # 3. Scrape restaurant website
    web_pairs = _scrape_website_images(menu_url, restaurant_id) if menu_url else []

    # 4. Single Vision call across all images
    all_pairs = places_pairs + web_pairs        # [(bytes, url, alt), ...]
    n_places  = len(places_pairs)

    hero_url:    str | None     = all_pairs[0][1] if all_pairs else None
    dish_to_url: dict[str, str] = {}

    if all_pairs and dish_names:
        all_bytes = [b for b, _, _ in all_pairs]
        all_urls  = [u for _, u, _ in all_pairs]
        all_alts  = [a for _, _, a in all_pairs]

        # Pre-match: web images whose alt text directly names a dish (no Vision needed)
        dish_norm_map = {_norm_name(n): n for n in dish_names}
        for url, alt in zip(all_urls, all_alts):
            if not alt:
                continue
            canonical = dish_norm_map.get(_norm_name(alt))
            if canonical and canonical not in dish_to_url:
                dish_to_url[canonical] = url

        result = _classify_photos(all_bytes, dish_names, n_places, all_alts)

        hero_idx = result.get('hero_index')
        if hero_idx is not None and 0 <= hero_idx < len(all_urls):
            hero_url = all_urls[hero_idx]

        for match in result.get('photos', []):
            idx  = match.get('photo_index')
            dish = match.get('dish')
            if (
                match.get('is_food')
                and dish
                and dish in dish_name_set
                and isinstance(idx, int)
                and 0 <= idx < len(all_urls)
                and dish not in dish_to_url   # first confident match wins
            ):
                dish_to_url[dish] = all_urls[idx]

    # 5. Write heroImage + Places gallery to RestaurantTable
    places_urls = [u for _, u, _ in places_pairs]
    _update_restaurant_images(restaurant_id, hero_url, places_urls)

    # 6. Write imageUrl to matched dishes
    for dish_name, url in dish_to_url.items():
        _update_dish_image(restaurant_id, dish_name, url)

    print(
        f'[ImageFetch] Done — {n_places} Places photos, {len(web_pairs)} web images, '
        f'{len(dish_to_url)}/{len(dish_names)} dishes matched'
    )


# ---------------------------------------------------------------------------
# Google Places
# ---------------------------------------------------------------------------

def _download_places_photos(restaurant_id: str) -> list[tuple[bytes, str, str]]:
    try:
        resp = requests.get(
            PLACES_DETAILS_URL,
            params={'place_id': restaurant_id, 'fields': 'photos', 'key': GOOGLE_API_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        photo_refs = [
            p['photo_reference']
            for p in resp.json().get('result', {}).get('photos', [])
            if 'photo_reference' in p
        ]
    except Exception as exc:
        print(f'[ImageFetch] Places Details call failed: {exc}')
        return []

    results: list[tuple[bytes, str, str]] = []
    for i, ref in enumerate(photo_refs[:MAX_PLACES_PHOTOS]):
        try:
            img_resp = requests.get(
                PLACES_PHOTO_URL,
                params={'maxwidth': 800, 'photo_reference': ref, 'key': GOOGLE_API_KEY},
                timeout=15,
                allow_redirects=True,
            )
            img_resp.raise_for_status()
            img_bytes = img_resp.content
            s3_key    = f'{restaurant_id}/places/{i}.jpg'
            _upload_to_s3(s3_key, img_bytes)
            results.append((img_bytes, _cdn_url(s3_key), ''))
            print(f'[ImageFetch] Places photo {i} uploaded')
        except Exception as exc:
            print(f'[ImageFetch] Places photo {i} failed (skipping): {exc}')

    return results


# ---------------------------------------------------------------------------
# Website scraping via Firecrawl
# ---------------------------------------------------------------------------

def _scrape_website_images(menu_url: str, restaurant_id: str) -> list[tuple[bytes, str, str]]:
    """
    Scrape the restaurant's menu page using Firecrawl.

    Firecrawl fully renders JS before returning, so image galleries and
    lazy-loaded food photos that requests+BeautifulSoup would miss are
    captured here. Image URLs are extracted from the markdown output
    (![alt](url) references) and then downloaded individually.
    """
    if not FIRECRAWL_API_KEY:
        print('[ImageFetch] FIRECRAWL_API_KEY not set — skipping web image scrape')
        return []

    # Ask Firecrawl to render the page and return clean markdown
    try:
        resp = requests.post(
            FIRECRAWL_SCRAPE_URL,
            json={'url': menu_url, 'formats': ['markdown']},
            headers={
                'Authorization': f'Bearer {FIRECRAWL_API_KEY}',
                'Content-Type':  'application/json',
            },
            timeout=45,
        )
        resp.raise_for_status()
        payload  = resp.json()
        # Handle both v1 shape {"markdown": "..."} and v2 shape {"data": {"markdown": "..."}}
        markdown = (
            payload.get('markdown')
            or (payload.get('data') or {}).get('markdown')
            or ''
        )
    except Exception as exc:
        print(f'[ImageFetch] Firecrawl scrape failed ({menu_url}): {exc}')
        return []

    if not markdown:
        print(f'[ImageFetch] Firecrawl returned empty markdown for {menu_url}')
        return []

    # Extract alt text and URLs from markdown image syntax: ![alt](url)
    raw_entries = re.findall(r'!\[([^\]]*)\]\((https?://[^)\s]+)\)', markdown)

    # Deduplicate on URL while preserving order; keep first alt text seen
    seen: set[str] = set()
    img_srcs: list[tuple[str, str]] = []  # (alt, url)
    for alt, url in raw_entries:
        if url not in seen:
            seen.add(url)
            img_srcs.append((alt.strip(), url))

    print(f'[ImageFetch] Firecrawl found {len(img_srcs)} unique image URLs')

    results: list[tuple[bytes, str, str]] = []
    idx = 0
    for alt, src in img_srcs:
        if idx >= MAX_WEB_IMAGES:
            break
        try:
            img_resp = requests.get(src, timeout=10, allow_redirects=True)
            img_resp.raise_for_status()
            if 'image' not in img_resp.headers.get('content-type', ''):
                continue
            img_bytes = img_resp.content
            if len(img_bytes) < MIN_IMAGE_BYTES:
                continue
            s3_key = f'{restaurant_id}/web/{idx}.jpg'
            _upload_to_s3(s3_key, img_bytes)
            results.append((img_bytes, _cdn_url(s3_key), alt))
            idx += 1
            print(f'[ImageFetch] Web image {idx - 1} uploaded ({src[:80]})')
        except Exception as exc:
            print(f'[ImageFetch] Web image download failed ({src[:80]}): {exc}')

    print(f'[ImageFetch] Firecrawl web scrape: {len(results)} usable images from {menu_url}')
    return results


# ---------------------------------------------------------------------------
# Claude Vision — single call across all images
# ---------------------------------------------------------------------------

def _detect_media_type(img_bytes: bytes) -> str:
    if img_bytes[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if img_bytes[:4] == b'\x89PNG':
        return 'image/png'
    if img_bytes[:4] == b'RIFF' and img_bytes[8:12] == b'WEBP':
        return 'image/webp'
    if img_bytes[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'
    return 'image/jpeg'


def _classify_photos(
    all_photo_bytes: list[bytes],
    dish_names: list[str],
    n_places: int,
    all_alts: list[str] | None = None,
) -> dict:
    """
    Classify all photos (Google Places + website) in one Vision call.

    Photos 0 .. n_places-1        → labelled 'Places Photo N'
    Photos n_places .. len-1      → labelled 'Website Photo N'

    Returns:
      {
        "hero_index": int | null,
        "photos": [{"photo_index": int, "is_food": bool, "dish": str | null}, ...]
      }
    """
    n_web         = len(all_photo_bytes) - n_places
    dish_list_str = '\n'.join(f'- {name}' for name in dish_names)

    source_note = f'Photos 0–{n_places - 1} are from Google Places.'
    if n_web > 0:
        source_note += (
            f' Photos {n_places}–{len(all_photo_bytes) - 1} are '
            "scraped from the restaurant's own website."
        )

    alts    = all_alts or [''] * len(all_photo_bytes)
    content = []
    for i, img_bytes in enumerate(all_photo_bytes):
        label = f'Places Photo {i}' if i < n_places else f'Website Photo {i}'
        if alts[i]:
            label = f'{label}: "{alts[i]}"'
        content.append({
            'type': 'image',
            'source': {
                'type':       'base64',
                'media_type': _detect_media_type(img_bytes),
                'data':       base64.b64encode(img_bytes).decode(),
            },
        })
        content.append({'type': 'text', 'text': f'[{label}]'})

    content.append({
        'type': 'text',
        'text': (
            f'{source_note}\n\n'
            f'The restaurant menu contains these dishes:\n{dish_list_str}\n\n'
            'For each photo determine:\n'
            '  - "is_food": true if the photo shows a specific food item or dish\n'
            '  - "dish": if is_food is true, the exact dish name from the list that it '
            "most closely matches, or null if it doesn't clearly match any listed dish\n"
            '  - "hero_index": the index of the single best photo to represent this '
            'restaurant on a card thumbnail — consider all sources and choose the most '
            'visually appealing (food, ambiance, or exterior). null if none are suitable.\n\n'
            'Return ONLY valid JSON in this exact shape — no explanation, no markdown:\n'
            '{\n'
            '  "hero_index": 0,\n'
            '  "photos": [\n'
            '    {"photo_index": 0, "is_food": true,  "dish": "Exact Dish Name"},\n'
            '    {"photo_index": 1, "is_food": false, "dish": null},\n'
            '    ...\n'
            '  ]\n'
            '}'
        ),
    })

    raw = json.loads(
        bedrock.invoke_model(
            modelId=CLAUDE_MODEL,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 4096,
                'messages': [{'role': 'user', 'content': content}],
            }),
        )['body'].read()
    )['content'][0]['text'].strip()

    if raw.startswith('```'):
        parts = raw.split('```')
        raw   = parts[1].lstrip('json').strip() if len(parts) > 1 else raw

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f'[ImageFetch] Vision JSON parse error: {exc}\nRaw: {raw[:500]}')
        return {'hero_index': None, 'photos': []}


# ---------------------------------------------------------------------------
# DynamoDB helpers
# ---------------------------------------------------------------------------

def _update_restaurant_images(restaurant_id: str, hero_url: str | None, gallery_urls: list[str]):
    expr      = 'SET images = :imgs'
    attr_vals: dict = {':imgs': gallery_urls}
    if hero_url:
        expr += ', heroImage = :hero'
        attr_vals[':hero'] = hero_url
    dynamodb.Table(RESTAURANT_TABLE).update_item(
        Key={'restaurantId': restaurant_id},
        UpdateExpression=expr,
        ExpressionAttributeValues=attr_vals,
    )
    print(f'[ImageFetch] RestaurantTable.heroImage={hero_url}  images={len(gallery_urls)}')


def _poll_for_dishes(restaurant_id: str) -> list[dict]:
    table = dynamodb.Table(MENU_ITEMS_TABLE)
    for attempt in range(POLL_ATTEMPTS):
        items = table.query(
            KeyConditionExpression=Key('restaurantId').eq(restaurant_id)
        ).get('Items', [])
        if items:
            print(f'[ImageFetch] Found {len(items)} dishes (attempt {attempt + 1})')
            return items
        print(f'[ImageFetch] Dishes not ready ({attempt + 1}/{POLL_ATTEMPTS}), waiting {POLL_DELAY_SECS}s')
        time.sleep(POLL_DELAY_SECS)
    return []


def _update_dish_image(restaurant_id: str, dish_name: str, image_url: str):
    dynamodb.Table(MENU_ITEMS_TABLE).update_item(
        Key={'restaurantId': restaurant_id, 'name': dish_name},
        UpdateExpression='SET imageUrl = :url',
        ExpressionAttributeValues={':url': image_url},
    )
    print(f"[ImageFetch] imageUrl → '{dish_name}'")


# ---------------------------------------------------------------------------
# S3 / URL helpers
# ---------------------------------------------------------------------------

def _upload_to_s3(s3_key: str, img_bytes: bytes):
    s3.put_object(
        Bucket=IMAGES_BUCKET,
        Key=s3_key,
        Body=img_bytes,
        ContentType='image/jpeg',
    )


def _cdn_url(s3_key: str) -> str:
    if CLOUDFRONT_URL:
        return f'https://{CLOUDFRONT_URL}/{s3_key}'
    return f'https://{IMAGES_BUCKET}.s3.amazonaws.com/{s3_key}'
