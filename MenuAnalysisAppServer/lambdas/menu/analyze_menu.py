from botocore.exceptions import ClientError
import json
import re
import os
import sys
sys.path.insert(0, '/opt/python/lib/python3.12/site-packages')
import importlib.metadata
import boto3
import requests
import re
# from pypdf import PdfReader
import pdfplumber
from io import BytesIO

CLAUDE_SONNET_3 = 'anthropic.claude-3-sonnet-20240229-v1:0'
CLAUDE_SONNET_3_5 = 'us.anthropic.claude-3-5-sonnet-20240620-v1:0'
CLAUDE_SONNET_4 = 'us.anthropic.claude-sonnet-4-20250514-v1:0'



# import fitz  # PyMuPDF -- I imported it in the PdfReaderLayer in LambdaLayersStack 
from update_tables import update_restaurants_table, update_menu_items_table
from invoke_model import invoke_model, invoke_model_1
from send_email import send_email
from lambda_handler import lambda_handler

    
def menu_analyzer_lambda(event, context):
    
    return lambda_handler(event, context)

    
def OLD_menu_analyzer_lambda(event, context):
    
    processed_menu_text = get_menu_text(event["menu_url"])

    print("* Extracting menu information from processed text *")
    
    message = f"""
        Given the preprocessed HTML or PDF content of a restaurant's menu, your job is to extract certain requested infomation. Please 
        extract the following information from the provided content for each dish on the menu:
        1. The name of the dish
        2. The description of the dish
        3. The price of the dish
        
        Provide your response as a JSON dict with the following format. The JSON dict should be within <response> tags with no other text before or after:
        <response>{{
            "Name of the dish or item": {{
                "description": "Dish Description",
                "price": "Dish Price"
            }}
        }}</response>
    """
    
    content_1 = f"<menu>{processed_menu_text}</menu>"
    response = invoke_model_1(message, content_1, True, CLAUDE_SONNET_4)
    print("*** response: ", response)
    
    string_response_1 = process_response(response)
    json_objects_1 = json.loads(string_response_1)
        
    print("*** response_1_parsed(", type(string_response_1), "): ", string_response_1)
        
    print("* Processing menu data for ingredients info *")
    
    message_2 = f"""
        For each provided dish, use dish name and/or description to provide a comprehensive list of ingredients used in each dish. Consider the following sources of information:
        1. Explicit ingredients mentioned in the dish name and/or description (if any).
        2. Common ingredients based on the type of dish (e.g., a "Caesar Salad" typically includes romaine lettuce, croutons, parmesan cheese, etc.).
        3. Common ingredients based on the dish's country of origin or cuisine (e.g., a "Tom Yum Soup" from Thailand would likely contain lemongrass, kaffir lime leaves, fish sauce, etc.).

        Some edge cases to keep in mind:
        1. If the ingredients are not explicitly mentioned, infer the most likely ingredients based on typical versions of that dish.
        2. If the dish calls out a sauce, glaze, dressing, or some other unexplained component, then infer the most likely ingredients based on what you know about that component. (e.g. Caesar salad dresshing typically contains egg, anchovies, garlic, olive oil, lemon, Dijon mustard)
        3. If you lack some information such as a vague dish name or a missing description, do not comment on the lack of information and simply state your inference based on the information you do have.
        
        For each dish, return the following:
        1. Dish Name provided (do not change this name, it is used as a key in a map)
        2. List of Ingredients: (including inferred ingredients)
        3. Additional Info: (any explanations for inferred ingredients or assumptions made)
        
        Provide your response as a JSON dict with the following format. The JSON dict should be within <response> tags with no other text before or after:
        <response>{{
            "Name of the dish or item": {{
                "ingredients": ["ingredient 1", "ingredient 2" ...],
                "additional_info": "any explanations for inferred ingredients or assumptions made"
            }}
        }}</response>
    """
    
    content_2 = f"<menu_data>{string_response_1}</menu_data>"
    response_2 = invoke_model_1(message_2, content_2, True, CLAUDE_SONNET_4) # prompt, menu input, batching flag
    print("*** response_2: ", response_2)
    
    string_response_2 = process_response(response_2)
    json_objects_2 = json.loads(string_response_2)
    print("*** string_response_2(", type(string_response_2), "): ", string_response_2)
        
    response_3 = detect_allergies_and_restrictions(string_response_2)

    
    final_response = append_responses(json_objects_1, json_objects_2, response_3)

    print("*** final_response: ", final_response)
    
    update_restaurants_table(
        event.get('place_id'), 
        event.get('name'), 
        event.get('address'), 
        event.get('menu_url')
    )
    update_menu_items_table(event.get('place_id'), final_response)
        
    # invoke email service to notify user of menu analysis completion
    send_email(event.get('email'), event.get('place_id'), event.get('name'), final_response)
    
    return final_response


