from botocore.exceptions import ClientError


def extract_items(client, menu_text):

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
                                    "listed_ingredients": {
                                        "type": "array",
                                        "description": "Using the name and description of the item, \
                                            provide a list of ingredients used in the dish.",
                                        "items": {"type": "string"}
                                    }
                                }
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
            { "text": f"<content>{menu_text}</content>" },
            { "text": """You are a tool used by chefs to determine the ingredients and recipes used by restaurants given \
             their menus. For each menu item in a given menu, you must extract all the ingredients that menu uses. \
             A menu item consists of the dish name, description, price, and listed ingredients. \
             Please use the extract_menu_items tool to extract the name, description, price, and listed_ingredients \
             of each dish in the menu text provided within the <content> tags in JSON format."""}
            #  First, identify each menu item, excluding any section headers.
            #  Second, 
            #  Please use the extract_menu_items tool to extract the name, description, price, and listed_ingredients \
            #  of each dish in the menu text provided within the <content> tags in JSON format.""" }
        ]
    }

    try:
        response = client.converse(
            modelId = model_id,
            messages = [ message ],
            inferenceConfig = {
                "maxTokens": 4000,
                "temperature": 0
            },
            toolConfig = {
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
        
    menu_list = response['output']['message']['content'][0]['toolUse']['input']['menu_items_list']
    print("*** menu items: ", menu_list)
    return menu_list