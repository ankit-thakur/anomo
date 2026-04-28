"""
Firecrawl-based menu URL scraper.
Returns clean markdown instead of raw HTML — handles JS-rendered pages,
anti-bot measures, and image-based menus better than requests.get().

Use scrape_menu_url(url) as a drop-in for requests.get(url).text in the pipeline.
"""
import os
from firecrawl import FirecrawlApp

_app = None


def _get_app() -> FirecrawlApp:
    global _app
    if _app is None:
        api_key = os.environ.get("FIRECRAWL_API_KEY")
        if not api_key:
            raise EnvironmentError("FIRECRAWL_API_KEY not set")
        _app = FirecrawlApp(api_key=api_key)
    return _app


def scrape_menu_url(url: str) -> str:
    """
    Scrape a restaurant menu URL via Firecrawl.
    Returns clean markdown text suitable for LLM dish extraction.
    Raises on HTTP/scrape errors.
    """
    app = _get_app()
    result = app.scrape_url(url, formats=["markdown"])
    markdown = result.markdown if hasattr(result, "markdown") else result.get("markdown", "")
    if not markdown:
        raise ValueError(f"Firecrawl returned empty content for {url}")
    return markdown


if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv

    load_dotenv()
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.themermaidnyc.com/the-mermaid-inn-chelsea-menus/"
    print(f"Scraping: {url}\n")
    text = scrape_menu_url(url)
    print(f"--- Firecrawl output ({len(text)} chars) ---\n")
    print(text[:3000])
