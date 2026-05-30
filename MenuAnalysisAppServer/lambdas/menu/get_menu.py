from botocore.exceptions import ClientError
import requests
import json
import sys
import os
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, '/opt/python/lib/python3.12/site-packages')
import importlib.metadata
import boto3
import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from invoke_model import invoke_model, invoke_model_1, invoke_model_from_get_menu
from extract_links import crawl_for_menu
from utils.firecrawl_menu_finder import find_menu_urls
import pdfplumber
from io import BytesIO
import time

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

CLAUDE_HAIKU_3 = 'anthropic.claude-3-haiku-20240307-v1:0'
# CLAUDE_HAIKU_3_5 = 'us.anthropic.claude-3-5-haiku-20241022-v1:0'


def get_menu_handler(event, context):
    
    print("*** Get Menu Handler ***")
    print("* event: ", event)
    print("* context: ", context)

    body_json = json.loads(event['body'])
    website = body_json['website']
    
    response = get_menu(website)
    
    return response


def get_menu(url):

    ##### 1. Extract potential menu links #####
    # Set USE_FIRECRAWL_MAP=true to use Firecrawl /map (JS-aware, sitemap-backed).
    # Leave unset to use the original crawl_for_menu (requests + BeautifulSoup).
    USE_FIRECRAWL_MAP = True
    # USE_FIRECRAWL_MAP = False
    if USE_FIRECRAWL_MAP:
        print("[get_menu] Using Firecrawl map for URL discovery")
        menu_links = find_menu_urls(url)
    else:
        menu_links = crawl_for_menu(url)
    print("Candidate menu links:", menu_links)
    
    HEADERS = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }

    def _validate_candidate(link_score):
        link, score = link_score
        content = is_pdf(link) if link.endswith('.pdf') else is_html(link)
        response = is_menu(content)
        is_valid = bool(response and response.get('is_menu'))
        return link, score, is_valid

    candidates = menu_links[:3]
    with ThreadPoolExecutor(max_workers=len(candidates) or 1) as executor:
        validation_results = list(executor.map(_validate_candidate, candidates))

    found = [
        {'url': link, 'confidence': round(float(score), 3) if score else 1}
        for link, score, is_valid in validation_results
        if is_valid
    ]

    if found:
        print(f"Found {len(found)} menu link(s):", [f['url'] for f in found])
        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps({
                'is_menu': True,
                'link': found[0]['url'],   # backward compat
                'links': found,
            })
        }

    print("Could not find menu link.")
    return {
        'statusCode': 500,
        'headers': HEADERS,
        'body': {}
    }

def is_pdf(pdf_link):
    print("Processing PDF Link")
    
     # --- measure download time ---
    t0 = time.time()
    response_content_bytes = requests.get(pdf_link).content      
    t1 = time.time()
    print(f"Downloaded PDF in {t1 - t0:.2f} seconds, size={len(response_content_bytes)/1024:.1f} KB")

    menu_html_pre_clean = ""
    t2 = time.time()
    with pdfplumber.open(BytesIO(response_content_bytes)) as pdf:
        print(f"PDF has {len(pdf.pages)} pages")
        for i, page in enumerate(pdf.pages):
            p_start = time.time()
            text = page.extract_text()
            menu_html_pre_clean += text or ""
            print(f"Parsed page {i+1} in {time.time() - p_start:.2f} seconds")
    t3 = time.time()

    print(f"Total parsing time = {t3 - t2:.2f} seconds")
    print(f"Total end-to-end time = {t3 - t0:.2f} seconds")
    
    return menu_html_pre_clean


def is_html(html_link):
    html = get_html(html_link)
    return clean_menu(html)
    
    