def detect_allergies_and_restrictions(response_2):
    print("* Detecting allergies and Restrictions *")
    
    message_3 = f"""
        For each provided dish, use the name of the dish, list of ingredients, and additional info to provide a comprehensive list of allergens the dish contains and any dietary restirctions the dish does NOT satisfy.
        Consider the following:
        1. The FDA recognizes the following major food allergens: milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, and soybeans.
        2. Common dietary restrictions include vegetarian, vegan, gluten-free, and dairy-free.
        4. Use the name of the dish, ingredients list, and additional info to determine if the dish contains ingredients that are NOT suitable for that diet. (e.g. a dish with "burger" in the name likely contains beef, making it unsuitable for vegetarians or vegans. Or a Margharita pizza typically contains cheese and dough making it unsuitable for vegans, dairy-free, and gluten-free diets)
        5. If an allergen or restriction is not explicitly mentioned in the provided information, infer the most likely allergens or restrictions based on typical versions of that dish.
        6. If the ingredients consist of a sauce, glaze, dressing, or some other unexplained component, then infer the most likely allergens or unsuitable diets based on what you know about that component. (e.g. Caesar salad dressing typically contains egg, anchovies, garlic, olive oil, lemon, Dijon mustard, so callout eggs and fish as allergens)
        
        Provide your response as a JSON dict with the following format for each dish. The JSON dict should be within <response> tags with no other text before or after:
        <response>{{
            "Name of the dish or item (do not change this name, it is used as a key in a map)": {{
                "allergens": all the allergens that this dish contains out of milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, and soybeans. (e.g. ["allergen 1", "allergen 2" ...] )
                "diet_restrictions": all the dietary restrictions that this dish is not suitable for out of vegetarian, vegan, dairy-free, and gluten-free. (e.g. ["restriction 1", "restriction 2" ...] )
            }}
        }}</response>
        
        Example Input:
        "Margharita Pizza": {{
            "ingredients": ["tomato sauce", "mozzarella cheese", "basil", "olive oil", "dough"],
            "additional_info": "A classic pizza with tomato sauce, fresh mozzarella, and basil leaves."
        }}
        
        Example Output:
        "Margharita Pizza": {{
            "allergens": ["milk", "wheat"],
            "diet_restrictions": ["gluten-free", "vegan"]
        }}
        
        Explanation: The Margharita Pizza contains mozzarella cheese (milk) and dough (wheat), making it unsuitable for those with dairy or gluten allergies, or vegan diets. However, it is safe for vegetarians.
    """
    
    
    
        # For each dish, return the following:
        # 1. Dish Name provided (do not change this name, it is used as a key in a map)
        # 2. List of Allergens: all the allergens that this dish contains out of milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, and soybeans
        # 3. List of Dietary Restrictions: all the dietary restrictions that this dish is not suitable for
        
    
    content_3 = f"<menu_data>{response_2}</menu_data>"
    response_3 = invoke_model_1(message_3, content_3, True, CLAUDE_SONNET_4) # prompt, menu input, batching flag
    
    print("*** response_3: ", response_3)
    
    string_response_3 = process_response(response_3)
    
    return json.loads(string_response_3)
    
    
def process_response(response):
    pattern = r'<response>[\n]*{(.*?)}[\n]*</response>'

    string_objects = []
    for response_string in response:
        try:
            matched_response = re.search(pattern, response_string, re.DOTALL).group(1)
            print("* matched_response: ", matched_response)
        except AttributeError:
            print("AttributeError: <response> tags not found in model response string. Continuing with matched responses. Problematic response_string: ", response_string)
            
        if matched_response != "" and matched_response is not None:
            string_objects += [matched_response]
            
    string_objects = ','.join(string_objects)
    
    return "{" + string_objects + "}"
    

