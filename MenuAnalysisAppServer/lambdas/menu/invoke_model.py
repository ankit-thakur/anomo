from botocore.exceptions import ClientError
from botocore.config import Config
import requests
import json
import sys
import os
sys.path.insert(0, '/opt/python/lib/python3.12/site-packages')
import importlib.metadata
import boto3
import time
# import re
# import os
# from dotenv import load_dotenv
# load_dotenv()  # load variables from .env into os.environ

# sonnet_3 = os.environ['CLAUDE_SONNET_3']
# from dotenv import load_dotenv  # pip install python-dotenv
# Lazy import — only used in call_model_api_openai(), not in the Bedrock code paths
OpenAI = None


def invoke_model_from_get_menu(prompt, content, do_batch, model_id, max_tokens):
    print("*** invoke_model_from_get_menu ***")
    return invoke_model_1(prompt, content, do_batch, model_id, 0, max_tokens)


def invoke_model_from_analyze_menu(prompt, content, do_batch, model_id, max_tokens):
    print("*** invoke_model_from_analyze_menu ***")
    return invoke_model_1(prompt, content, do_batch, model_id, 0, max_tokens)


def invoke_model_1(prompt, content, do_batch, model_id, retry_count, max_tokens=4096):
    # model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
    # model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    config = Config(read_timeout=1000)
    client = boto3.client('bedrock-runtime', region_name="us-east-1", config=config)

    
    if do_batch:
        print("*** Doing batch ***")
        batches = batch_text_with_overlap(content, max_tokens)
        print("*** num batches: ", len(batches))
        
        batch_count = 1
        responses = []
        for batch in batches:
            
            print("*** Batch num: ", batch_count, ", token count: ", len(batch)/4)
            
            request = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "temperature": 0.2,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": prompt
                        },
                        {
                            "type": "text", 
                            "text": batch
                        }],
                }],
            })
            
            try:
                response = client.invoke_model(modelId=model_id, body=request)                  
            except (ClientError, Exception) as e:
                error_code = e.response["Error"]["Code"]
                if error_code == "ThrottlingException":
                    print(f"Throttling excetion, retrying '{model_id}'. Reason: {e}")
                
                    if retry_count >= 4:
                        print(f"ERROR: Can't invoke '{model_id}' after {retry_count} retries. Reason: {e}")
                        return {
                            'statusCode': 500,
                            'body': {"500 Retry Failure"},
                        }
                        
                    retry_count += 1
                    print(f"Retry count: {retry_count}")
                    time.sleep(2 ** retry_count)  # Exponential backoff
                        
                    retry_response = invoke_model_1(prompt, batch, True, retry_count, model_id)
                    responses.append(retry_response[0])
                
                print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
                return {
                    'statusCode': 500,
                    'body': {"500 Failure!!!"},
                }
                
            decoded_response = decode_response(response)
            
            if decoded_response['stop_reason'] == "max_tokens":
                print("*** Stop reason: max tokens. Retrying batch ***")
                
                batch_1 = batch[0:len(batch)//2]
                batch_2 = batch[len(batch)//2:len(batch)]
                
                retry_response_1 = invoke_model_1(prompt, batch_1, True, retry_count, model_id)
                print("*** retry_response_1: ", retry_response_1[0])
                responses.append(retry_response_1[0])
                retry_response_2 = invoke_model_1(prompt, batch_2, True, retry_count, model_id)
                print("*** retry_response_2: ", retry_response_2[0])
                responses.append(retry_response_2[0])
            else:
                responses.append(decoded_response['content'][0]['text'])
                batch_count += 1
                
        return responses
    
    content_blocks = [{"type": "text", "text": prompt}]
    if content:  # skip the second block if content is empty — Bedrock rejects empty text blocks
        content_blocks.append({"type": "text", "text": content})

    request = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0.2,
        "messages": [{
            "role": "user",
            "content": content_blocks,
        }],
    })
    
    
    
    try:
        response = client.invoke_model(modelId=model_id, body=request)
    except (ClientError, Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        return {
            'statusCode': 500,
            'body': {"500 Failure!!!"},
        }
        
    
    decoded_response = decode_response(response)      
    
    if decoded_response['stop_reason'] == "max_tokens":
        print("*** Stop reason: max tokens. Retrying batch ***")
        retry_response = invoke_model_1(prompt, batch, True, retry_count, model_id)
        print("*** retry_response: ", retry_response)
        responses.append(retry_response)
      
    return decoded_response['content'][0]['text']
    
    
def decode_response(response):
    decoded_response = response['body'].read().decode('utf-8')
    parsed_response = json.loads(decoded_response)
    return parsed_response


def batch_text_with_overlap(text, max_tokens, overlap_tokens=20):
    """
    Splits a large block of text into overlapping batches to preserve context.
    Mental model of batching
    1. split the text into tokens
        1a. tokens = chunk of 4 characters
    2. Group the tokens into batches of N tokens
    3. Overlap the batches by M tokens
    
    Args:
        text (str): The large block of text to split.
        max_tokens (int): Maximum token size for each batch.
        overlap_tokens (int): Number of tokens to overlap between batches.

    Returns:
        list: A list of batches (strings) with overlap between them.
    """
        
    token_size = 4
    tokens = [text[i:i+token_size] for i in range(0, len(text), token_size)]
    
    batches = []
    start = 0
    while start < len(tokens):
        # End index for the current batch
        end = start + max_tokens
        batch_tokens = tokens[start:end]
        batches.append("".join(batch_tokens))  # Convert tokens back to text

        # Move the start index forward, overlapping the tokens
        start += max_tokens - overlap_tokens
    
    return batches


def invoke_model(id, params):
    match id:
        case 'get_menu':
            return invoke_model_get_menu(params['html'], params['place_name'], params['location'], params['url'])
        case 'analyze_menu':
            return invoke_model_analyze_menu(params['menu_html'], params['allergies'])
        
    
def invoke_model_get_menu(html, name, location, url):
    print("*** invoke_model for GetMenu ***")

    # you are an html parser...
    
    message = f"""
        You are an HTML parser whose job it is to parse the HTML of a restaurant's website and locate a link to its \
        menu. The restaurant is called {name} located at {location}, and it's homepage is this URL: {url}. The HTML will be provided within the <unique> tags \
        below. The HTML will be partially cleaned of some tags such as <script|style|head|footer> tags. The URL that you \
        find should be the direct link to the menu itself, I should not have to navigate the site further to find the menu. \
            
        Look for menu or link related keywords such as "menu", "link", "url", "href", "http", "a" or "img" tags, etc to help you identify the link to a menu. \
                
        Your response should be in JSON format with the keys menu_url and menu_format with the following structure:
        {{
            "menu_url": "should only be the URL of the restaurant's menu with no other text, URL should contain "http..." at the \
                beginning and should be pasteable into a search engine to easily get to the menu of the restaurant", \
            "menu_format": "should be the format that the menu comes in. For example, if the menu is contained in a web page, \
                the menu_format should be WEB. If the menu has a .pdf file extension then menu_format should be PDF. If the menu \
                is an image or is a .jpg or .png file then provide menu_format as IMG."
        }}
        
        <unique>{html}</unique>
    """
    
    # message = f"""
    #     You are a customer looking for the menu to a restaurant called {name} located at {location}. \
    #     Given the website of this restaurant, you must identify the URL to the menu such that you can send it to \
    #     a friend later. The URL must include the "http" at the beginning and should be pasteable into a search \
    #     engine to get the menu. Provide the menu URL using the the restaurant website's HTML given within the \
    #     <unique> tags provided below.
        
    #     Your response should be given in JSON format with the keys menu_url and menu_format. menu_url should only be \
    #     the URL of the restaurant's menu with no other text. menu_format should be the format that the menu comes in. \
    #     For example, if the menu is contained in a web page, the menu_format should be WEB. If the menu is a .pdf \
    #     file extension then menu_format should be PDF. If the menu is an image or is a .jpg or .png file then provide \
    #     menu_format as IMG.
        
    #     Example output:
    #     {{
    #         menu_url: https://www.cucinaalba.com/menus/,
    #         menu_format: WEB
    #     }}
        
    #     <unique>{html}</unique>
    # """
        
    return call_model_api_router(message)


def invoke_model_analyze_menu(menu_html, allergies):
    print("*** invoke_model for AnalyzeMenu ***")

    message = f"""
        You are a tool used by the culinary industry and Food and Drug Administration \
        to identify ingredients and allergen information in restaurant \
        menus to determine what is safe for someone with allergies or dietary restrictions to eat. \
        This customer has the following allergies and dietary restrictions: {allergies}". \
        Using the menu HTML in the <unique> tags, first determine the ingredients listed and used in each dish. \
        Second, determine which of the ingredients are also allergens that the customer cannot eat. \
        
        Your response should be a list of menu items with each item in JSON format with the following key/value structure:
        {{
            "name": "The name of the menu item or dish as given by the restaurant",
            "description": "The description of the item on the menu as given by the restaurant",
            "price": "The price of the menu item",
            "listed_ingredients": "A list of all ingredients listed in the description of the menu item",
            "typical_ingredients": "The list of ingredients typically used to make this item or dish. \
                    If the dish contains a sauce, include the ingredients used to make the sauce.",
            "allergens": "The list of ingredients in this dish that contain or are considered allergens",
        }}

        <unique>{menu_html}</unique>
    """
    
    # print("*** AnalyzeMenu message ***", message)
    
    return call_model_api_router(message)


def call_model_api_router(message):
    # call_model_api_bedrock_claude_haiku()
    # return call_model_api_openai(message)
    return invoke_model_1(message)

    
def call_model_api_openai(message):
    print("*** Calling OpenAI Model ***")
    from openai import OpenAI  # lazy — only loaded when this function is actually called

    key = "REDACTED_OPENAI_API_KEY"

    client = OpenAI(
        api_key=key,
    )

    response = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": message,
            }
        ],
        model="gpt-3.5-turbo",
        temperature=0.2,
    )
    
    print("*** OpenAI Response: ", response.choices[0].message.content)
    return response.choices[0].message.content


def call_model_api_bedrock_claude_haiku(message, tool_list):
    model_id = "anthropic.claude-3-haiku-20240307-v1:0"
    client = boto3.client('bedrock-runtime')
    
    try:
        response = client.converse(
            modelId=model_id,
            messages=[message],
            inferenceConfig={
                "maxTokens": 4000,
                "temperature": 0
            },
            toolConfig={
                "tools": tool_list,
                "toolChoice": {
                    "tool": {
                        "name": ""
                    }
                }
            }
        )
    except (ClientError, Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        return {
            'statusCode': 500,
            'body': {"500 Failure!!!"},
        }
        
    print("*** response: ", response)
    return response['output']['message']['content'][0]['toolUse']['input']['menu']
    