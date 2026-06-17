########
# TO BE DEPRECATED in  favor of analyze_menu.py
########


from botocore.exceptions import ClientError
import json
import re
import os
import sys
sys.path.insert(0, '/opt/python/lib/python3.12/site-packages')
import importlib.metadata
import boto3
from item_extraction_model import extract_items 
from allergen_identification_model import process_menu



def model_lambda_handler(event, context):

    print(event)
    print(context)

    body = json.loads(event['body'])
    
    menu = body.get('menu')
    allergies = body.get('allergies', [])
    allergies_str = ", ".join([item.upper() for item in allergies])
    print("Allergies: ", allergies_str)

    client = boto3.client('bedrock-runtime')
    print(boto3.__version__)

    model_id = "anthropic.claude-3-haiku-20240307-v1:0"

    tool_list = [{
        "toolSpec": {
            "name": "extract_menu_items",
            "description": "Extract list of menu items",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "menu_items_list": {
                            "type": "array",
                            "description": "List of menu items",
                            "items": {
                                "type": "object",
                                "description": "Individual menu item",
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "description": "The name of the menu item as given by the restaurant."
                                    },
                                    "description": {
                                        "type": "string",
                                        "description": "The description of the item on the menu."
                                    },
                                    "price": {
                                        "type": "string",
                                        "description": "The price of the menu item."
                                    },
                                    "dish": {
                                        "type": "string",
                                        "description": "The identifiable name of the dish such as cheese burger, pizza, tonkatsu ramen, chicken tikka masala, etc."
                                    },
                                    "listed_ingredients": {
                                        "type": "array",
                                        "description": "The list of ingredients listed in the description of the item.",
                                        "items": {"type": "string"}
                                    },
                                    "typical_ingredients": {
                                        "type": "array",
                                        "description": "The list of ingredients typically used to make this dish. \
                                            If the dish contains a sauce, include the ingredients used to make the sauce.",
                                        "items": {"type": "string"}
                                    },
                                    "allergens": {
                                        "type": "array",
                                        "description": "Your customer is allergic to and has the following dietary restrictions: " + allergies_str + ". Return the list of ingredients in this dish that contain any of these allergens.",
                                        "items": { "type": "string" }
                                    }
                                },
                                # "required": [
                                #     "name",
                                #     "price",
                                #     "dish",
                                #     "typical_ingredients",
                                #     "listed_ingredients",
                                #     "allergens"
                                # ]
                            }
                        }
                    }
                }
            }
        }
    }]

    message = {
        "role": "user",
        "content": [
            { "text": f"<content>{menu}</content>" },
            { "text": "You are a tool used by the culinary industry and Food and Drug Administration \
             to identify ingredients and allergen information in restaurant \
             menus to determine what is safe for someone with allergies or dietary restrictions to eat. \
             This customer has the following allergies and dietary restrictions: " + allergies_str + ". \
             Using the menu in the <content> tags, first determine the ingredients listed and used in each dish. \
             Second, determine which of the ingredients are also allergens that the customer cannot eat. \
             Please use the extract_menu_items tool to return your response in JSON format." }
        ]
    }

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
                        "name": "extract_menu_items"
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
        

    print("*** Response: ", response)

    menu_list = response['output']['message']['content'][0]['toolUse']['input']['menu_items_list']

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        'body': json.dumps(menu_list)
    }
