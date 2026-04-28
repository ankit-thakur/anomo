from bs4 import BeautifulSoup
import requests
from urllib.parse import urljoin, urlparse


from bs4 import BeautifulSoup
import re

def extract_menu_links(html: str, base_url: str = ""):
    """
    Extracts and ranks links from an HTML page by likelihood of being a restaurant menu.
    
    Args:
        html (str): Raw HTML content of the webpage.
        base_url (str): Optional, to prepend to relative URLs.

    Returns:
        List of tuples: [(link_text, href, score), ...] sorted by score descending.
    """
    soup = BeautifulSoup(html, "html.parser")
    links = soup.find_all("a", href=True)

    menu_keywords = ["menu", "food", "drink", "wine", "dining", "brunch", "lunch", "dinner", "specials"]
    results = []

    for link in links:
        href = link.get("href")
        text = link.get_text(strip=True).lower()
        full_text = f"{text} {href}".lower()

        score = 0

        # PDF menus are highly likely
        if href.lower().endswith(".pdf"):
            score += 2

        # Look for exact keyword "menu"
        if "menu" in full_text:
            score += 3

        # Look for other keywords
        if any(word in full_text for word in menu_keywords if word != "menu"):
            score += 1

        # Construct absolute URL if base_url provided
        if base_url and href.startswith("/"):
            href = base_url.rstrip("/") + href

        results.append((text or "(no text)", href, score))

    # Sort by score descending
    results.sort(key=lambda x: x[2], reverse=True)
    return results


def crawl_for_menu(url, depth=2, visited=None):
    if visited is None:
        visited = set()
    if depth == 0 or url in visited:
        return []

    visited.add(url)
    print(f"Crawling URL: {url} at depth {depth}")
    try:
        html = get_html(url)
        response = clean_menu(html)
    except:
        return []

    soup = BeautifulSoup(response, "html.parser")
    links = [a.get("href") for a in soup.find_all("a", href=True)]
    # links = soup.find_all("a", href=True)
    absolute_links = [urljoin(url, link) for link in links]

    menu_keywords = ["menu", "food", "dining", "brunch", "lunch", "dinner", "specials", "dine"]

    # Look for menu-like keywords
    # menu_links = [l for l in absolute_links if any(k in l.lower() for k in menu_keywords)]
    
    results = []
    for href in absolute_links:
        # href = link.get("href")
        # text = link.get_text(strip=True).lower()
        full_text = f"{href}".lower()
    
        score = 0
        # PDF menus are highly likely
        if href.lower().endswith(".pdf"):
            score += 2

        # Look for exact keyword "menu"
        if "menu" in full_text:
            score += 3

        # Look for other keywords
        if any(word in full_text for word in menu_keywords if word != "menu"):
            score += 1
    
        results.append((href, score))
    
    # Recurse into child pages
    for link in absolute_links:
        if urlparse(link).netloc == urlparse(url).netloc:  # only same domain
            results.extend(crawl_for_menu(link, depth-1, visited))
    
    # Sort by score descending
    results = list(set(results))
    results.sort(key=lambda x: x[1], reverse=True)
    return results


def get_html(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/115.0 Safari/537.36"
    }
    fragment = urlparse(url).fragment
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    html = response.text

    if fragment:
        soup = BeautifulSoup(html, "html.parser")
        section = soup.find(id=fragment)
        if section:
            return str(section)

    return html


def clean_menu(menu_html):
    # print("* pre-clean: ", len(menu_html))
    pattern = re.compile(r'<(script|style|head|footer)[^>]*>.*?</\1>', re.DOTALL)
    new_html = re.sub(pattern, '', menu_html)
    # print("* post-clean: ", len(new_html))
    return new_html


if __name__ == "__main__":
    # url = 'https://maharajaboston.com/'
    # url = 'https://maharajaboston.com/menus/'
    # url = 'https://www.cucinaalba.com/'
    # url = 'https://www.dongbei.us/'
    url = 'https://www.cookshopny.com/'
    # html = get_html(url)
    # cleaned_html = clean_menu(html)
    
    menu_links = crawl_for_menu(url, depth=2)
    # print("Crawled Links:", menu_links)
    for href, score in menu_links:
        print(f"[{score}] {href}")
    
    # menu_links = extract_menu_links(cleaned_html, base_url=url)
    # for text, href, score in menu_links:
    #     print(f"[{score}] {text} -> {href}")
    
    