def is_menu(input_content):
    print("Confirming is restaurant menu.")
    
    prompt = f"""
        Given the provided pre-processed HTML content, determine if it represents a restaurant menu. Use the following detailed criteria:
        Criteria for Recognizing a Menu:
            - Look for menu-related keywords such as "menu," "appetizers," "main course," "entrees," "desserts," "beverages," "specials," "dishes," or similar terms.
            - Check for pricing information typically associated with food items (e.g., "$9.99," "€12," or similar patterns).
            - Identify dish names and descriptions, which often appear as lists or tables (e.g., "Grilled Salmon: A perfectly grilled filet served with seasonal vegetables").
            - Look for menu-specific formatting:
                - Structured lists or grids of food items with prices.
                - Sections for categories (e.g., "Starters," "Entrees," "Desserts").
                - Limited number of links (menus often focus on displaying dishes, not navigation).
        Criteria for Non-Menus:
            - If the content primarily contains unrelated information, such as events, contact details, or general descriptions of the restaurant, it is not a menu.
            - A page with many unrelated links (e.g., "Contact Us," "About," "Reservations") is unlikely to be a menu.
            - A lack of pricing, structured dish descriptions, or food related keywords suggests it is not a menu.        
        
        Your output should follow this exact structure in JSON format with no additional text outside the JSON:
            1. Status indicator:
                - "is_menu": true - if the content strongly appears to be a restaurant's menu.
                - "is_menu": false - if the content does NOT appear to be a restaurant's menu.
            2. Reasoning: Provide a brief, 1 sentence explanation of your decision.
        
        Example Response 1: This IS the Menu
            {{
                "is_menu": true,
                "reasoning": "The content contains menu-related keywords such as 'appetizers,' 'desserts,' and pricing for dishes."
            }}
                
        Example Response 2: This is NOT the Menu
            {{
                "is_menu": false,
                "reasoning": "The content does not include menu-related keywords or pricing. It seems to be a generic webpage."
            }}

        Important Notes:
            - Focus on accuracy and clarity in your decision-making and explanations.
            - Ensure the output format strictly adheres to the example structure, and avoid any additional commentary or text outside the JSON.
    """
            
    
    # Expected Output Options:
    # 1. If the content appears to be a restaurant's menu:
    #     - Explain briefly why you believe this is the case (e.g., specific keywords, dish descriptions, or pricing patterns found).
    #     - Return an empty list wrapped within <response> tags like this: <response>[]</response>
    # 2. If the content does NOT appear to be a restaurant's menu:
    #     - Explain your reasoning (e.g., absence of menu-related keywords or content unrelated to food).
    #     - Extract and list all relevant links (e.g., <a> tags, href attributes, or files like .jpg, .png, .pdf that may lead to a menu or further analysis).
    #     - Sort the links from most likely to least likely to lead to the restaurant's menu, prioritizing links with menu-related keywords.
    #     - If the link is a partial URL (e.g., /menu), append the current base URL to form a complete URL.
    #     - Provide the list of links within <response> tags like this:
    #         <response>[https://website1.com/menu, https://website2.com/image.jpg, ...]</response>
    
    
    # prompt = f"""Given the following pre-processed HTML content, determine if this content appears to be of the menu 
    # of a restaurant. To help you determine this, look for menu or food item related keywords, pricing, dish 
    # names, or dish descriptions.
    # <content>{ cleaned_html }</content>
    
    # If you are confident that this content strongly portrays the menu of a restaurant, then provide a brief explanation 
    # as to why you think so, followed by an empty list within <response> tags like so: <response>[]</response>
        
    # If you believe this is not the menu of a restaurant, explain your reasoning and provide a list of all links, images, or other 
    # files that this HTML contains. Provide this list in order of most likely to lead to the restaurant's menu 
    # to least likely. To help you identify these, look for <a> tags, href elements, keywords, and file extensions 
    # like .jpg, .png, .pdf, etc. If the link is a partial href, then append the current link to it such that it 
    # forms a full URL. This will be used to perform further analysis to try to find the menu of the restaurant. 
    # Provide your list within <response> tags like so:
    # <response>[https://website1.com, https://website2.com, ...]</response>
    # """
    
    content = f"<content>{ input_content }</content>"
    
    print("Invoking model to determine if menu...")
    response_1 = invoke_model_from_get_menu(prompt, content, True, CLAUDE_HAIKU_3, 10000)[0]
    print("** response_1: ", response_1)
    processed_response = process_response(response_1)
    
    return processed_response


def is_menu_image(image):
    print("Confirming if image " + image + " is of restaurant menu.")
    return "image link not implemented yet"
    
    
def get_html(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/115.0 Safari/537.36"
    }
    # Extract the fragment (#food-section) before requests strips it.
    # HTTP requests never include the fragment — we must handle it after fetching.
    parsed  = urlparse(url)
    fragment = parsed.fragment  # empty string if no fragment

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    html = response.text

    if fragment:
        soup    = BeautifulSoup(html, "html.parser")
        section = soup.find(id=fragment)
        if section:
            print(f"[get_html] Fragment #{fragment} resolved — returning subtree ({len(str(section))} chars).")
            return str(section)
        print(f"[get_html] Fragment #{fragment} not found as element id — returning full page.")

    return html


def clean_menu(menu_html):
    print("* pre-clean: ", len(menu_html))
    pattern = re.compile(r'<(script|style|head|footer)[^>]*>.*?</\1>', re.DOTALL)
    new_html = re.sub(pattern, '', menu_html)
    print("* post-clean: ", len(new_html))
    return new_html


def get_link_type(prev_url, link):
    # Check if the input is a full URL
    url_pattern = re.compile(r'^(https?://|www\.)[^\s/$.?#].[^\s]*$', re.IGNORECASE)
    if url_pattern.match(link):
        if link.lower().endswith('.pdf'):
            return [link, "PDF"]
        elif re.search(r'\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)$', link, re.IGNORECASE):
            return [link, "Image"]
        return [link, "URL"]
    
    # Check if the input is a parameter surrounded by '/' or starts with '/', append prev url to make a full link
    if re.fullmatch(r'/[^/]+/|/[^/]+', link):
        return [prev_url + link, "URL"]
    
    # Check for standalone PDF or image file
    if re.fullmatch(r'.+\.pdf', link, re.IGNORECASE):
        return "PDF link"
    if re.fullmatch(r'.+\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)', link, re.IGNORECASE):
        return "Image link"
    
    return ["", "Unknown"]


def process_response(response):
    # Regex to capture everything between { ... } including braces
    match = re.search(r"\{[\s\S]*\}", response)

    if match:
        print(match.group(0))
        return json.loads(match.group(0))
    else:
        print("No JSON object found in the response.")
        return None


    
if __name__ == "__main__":
    print("Starting get_menu test...")
    get_menu({'queryStringParameters': {
        'name': 'The Maharaja',
        'formatted_address': '57 JFK Street, Cambridge, MA 02138',
        'website': 'https://maharajaboston.com/',
        'id': 'restaurant-123',
        'connectionKey': 'connection-key-123'
    }}, None)
    print("Ending get_menu test...")
    