import json
import boto3
from bs4 import BeautifulSoup
import re
import time
import requests

from dish_extraction import extract_dishes
from ingredient_enrichment import infer_ingredients
from apply_rules import apply_rules
from update_tables import update_restaurants_table, update_menu_items_table
from send_email import send_email
from scoring import compute_allergen_summary

bedrock = boto3.client("bedrock-runtime")  # ensure IAM role allows this


def lambda_handler(event, context):   
     
    html_text = requests.get(event["menu_url"]).text

    start_time = time.time()
    
    # Step 1: Extract dishes from cleaned HTML
    dishes = extract_dishes(html_text)
    # dishes = [{'name': 'Blood Orange Hospitality', 'price': 17.0, 'description': 'jalapeno-infused tequila, blood orange & lime'}, {'name': 'Julep Jubilee', 'price': 17.0, 'description': 'bourbon, mint, honey & blanc de blancs'}, {'name': 'At The Plaza', 'price': 17.0, 'description': 'bourbon, sweet vermouth, bitters & hazelnut'}, {'name': 'Winter Mule', 'price': 17.0, 'description': 'vodka, ginger, lime & cranberry'}, {'name': 'Pear-Suit of Happiness', 'price': 17.0, 'description': 'gin, pear, clove, lemon & blanc de blancs'}, {'name': 'Dirty Chai-Tini', 'price': 17.0, 'description': 'vodka, espresso, chai & cinnamon'}, {'name': 'Blizzard Winds', 'price': 17.0, 'description': 'reposado tequila, coconut, hazelnut & vanilla'}, {'name': 'Golden Ale', 'price': 10.0, 'description': 'montauk surf beer, montauk, ny (4.5%)'}, {'name': 'Lager', 'price': 10.0, 'description': 'estrella galicia, galicia, sp (5.4%)'}, {'name': 'IPA', 'price': 10.0, 'description': 'montauk wavechaser montauk, ny (6.4%)'}, {'name': 'Pilsner', 'price': 10.0, 'description': '(montauk, ny) 5.4%'}, {'name': 'Blood Orange Refresher', 'price': 12.0, 'description': 'pineapple, blood orange & lime'}, {'name': 'Mojito', 'price': 12.0, 'description': 'blood orange-passion fruit- pineapple-cucumber'}, {'name': 'Hazelnut Espresso Martini', 'price': 12.0, 'description': 'espresso, hazelnut & cream'}, {'name': 'Winter Solstice', 'price': 12.0, 'description': 'cranberry, ginger & lime'}, {'name': 'Littleneck Clams', 'price': 12.0, 'description': '1/2 dozen'}, {'name': 'Chilled Jumbo Shrimp', 'price': 5.5, 'description': 'per each'}, {'name': 'Tuna Tartare', 'price': 20.0, 'description': 'avocado, cucumber, and crispy wonton chips'}, {'name': 'Baby Grand Platter', 'price': 42.0, 'description': "six clams, chef's choice of six oysters & tuna tartare"}, {'name': 'Grand Platter', 'price': 79.0, 'description': "chef's choice of twelve oysters, six clams, shrimp cocktail, salmon tartare & tuna tartare"}, {'name': "Farmer's Market", 'price': 16.0, 'description': 'poached farm eggs, market vegetables, basil pesto, arugula & seven grain toast'}, {'name': 'Greek Yogurt Pancakes', 'price': 17.0, 'description': 'powdered sugar, sliced bananas & strawberries'}, {'name': 'Classic Eggs Benedict', 'price': 16.0, 'description': 'lyonnaise potatoes, english muffin & old bay hollandaise'}, {'name': 'Classic Eggs Benedict with Ham', 'price': 18.0, 'description': 'lyonnaise potatoes, english muffin & old bay hollandaise with ham'}, {'name': 'Classic Eggs Benedict with Smoked Salmon', 'price': 19.0, 'description': 'lyonnaise potatoes, english muffin & old bay hollandaise with smoked salmon'}, {'name': 'Three Eggs Any Style', 'price': 16.0, 'description': 'lyonnaise potatoes, choice of apple wood smoked bacon or chicken & apple sausage'}, {'name': 'Challah French Toast', 'price': 18.0, 'description': 'salted caramel, bananas & corn flake streusel'}, {'name': 'Smoked Fish Board', 'price': 19.0, 'description': 'smoked trout salad, spice cured smoked salmon, bagel chips, capers & red onion'}, {'name': 'mermaid black angus burger', 'price': 21.0, 'description': 'grafton cheddar, pretzel bun, mesquite ketchup & old bay fries'}, {'name': 'bacon', 'price': 2.0, 'description': ''}, {'name': 'avocado', 'price': 2.0, 'description': ''}, {'name': 'sunnyside egg', 'price': 2.0, 'description': ''}, {'name': 'mermaid fish tacos', 'price': 28.0, 'description': 'beer batter, red cabbage, pickled jalapenos & pico de gallo'}, {'name': 'shaved kale salad', 'price': 16.0, 'description': 'house caesar, parmesan, garlic croutons & old bay chick peas'}, {'name': 'beer battered shrimp basket', 'price': 23.0, 'description': 'old bay fries, mesquite tartar sauce & house pickles'}, {'name': '"nearly famous" lobster roll', 'price': 35.0, 'description': 'griddled brioche bun & old bay fries'}, {'name': 'chunu', 'price': 3.5, 'description': 'eastern shore, va - slight brine, sweet & earthy finish'}, {'name': 'mermaid cove', 'price': 3.75, 'description': 'pei, ca - briny, tender meat'}, {'name': 'island creek', 'price': 4.0, 'description': 'duxbury, ma - zesty brine & firm meat'}, {'name': 'east beach blonde', 'price': 4.25, 'description': 'ninigret, ri - salt & peachy finish'}, {'name': 'Pink Moon', 'price': 3.75, 'description': 'pei, ca - salty & sweet finish'}, {'name': 'Apple Smoked Bacon', 'price': 6.0, 'description': ''}, {'name': 'Old Bay Fries', 'price': 10.0, 'description': ''}, {'name': 'English Muffin', 'price': 4.0, 'description': ''}, {'name': 'Seven Grain Toast', 'price': 4.0, 'description': ''}, {'name': 'Seasonal Fruit Bowl', 'price': 5.0, 'description': ''}, {'name': 'Smoked Salmon', 'price': 9.0, 'description': ''}, {'name': 'Mixed Mesclun Salad', 'price': 13.0, 'description': ''}, {'name': 'Lyonnaise Potatoes', 'price': 6.0, 'description': ''}, {'name': 'Chicken & Apple Sausage', 'price': 6.0, 'description': ''}, {'name': '½ Dozen Littleneck Clams', 'price': 12.0, 'description': ''}, {'name': 'Chilled Jumbo Shrimp', 'price': 5.5, 'description': 'ea.'}, {'name': 'Yellowtail Ceviche', 'price': 18.0, 'description': 'yuzu, pink grapefruit, ancho chili, toasted garlic'}, {'name': 'Tuna Tartare', 'price': 20.0, 'description': 'avocado, cucumber, crispy wonton chips'}, {'name': 'Baby Grand Platter', 'price': 42.0, 'description': 'six clams, six oysters & tuna tartare'}, {'name': 'Grand Platter', 'price': 79.0, 'description': 'twelve oysters, six clams, tuna tartare, shrimp cocktail & salmon tartare'}, {'name': 'Chunu', 'price': 3.5, 'description': 'eastern shore, va - slight brine, sweet, earthy finish'}, {'name': 'Mermaid Cove', 'price': 3.5, 'description': 'pei, ca - briny, tender meat'}, {'name': 'Island Creek', 'price': 4.0, 'description': 'duxbury, ma - zesty brine & plump firm meat'}, {'name': 'East Beach Blondes', 'price': 3.75, 'description': 'ninigret, ri - salt & peachy finish'}, {'name': 'Pink Moon', 'price': 3.75, 'description': 'Pei, Ca - salty & sweet finish'}, {'name': 'New England Clam Chowder', 'price': 13.0, 'description': 'bacon & fingerling potatoes'}, {'name': 'Roasted Beet Salad', 'price': 18.0, 'description': 'watercress, pistachio & dill creme fraiche'}, {'name': 'Lobster Knuckles "Escargot Style"', 'price': 18.0, 'description': 'parsley garlic butter & grilled country bread'}, {'name': 'Seared Calamari Salad', 'price': 17.0, 'description': 'cremini, shiitake, frisee, piquillo peppers, feta, olive oil & lemon'}, {'name': 'Shaved Kale Salad', 'price': 16.0, 'description': 'house caesar, parmesan, garlic croutons & old bay chick peas'}, {'name': 'Mermaid Wedge', 'price': 16.0, 'description': 'cherry tomato, red onion, maytag blue cheese, apple~smoked bacon & buttermilk dressing'}, {'name': 'Shishito Peppers', 'price': 14.0, 'description': 'sea salt & candied lemon'}, {'name': 'Parker House Rolls', 'price': 8.0, 'description': 'butter & old bay'}, {'name': 'Hush Puppies', 'price': 12.0, 'description': 'corn & hot pepper honey'}, {'name': 'Mexican Corn', 'price': 18.0, 'description': 'chipotle aioli & parmesan'}, {'name': 'Watermelon Salad', 'price': 18.0, 'description': 'feta, fennel, watercress & lemon citronette'}, {'name': 'Summer Corn Risotto', 'price': 20.0, 'description': 'queso fresco & chili oil'}, {'name': 'Pan Seared Artic Char', 'price': 31.0, 'description': 'napa cabbage, king trumpet mushrooms & beurre blanc'}, {'name': 'Mermaid Fish Tacos', 'price': 28.0, 'description': 'beer batter, red cabbage, pickled jalapeño & pico de gallo'}, {'name': 'Linguine & Clams', 'price': 28.0, 'description': 'arugula, meyer lemon & aleppo pepper'}, {'name': 'Chatham Cod', 'price': 31.0, 'description': 'rainbow cauliflower puree, king trumpets, peas & almond brown butter'}, {'name': 'Pan Roasted Free Range Chicken', 'price': 28.0, 'description': 'spring vegetables & lemon thyme jus'}, {'name': 'Wild Yellowfin Tuna Tataki', 'price': 32.0, 'description': 'hijiki, avocado, toasted sesame, daikon & ginger ponzu'}, {'name': '"Nearly Famous" Lobster Roll', 'price': 35.0, 'description': 'griddled brioche bun & old bay fries'}, {'name': '14 Oz New York Strip', 'price': 42.0, 'description': 'chimichurri, sea salt & smashed fingerling'}, {'name': 'Simply Grilled Artic Char', 'price': 26.0, 'description': 'Olive Oil, Parsley & Charred Lemon'}, {'name': 'Simply Grilled Chatham Cod', 'price': 26.0, 'description': 'Olive Oil, Parsley & Charred Lemon'}, {'name': 'Simply Grilled Whole Branzino', 'price': 34.0, 'description': 'Olive Oil, Parsley & Charred Lemon'}, {'name': 'Fingerling Potatoes', 'price': 10.0, 'description': 'chimichurri'}, {'name': 'Shishito Peppers', 'price': 14.0, 'description': 'candied lemon & sea salt'}, {'name': 'Smoked Gouda Mac & Cheese', 'price': 14.0, 'description': ''}, {'name': 'Veggies', 'price': 3.0, 'description': ''}, {'name': 'Bacon', 'price': 4.0, 'description': ''}, {'name': 'Lobster', 'price': 10.0, 'description': ''}, {'name': 'Old Bay Fries', 'price': 10.0, 'description': ''}, {'name': 'House Salad', 'price': 13.0, 'description': 'parmesan, carrot, red onion, radish & lemon citronette'}, {'name': 'Grilled Asparagus', 'price': 14.0, 'description': 'romesco sauce'}, {'name': "Chef's Choice Oysters & Little Neck Clams", 'price': 1.5, 'description': 'Minimum of 6 ea.'}, {'name': 'Mini New England Clam Chowder', 'price': 3.75, 'description': ''}, {'name': 'Salmon Tartare', 'price': 10.0, 'description': ''}, {'name': 'Mini Mermaid Fish Tacos', 'price': 4.0, 'description': 'ea.'}, {'name': 'Spinach & Artichoke Dip', 'price': 9.0, 'description': ''}, {'name': 'Fried Calamari', 'price': 12.0, 'description': ''}, {'name': 'Grilled Shrimp & Avocado Slider', 'price': 9.0, 'description': 'ea.'}, {'name': 'Old Fashioned', 'price': 10.0, 'description': 'bourbon, sugar & orange'}, {'name': 'Hot & Dirty', 'price': 10.0, 'description': 'Vodka, olive juice, peppadew & hot sauce'}, {'name': 'Margarita', 'price': 10.0, 'description': 'Tequila, triple sec & lime'}, {'name': 'Hugo Spritz', 'price': 10.0, 'description': 'Blanc de blanc, elderflower & mint'}, {'name': 'Happy Hour Wine', 'price': 10.0, 'description': 'White . Red . Sparkling . Rose'}, {'name': 'Happy Hour Beer', 'price': 8.0, 'description': 'Draft'}] 
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"Dish extraction execution time: {elapsed_time} seconds")

    if not dishes:
        return []
    
    print("*** Dishes extracted:", dishes)

    start_time = time.time()

    # Step 2: Infer ingredients using LLM
    enriched_dishes = infer_ingredients(dishes)
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"Ingredient enrichment execution time: {elapsed_time} seconds")


    start_time = time.time()
    
    
    
    # Step 3: Apply allergen & dietary classification
    final_dishes = {}
    for d in enriched_dishes:
        d = apply_rules(d)
        
        d['price'] = format_currency(d.get('price')) if d.get('price') else ''
        
        final_dishes[d['name']] = d
        
    
    # final_dishes = [apply_rules(d) for d in enriched_dishes]
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"Rules application execution time: {elapsed_time} seconds")
    
    print("*** Final dishes:", final_dishes)
    
    summary = compute_allergen_summary(list(final_dishes.values()))
    update_restaurants_table(
        event.get('place_id'),
        event.get('name'),
        event.get('address'),
        event.get('menu_url'),
        dish_allergen_summary=summary,
    )
    update_menu_items_table(event.get('place_id'), final_dishes)
        
    # invoke email service to notify user of menu analysis completion
    if event.get('email') and event.get('email') != '':
        send_email(event.get('email'), event.get('place_id'), event.get('name'), final_dishes)
    

    return {"statusCode": 200, "body": json.dumps({"dishes": final_dishes})}


def format_currency(value, currency_symbol="$", decimals=2):
    """
    Convert a number or string (with or without currency symbol) 
    to a formatted currency string.
    Handles float/int, numeric strings, and strings with symbols like "$13.99".
    """
    try:
        if isinstance(value, str):
            # Remove all non-numeric, non-decimal, non-minus chars
            cleaned = re.sub(r"[^\d.\-]", "", value)
            number = float(cleaned) if cleaned else 0.0
        else:
            number = float(value)
    except (ValueError, TypeError):
        raise ValueError(f"Invalid value for currency conversion: {value}")

    # Format with commas and decimal places
    return f"{currency_symbol}{number:,.{decimals}f}"


if __name__ == "__main__":
    print("Start analyzing menu...")
    
    start_time = time.time()
    
    lambda_handler({
        # 'menu_url': 'https://www.themermaidnyc.com/the-mermaid-inn-chelsea-menus/#dinner-copy'
        'menu_url': 'https://www.chamamama.com/menus/#dinner-q2-2025-copy'
    }, None)   
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"Execution time: {elapsed_time} seconds")

    