
def get_html(url):    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/115.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.text    


def clean_menu(menu_html):
    # print("* pre-clean: ", len(menu_html))
    pattern = re.compile(r'<(script|style|head|footer)[^>]*>.*?</\1>', re.DOTALL)
    new_html = re.sub(pattern, '', menu_html)
    # print("* post-clean: ", len(new_html))
    return new_html