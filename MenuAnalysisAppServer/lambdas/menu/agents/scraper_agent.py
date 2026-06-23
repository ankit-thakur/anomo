"""
Scraper Agent — Phase 1 of the agentic menu analysis pipeline.

Responsibilities:
  - Fetch and clean the menu HTML (or extract text from a PDF menu)
  - Extract dish names, prices, and descriptions via LLM

Input  (from Step Functions): {menu_url, place_id, name, address, email, addToList}
Output (to Allergen Agent):   {dishes: [{name, price, description}], place_id,
                                name, address, email, addToList}

menu_url is already a confirmed menu URL supplied by the get_menu discovery lambda.
No URL discovery is performed here — the agent goes straight to fetch and extract.
"""

import json
import sys
import os

# Allow imports from parent menu/ directory when running inside Lambda
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)
sys.path.insert(0, os.path.join(_here, ".."))

from strands import Agent, tool
from strands.models import BedrockModel

from bs4 import BeautifulSoup
from get_menu import is_pdf, is_html, get_html
from dish_extraction import extract_dishes, extract_dish_with_llm, find_dish_candidates, group_into_sections

CLAUDE_SONNET_4 = os.environ.get("CLAUDE_SONNET_4", "us.anthropic.claude-sonnet-4-20250514-v1:0")

SYSTEM_PROMPT = """You are a menu scraper agent for a restaurant allergen analysis system.

You are given a confirmed menu URL. Your job is to extract a clean, structured list of menu items.

Follow this process:
  - If the URL ends in .pdf: call extract_text_from_pdf, then extract_dishes_from_text.
  - Otherwise: call fetch_html, then extract_dishes_from_html.

Return ONLY a JSON array of dish objects with no other text.

Each dish object must follow this schema:
{"name": "Dish Name", "price": 12.99, "description": "Brief description"}

If a field is unknown, use null. Do not invent dishes. If extraction fails, return [].
"""


@tool
def fetch_html(url: str) -> str:
    """
    Fetch the content of a URL and return it as clean plain text (HTML tags stripped).

    Raw HTML is never returned — all markup is removed before the result enters the
    agent context, keeping token usage low. The plain text is ready to pass directly
    to extract_dishes_from_html.

    Returns a newline-separated plain-text string, or an empty string on failure.
    """
    print(f"[ScraperAgent] Fetching HTML from: {url}")
    try:
        html = get_html(url)
        # Strip all HTML markup so the agent context holds lean text, not raw HTML.
        # extract_dishes_from_html handles plain text identically to HTML.
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.extract()
        text = soup.get_text(separator="\n", strip=True)
        print(f"[ScraperAgent] Fetched {len(html)} chars HTML → {len(text)} chars text.")
        return text
    except Exception as e:
        print(f"[ScraperAgent] fetch_html failed: {e}")
        return ""


@tool
def extract_text_from_pdf(url: str) -> str:
    """
    Download a PDF from the given URL and extract its full text content.
    Returns the plain text string, or an empty string on failure.
    Use this for PDF menu URLs.
    """
    print(f"[ScraperAgent] Extracting text from PDF: {url}")
    try:
        text = is_pdf(url)  # reuses get_menu.is_pdf — pdfplumber-based
        print(f"[ScraperAgent] Extracted {len(text)} characters from PDF.")
        return text
    except Exception as e:
        print(f"[ScraperAgent] extract_text_from_pdf failed: {e}")
        return ""


@tool
def extract_dishes_from_html(html_text: str) -> str:
    """
    Parse a restaurant menu HTML string into a JSON array of dish objects.
    Each dish has: name (str), price (float or null), description (str or null).
    Returns a JSON-encoded string of the dish array.
    Use this for HTML menu URLs.
    """
    print(f"[ScraperAgent] Extracting dishes from {len(html_text)} chars of HTML...")
    try:
        dishes = extract_dishes(html_text)
        print(f"[ScraperAgent] Extracted {len(dishes)} dish(es).")
        return json.dumps(dishes)
    except Exception as e:
        print(f"[ScraperAgent] extract_dishes failed: {e}")
        return "[]"


@tool
def extract_dishes_from_text(plain_text: str) -> str:
    """
    Parse plain text (e.g., extracted from a PDF menu) into a JSON array of dish objects.
    Each dish has: name (str), price (float or null), description (str or null).
    Returns a JSON-encoded string of the dish array.
    Use this when find_menu_url returns format="PDF".

    Splits the text into section-level chunks (same logic as the HTML pipeline but
    without HTML preprocessing) so large PDFs are processed in manageable pieces.
    """
    print(f"[ScraperAgent] Extracting dishes from {len(plain_text)} chars of plain text...")
    try:
        # Split plain text into lines, group into sections, filter to dish-like blocks
        lines = [line.strip() for line in plain_text.split("\n") if line.strip()]
        sections = group_into_sections(lines)
        candidates = find_dish_candidates(sections)
        print(f"[ScraperAgent] Found {len(candidates)} dish-candidate section(s) in PDF text.")

        dishes = []
        for block in candidates:
            extracted = extract_dish_with_llm(block)
            if extracted:
                dishes.extend(extracted)

        print(f"[ScraperAgent] Extracted {len(dishes)} dish(es) from PDF text.")
        return json.dumps(dishes)
    except Exception as e:
        print(f"[ScraperAgent] extract_dishes_from_text failed: {e}")
        return "[]"


def build_scraper_agent() -> Agent:
    print("* Building Scraper Agent with model:", CLAUDE_SONNET_4)
    model = BedrockModel(
        model_id=CLAUDE_SONNET_4,
        temperature=0.1,
        max_tokens=8192,
    )
    return Agent(
        model=model,
        tools=[fetch_html, extract_text_from_pdf,
               extract_dishes_from_html, extract_dishes_from_text],
        system_prompt=SYSTEM_PROMPT,
    )


def run_scraper(menu_url: str) -> list[dict]:
    """
    Run the scraper agent against a confirmed menu URL.
    Returns a list of dish dicts: [{name, price, description}]
    """
    agent = build_scraper_agent()
    is_pdf_url = menu_url.lower().endswith(".pdf")
    if is_pdf_url:
        steps = "Call extract_text_from_pdf then extract_dishes_from_text."
    else:
        steps = "Call fetch_html then extract_dishes_from_html."
    prompt = (
        f"Extract all menu items from this confirmed menu URL: {menu_url}\n"
        f"{steps}\n"
        "Return ONLY the final JSON array of dish objects."
    )
    result = agent(prompt)

    # Agent returns a string — parse it as JSON
    raw = str(result).strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        dishes = json.loads(raw)
        if isinstance(dishes, list):
            return dishes
    except json.JSONDecodeError:
        print(f"[ScraperAgent] Could not parse agent output as JSON: {raw[:200]}")

    return []
