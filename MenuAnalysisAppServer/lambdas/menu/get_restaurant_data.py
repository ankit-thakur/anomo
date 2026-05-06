import json
import os
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from scoring import score_restaurant


class _DecimalEncoder(json.JSONEncoder):
    """Convert DynamoDB Decimal values to float for JSON serialization."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

dynamodb = boto3.resource('dynamodb')

restaurant_table       = dynamodb.Table(os.environ['RESTAURANT_TABLE'])
menu_items_table       = dynamodb.Table(os.environ['MENU_ITEMS_TABLE'])
user_preferences_table = dynamodb.Table(os.environ['USER_PREFERENCES_TABLE'])

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}


def handler(event, context):
    print("*** RESTAURANT API HANDLER ***")
    print("* event: ", event)

    resource_path = event.get('path', '').strip('/')

    if resource_path == 'getRestaurant':
        return get_restaurant_handler(event, context)
    elif resource_path == 'getMenuItems':
        return get_menu_items_handler(event, context)
    else:
        return {
            'statusCode': 404,
            'headers': CORS_HEADERS,
            'body': json.dumps({"message": f"Unknown route: {resource_path}"}),
        }


def get_restaurant_handler(event, context):
    print("*** GET RESTAURANT ***")

    body_json = json.loads(event['body'])
    place_id  = body_json['placeId']
    user_id   = body_json.get('userId')   # optional — omit for unauthenticated callers

    try:
        response = restaurant_table.get_item(Key={'restaurantId': place_id})
    except (ClientError, Exception) as e:
        print("*** Exception 400: ", e)
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({"message": "Error fetching restaurant details"}),
        }

    if 'Item' not in response:
        return {
            'statusCode': 404,
            'headers': CORS_HEADERS,
            'body': json.dumps({"message": "Restaurant not found"}),
        }

    restaurant = response['Item']

    # Compute safety score when a userId is provided so the home/recommendation
    # page can display per-user scores without a separate getMenuItems call.
    if user_id:
        try:
            menu_response = menu_items_table.query(
                KeyConditionExpression=Key('restaurantId').eq(place_id)
            )
            dishes = menu_response['Items']
            user_allergens, user_diet_restrictions = _fetch_user_preferences(user_id)
            _, safety_score = score_restaurant(dishes, user_allergens, user_diet_restrictions)
            restaurant['safety_score'] = safety_score
            print(f"[get_restaurant_data] Safety score for {place_id} / user {user_id}: {safety_score}")
        except Exception as e:
            print(f"[get_restaurant_data] Safety score calculation failed (non-fatal): {e}")

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(restaurant, cls=_DecimalEncoder),
    }


def _fetch_user_preferences(user_id: str) -> tuple[list, list]:
    """
    Returns (user_allergens, user_diet_restrictions) for the given Cognito userId.
    Returns ([], []) if the user has no preferences or the lookup fails.
    """
    try:
        response = user_preferences_table.get_item(Key={'userId': user_id})
        prefs = response.get('Item', {})
        return prefs.get('allergens', []), prefs.get('dietaryRestrictions', [])
    except Exception as e:
        print(f"[get_restaurant_data] User preferences lookup failed (non-fatal): {e}")
        return [], []


def get_menu_items_handler(event, context):
    print("*** GET MENU ITEMS ***")

    body_json = json.loads(event['body'])
    place_id  = body_json['placeId']
    user_id   = body_json.get('userId')   # optional — omit for unauthenticated callers

    try:
        menu_table_response = menu_items_table.query(
            KeyConditionExpression=Key('restaurantId').eq(place_id)
        )
        dishes = menu_table_response['Items']
    except (ClientError, Exception) as e:
        print("*** Exception 400: ", e)
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({"message": "Error fetching menu items"}),
        }

    # Score dishes against user preferences when a userId is provided
    safety_score = None
    if user_id:
        user_allergens, user_diet_restrictions = _fetch_user_preferences(user_id)
        dishes, safety_score = score_restaurant(dishes, user_allergens, user_diet_restrictions)
        print(f"[get_restaurant_data] Scored {len(dishes)} dishes for user {user_id}: {safety_score}")

    body = {"dishes": dishes}
    if safety_score is not None:
        body["safety_score"] = safety_score

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, cls=_DecimalEncoder),
    }
