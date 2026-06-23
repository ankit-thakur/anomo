import json
import boto3
import os
from bs4 import BeautifulSoup
import re
import requests
import time
from invoke_model import invoke_model_from_analyze_menu

bedrock = boto3.client("bedrock-runtime")

CLAUDE_SONNET_4 = os.environ.get("CLAUDE_SONNET_4", "us.anthropic.claude-sonnet-4-5-20251001-v1:0")

def extract_dishes(html_text: str):    

    # STEP 1: Preprocess HTML
    clean_text_blocks = preprocess_html(html_text)

    # STEP 2: Chunk into candidate dish-like segments
    dish_candidates = find_dish_candidates(clean_text_blocks)

    # STEP 3: LLM Extraction per chunk
    dishes = []
    for block in dish_candidates:
        extracted = extract_dish_with_llm(block)
        if extracted:
            dishes.extend(extracted)

    return dishes

# -------------------------------
# Preprocessing
# -------------------------------

def clean_menu(menu_html):
    
    pattern = re.compile(r'[\n\t]|<(script|style|head|footer)[^>]*>.*?</\1>', re.DOTALL)
    new_html = re.sub(pattern, '', menu_html)
    
    pattern = re.compile(r'<.*?>')
    new_html = re.sub(pattern, '', new_html)
    
    # print(new_html)
    return new_html


SECTION_KEYWORDS = [
    "appetizers", "starters", "soups", "salads",
    "entrees", "mains", "pasta", "pizza",
    "sides", "desserts", "drinks", "beverages"
]

def preprocess_html(html: str):
    """Convert messy HTML into section-level blocks for LLM parsing."""
    soup = BeautifulSoup(html, "html.parser")

    # remove junk
    for tag in soup(["script", "style", "noscript"]):
        tag.extract()

    # normalize breaks
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for p in soup.find_all("p"):
        p.insert_before("\n")
    for li in soup.find_all("li"):
        li.insert_before("\n")

    # collapse into lines
    text_blob = soup.get_text(separator="\n")
    lines = [line.strip() for line in text_blob.split("\n") if line.strip()]

    # group into section blocks
    return group_into_sections(lines)


def group_into_sections(lines):
    """Group lines into larger section blocks, ignoring name/price order."""
    blocks = []
    current_block = []

    def is_section_header(line: str) -> bool:
        return any(k in line.lower() for k in SECTION_KEYWORDS)

    for line in lines:
        # if this line is a section header, flush current block
        if is_section_header(line) and current_block:
            blocks.append(" ".join(current_block))
            current_block = []

        current_block.append(line)

    # flush remainder
    if current_block:
        blocks.append(" ".join(current_block))

    return blocks


# -------------------------------
# Candidate Finder
# -------------------------------

def find_dish_candidates(text_blocks):
    candidates = []
    price_pattern = re.compile(r"\$?\d+(\.\d{2})?")
    for block in text_blocks:
        # Look for prices OR food-like words
        if price_pattern.search(block) or looks_foody(block):
            candidates.append(block)
    return candidates

def looks_foody(text: str) -> bool:
    food_keywords = ["appetizers", "entree", "dessert", "pizza", "salad", "burger", "pasta", "chicken", "beef", "soup"]
    return any(word in text.lower() for word in food_keywords)

# -------------------------------
# LLM Extraction
# -------------------------------

def extract_dish_with_llm(block: str):
    system_prompt = """You are a menu parsing assistant.
Given a text snippet from a restaurant menu, extract dish information.
Always return a strict JSON array of objects like:
[{"name": "...", "price": 12.99, "description": "..."}]

If no dish is found, return [].
"""

    try:
        
        print("*** Invoking model...")
        response = invoke_model_from_analyze_menu(system_prompt, block, True, CLAUDE_SONNET_4, 10000)
        print("*** Model complete")

        # response = bedrock.invoke_model(**payload)
        response_body = json.loads(response[0])
        # text_output = response_body["output"]["content"][0]["text"]

        # Parse the LLM JSON safely
        # extracted = json.loads(text_output)
        return response_body
    except Exception as e:
        print("LLM extraction failed:", e)
        return []

    