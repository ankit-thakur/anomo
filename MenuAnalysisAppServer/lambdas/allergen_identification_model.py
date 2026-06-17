from botocore.exceptions import ClientError


def process_menu(client, menu_items, allergens):

    model_id = "anthropic.claude-3-haiku-20240307-v1:0"

    # TODO: Goal of this method: categorize dish (pasta, curry, ethnicity?), typical ingredients, allergens

    tool_list = [{
        "toolSpec": {
            "name": "process_menu_items",
            "description": "Processed list of menu items",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "processed_menu_items_list": {
                            "type": "array",
                            "description": "List of menu items",
                            "items": {
                                "type": "object",
                                "description": "Individual menu item",
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "description": "menu_items name property"
                                    },
                                    "category": {
                                        "type": "string",
                                        "description": "Determine the type of cuisine the menu item is considered. \
                                            You can use country of origin, ethnicity, and type of dish such as cheeseburger, \
                                            pizza, ramen, curry, etc."
                                    },
                                    "dish": {
                                        "type": "string",
                                        "description": "Given the menu_items's name, description, and listed_ingredients properties, \
                                            determine the type of dish this is such as pizza, cheeseburger, tonkatsu ramen, chicken tikka masala, etc."
                                    },
                                    "ingredients": {
                                        "type": "array",
                                        "description": "Given the menu_item's name, descrition, and listed_ingredients properties, \
                                            determine all possible ingredients this dish uses. Take into consideration each component of \
                                            the dish. For example, if the dish contains a sauce, then what ingeredients are typcially used \
                                            to make the sauce? Remember to look at this from the perspective of a chef.",
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
            { "text": f"<content>{menu_items}</content>" },
            { "text": """You are a tool used by chefs and food safety officials to identify dishes, ingredients, and allergens in \
             restaurant menu items. For each menu item in menu_items provided within the <content> tags, you must do the following: \
             1. Get the name of the item from menu_items' item name property
             2. Determine the type of cuisine the menu item is considered. You can use country of origin, ethnicity, and type of \
                dish such as cheeseburger, pizza, ramen, curry, etc.
             3. Given the menu_items' item name, description, and listed_ingredients properties, determine the type of dish this is \
                such as pizza, cheeseburger, tonkatsu ramen, chicken tikka masala, etc."
             4. List all the ingredients that a chef would need to create this dish from scratch.
                          
            Provide your response in JSON format.""" }

             
            #  Given the menu_item's name, description, and listed_ingredients properties, \
            #     determine all possible ingredients this dish uses. Take into consideration each component of \
            #     the dish. For example, if the dish contains a sauce, then what ingeredients are typcially used \
            #     to make the sauce? Remember to look at this from the perspective of a chef who is recreating a recipe.
             
        ]
    }

    try:
        response = client.converse(
            modelId = model_id,
            messages = [ message ],
            inferenceConfig = {
                "maxTokens": 4000,
                "temperature": 0.5
            },
            # toolConfig = {
            #     "tools": tool_list,
            #     "toolChoice": {
            #         "tool": {
            #             "name": "process_menu_items"
            #         }
            #     }
            # }
        )

    except (ClientError, Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        return {
            'statusCode': 500,
            'body': {"500 Failure!!!"},
        }
    
    # processed_menu = response['output']['message']['content'][0]['toolUse']['input']['processed_menu_items_list']
    print("*** processed menu items: ", response)
    return processed_menu