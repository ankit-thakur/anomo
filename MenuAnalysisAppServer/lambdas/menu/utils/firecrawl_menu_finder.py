"""
Firecrawl-based menu URL finder.

Uses the Firecrawl /v2/map endpoint to retrieve every URL on a restaurant's
website in one API call, then scores them to surface the most likely menu link.

Primary entry point:
    find_menu_urls(website_url, preferred_meal="dinner")
    -> list of (url, score) tuples, sorted best-first

This is a parallel alternative to crawl_for_menu() in extract_links.py.
It handles JS-rendered sites and uses the sitemap when available, so it
discovers links that requests.get() would miss entirely.
"""

import os
import re
import requests

FIRECRAWL_MAP_URL = "https://api.firecrawl.dev/v2/map"

# Signals that a URL is (or isn't) a menu page
_MEAL_KEYWORDS   = {"dinner", "lunch", "brunch", "breakfast"}
_MENU_KEYWORDS   = {"menu", "food", "dining", "specials", "dine", "eat", "drink", "wine", "drinks"}
_PENALTY_WORDS   = {"contact", "about", "press", "career", "gift", "reserve",
                    "reservation", "event", "blog", "faq", "privacy", "terms", "order",
                    "catering"}


def find_menu_urls(website_url: str, preferred_meal: str = "dinner") -> list[tuple[str, int]]:
    """
    Return a ranked list of (url, score) tuples for the given restaurant site.
    The highest-scoring URL is most likely to be the target meal's menu page.

    Args:
        website_url:    Root URL of the restaurant website.
        preferred_meal: Meal type to prioritise ("dinner", "lunch", "brunch", etc.).

    Returns:
        List of (url, score) sorted by score descending. Empty list on failure.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        raise EnvironmentError("FIRECRAWL_API_KEY not set")

    url_items = _map_site(website_url, api_key)
    if not url_items:
        print(f"[firecrawl_menu_finder] No URLs returned for {website_url}")
        return []

    print(f"[firecrawl_menu_finder] Mapped {len(url_items)} URLs from {website_url}")
    ranked = _score_urls(url_items, preferred_meal.lower())
    return ranked


def _map_site(website_url: str, api_key: str) -> list[str]:
    """Call /v2/map and return the list of discovered URLs."""
    payload = {
        "url": website_url,
        "limit": 5000,
        "includeSubdomains": False,
        "sitemap": "include",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(FIRECRAWL_MAP_URL, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # Response shape: {"success": true, "links": [{"url": "...", "title": "...", "description": "..."}, ...]}
        raw = data.get("links", [])
        # Normalise: each item may be a dict or a plain string
        urls = []
        for item in raw:
            if isinstance(item, dict):
                urls.append({
                    "url":         item.get("url", ""),
                    "title":       item.get("title", ""),
                    "description": item.get("description", ""),
                })
            else:
                urls.append({"url": str(item), "title": "", "description": ""})
        return urls
    except requests.RequestException as e:
        print(f"[firecrawl_menu_finder] Map request failed: {e}")
        return []


def _score_urls(urls: list[dict], preferred_meal: str) -> list[tuple[str, int]]:
    """
    Score each URL dict by likelihood of being a menu page for preferred_meal.
    Scores against the URL path, page title, and meta description so that
    JS-rendered site titles (e.g. "Dinner Menu | Chama Mama") count even when
    the URL itself is generic.
    """
    scored = []
    for item in urls:
        url   = item["url"]
        # Combine all text signals; URL path matters most so weight it twice
        haystack = f"{url} {url} {item['title']} {item['description']}".lower()
        score = 0

        # PDF menus are the strongest signal
        if url.lower().endswith(".pdf"):
            score += 3

        # "menu" anywhere in the combined text
        if "menu" in haystack:
            score += 3

        # Preferred meal in the URL path specifically (strongest combo)
        if preferred_meal in url.lower():
            score += 4
        elif preferred_meal in haystack:
            # Title/description match is weaker than a URL path match
            score += 2

        # Other meal types in URL — weaker
        for meal in _MEAL_KEYWORDS - {preferred_meal}:
            if meal in url.lower():
                score += 1

        # General food/drink keywords in any field
        for kw in _MENU_KEYWORDS - {"menu"}:
            if kw in haystack:
                score += 1

        # Penalise clearly non-menu pages (URL path only — title can mention these innocently)
        for word in _PENALTY_WORDS:
            if word in url.lower():
                score -= 2

        if score > 0:
            scored.append((url, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.chamamama.com/"
    meal = sys.argv[2] if len(sys.argv) > 2 else "dinner"

    print(f"Finding {meal} menu URL for: {url}\n")
    results = find_menu_urls(url, preferred_meal=meal)

    if not results:
        print("No menu URLs found.")
    else:
        print(f"Top results ({len(results)} total):")
        for link, score in results[:10]:
            print(f"  [{score:+d}]  {link}")