def append_responses(response_1, response_2, response_3):
    """
    Combine three response dicts into one safe response.
    - If ingredients is missing/not a non-empty list => item is skipped.
    - Missing string fields -> "".
    - Missing list fields   -> [].
    - Preserves numeric 0 for price.
    """
    response = {}

    r1 = response_1 or {}
    r2 = response_2 or {}
    r3 = response_3 or {}

    # consider items present in any of the three responses
    all_keys = set(response_1 or {})

    for key in all_keys:
        item_1 = r1.get(key) or {}
        item_2 = r2.get(key) or {}
        item_3 = r3.get(key) or {}

        # ingredients must exist and be a non-empty list to include the item
        ingredients = item_2.get("ingredients")
        if not isinstance(ingredients, list) or len(ingredients) == 0:
            continue

        # For strings: preserve values that are intentionally empty strings,
        # but replace None with "".
        desc = item_1.get("description")
        description = desc if desc is not None else ""

        price_val = item_1.get("price")
        price = price_val if price_val is not None else ""

        additional_info_val = item_2.get("additional_info")
        additional_info = additional_info_val if additional_info_val is not None else ""

        # For lists: only accept when the value is a list, otherwise default to []
        allergens_val = item_3.get("allergens")
        allergens = allergens_val if isinstance(allergens_val, list) else []

        diet_val = item_3.get("diet_restrictions")
        diet_restrictions = diet_val if isinstance(diet_val, list) else []

        response[key] = {
            "description": description,
            "price": price,
            "ingredients": ingredients,
            "additional_info": additional_info,
            "allergens": allergens,
            "diet_restrictions": diet_restrictions,
        }

    return response
 
        
def get_menu_text(link):
    # Check if the input is a full URL
    url_pattern = re.compile(r'^(https?://|www\.)[^\s/$.?#].[^\s]*$', re.IGNORECASE)
    if url_pattern.match(link):
        if link.lower().endswith('.pdf'):
            return process_pdf(link)
        elif re.search(r'\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)$', link, re.IGNORECASE):
            return process_image(link)
        return process_html(link)
    
    # Check for standalone PDF or image file
    # if re.fullmatch(r'.+\.pdf', link, re.IGNORECASE):
    #     return "PDF link"
    # if re.fullmatch(r'.+\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)', link, re.IGNORECASE):
    #     return "Image link"
    
    return "Error: cannot determine link type"
    
        
def process_pdf(pdf_link):
    print("Processing PDF Link")
    response_content_bytes = requests.get(pdf_link).content      
    menu_html_pre_clean = ""
    with pdfplumber.open(BytesIO(response_content_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            menu_html_pre_clean += text
    # print("*** final: ", menu_html_pre_clean)
    
    return menu_html_pre_clean

        
if __name__ == "__main__":
    # process_pdf("https://maharajaboston.com/wp-content/uploads/2024/12/maharaja-dine-in-menu-2024.pdf")
    menu_analyzer_lambda({
  "menu_url": "http://maharajaboston.com/wp-content/uploads/2024/12/maharaja-dine-in-menu-2024.pdf"
}, {})
        
def process_image(img_link):
    return "Image type not supported"


def process_html(url_link):
    print("Processing HTML Link")
    menu_html_pre_clean = requests.get(url_link).text       # Gets raw menu HTML
    processed_menu_html = clean_menu(str(menu_html_pre_clean))  # Cleans menu HTML of unnecessary tags and elements to decrease text size
    print("Menu size pre-clean: ", len(menu_html_pre_clean), ", post clean: ",  len(processed_menu_html))

    # if len(processed_menu_html) < 

    return processed_menu_html

    
# HTML token size was too large to pass into the model, so cleaning unnecessary tags
# 1. Remove script, head, footer, style tags from HTML
# 2. Remove all remaining tags enclosed by "<>", leaving only text
def clean_menu(menu_html):
    
    pattern = re.compile(r'[\n\t]|<(script|style|head|footer)[^>]*>.*?</\1>', re.DOTALL)
    new_html = re.sub(pattern, '', menu_html)
    
    pattern = re.compile(r'<.*?>')
    new_html = re.sub(pattern, '', new_html)
    
    # print(new_html)
    return new_html


# overlapping batch menu_html assuming rough token size of 3-4 characters per token
def chunk_menu(menu_html, text_size_after_cleaning):
    print("Chunky menu")
    
    token_count = text_size_after_cleaning / 4  # total number of tokens in the text
    

