import os
import boto3
import datetime
from decimal import Decimal
from botocore.exceptions import ClientError


def _to_ddb(obj):
    """Recursively convert Python floats to Decimal for DynamoDB storage."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _to_ddb(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_ddb(i) for i in obj]
    return obj


def update_restaurants_table(restaurant_id, name, address, menu_url, dish_allergen_summary=None):
    dynamodb = boto3.resource('dynamodb')
    restaurant_table = dynamodb.Table(os.environ['RESTAURANT_TABLE'])

    # Use update_item instead of put_item so fields set by other processes
    # (heroImage, images, etc.) are preserved when no summary is provided.
    update_expr = 'SET #nm = :n, address = :a, menuUrl = :m, updatedAt = :t'
    expr_names  = {'#nm': 'name'}   # 'name' is a DynamoDB reserved word
    expr_values = {
        ':n': name or '',
        ':a': address or '',
        ':m': menu_url or '',
        ':t': datetime.datetime.now().isoformat(),
    }

    if dish_allergen_summary is not None:
        update_expr += ', dish_allergen_summary = :s'
        expr_values[':s'] = _to_ddb(dish_allergen_summary)

    restaurant_table.update_item(
        Key={'restaurantId': restaurant_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )


def update_menu_items_table(restaurant_id, menu):
    dynamodb = boto3.resource('dynamodb')
    menu_items_table = dynamodb.Table(os.environ['MENU_ITEMS_TABLE'])

    for item_name in menu:
        item = menu.get(item_name)
        menu_items_table.put_item(Item={
            'restaurantId': restaurant_id,
            'name': item_name,
            'price': item.get('price'),
            'description': item.get('description'),
            'ingredients': item.get('ingredients'),
            'additional_info': item.get('additional_info'),
            'allergens': item.get('allergens'),
            'diet_restrictions': item.get('diet_restrictions')
        })
        
        
def add_to_email_list(email, add_email_to_list):
    dynamodb = boto3.resource('dynamodb')
    email_list_table = dynamodb.Table(os.environ['EMAIL_LIST_TABLE'])

    if add_email_to_list:
        email_list_table.put_item(Item={
            'email': email
        })
        
        