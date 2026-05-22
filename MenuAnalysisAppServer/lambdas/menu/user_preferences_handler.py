import json
import os
import boto3
import decimal
from typing import Dict, Any

# CORS headers for all responses
CORS_HEADERS = {
    'Content-Type': 'application/json',
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": True,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,PUT,DELETE"
}

class _DecimalEncoder(json.JSONEncoder):
    # boto3 returns DynamoDB Number types as Decimal; json.dumps can't handle them.
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

def make_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, cls=_DecimalEncoder)
    }

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['USER_PREFERENCES_TABLE'])

def handler(event, context):
    """
    Handler for user preferences Lambda function.
    Supports GET, PUT, and DELETE methods for different preference types.
    """
    
    print("*** USER PREFERENCES HANDLER ***")
    
    try:
        user_id = event['requestContext']['authorizer']['claims']['sub']
        # user_id = 'd408e458-8051-700c-c8f9-904ce08d7af6'
        http_method = event['httpMethod']
        path = event['path']
        pref_type = None
        if '/dietary' in path:
            pref_type = 'dietary'
        elif '/restaurants' in path:
            pref_type = 'restaurants'
        if http_method == 'GET':
            return get_user_preferences(user_id)
        elif http_method == 'PUT':
            body = json.loads(event['body'])
            if pref_type == 'dietary':
                return update_dietary_preferences(user_id, body)
            elif pref_type == 'restaurants':
                return update_saved_restaurants(user_id, body)
            else:
                return make_response(400, {'error': 'Invalid preference type'})
        elif http_method == 'DELETE':
            if pref_type == 'dietary':
                return delete_dietary_preferences(user_id)
            elif pref_type == 'restaurants':
                return delete_saved_restaurants(user_id)
            else:
                return make_response(400, {'error': 'Invalid preference type'})
        else:
            return make_response(400, {'error': 'Unsupported HTTP method'})
    except Exception as e:
        print(f'Error: {str(e)}')
        return make_response(500, {'error': 'Internal server error'})

def get_user_preferences(user_id: str) -> Dict[str, Any]:
    try:
        response = table.get_item(Key={'userId': user_id})
        if 'Item' in response:
            return make_response(200, response['Item'])
        else:
            return make_response(404, {'error': 'User preferences not found'})
    except Exception as e:
        print(f'Error getting user preferences: {str(e)}')
        return make_response(500, {'error': 'Internal server error'})

def update_dietary_preferences(user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
    try:
        required_fields = ['allergens', 'dietaryRestrictions']
        if not all(field in preferences for field in required_fields):
            return make_response(400, {'error': 'Missing required fields'})
        response = table.get_item(Key={'userId': user_id})
        current_prefs = response.get('Item', {'userId': user_id, 'savedRestaurants': []})
        update_expr = 'SET allergens = :a, dietaryRestrictions = :d'
        expr_values = {
            ':a': preferences['allergens'],
            ':d': preferences['dietaryRestrictions']
        }
        if 'onboardingVersion' in preferences:
            update_expr += ', onboardingVersion = :ov'
            expr_values[':ov'] = int(preferences['onboardingVersion'])
        table.update_item(
            Key={'userId': user_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        current_prefs.update({
            'allergens': preferences['allergens'],
            'dietaryRestrictions': preferences['dietaryRestrictions']
        })
        if 'onboardingVersion' in preferences:
            current_prefs['onboardingVersion'] = int(preferences['onboardingVersion'])
        return make_response(200, current_prefs)
    except Exception as e:
        print(f'Error updating dietary preferences: {str(e)}')
        return make_response(500, {'error': 'Internal server error'})

def update_saved_restaurants(user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if 'savedRestaurants' not in preferences:
            return make_response(400, {'error': 'Missing savedRestaurants field'})
        response = table.get_item(Key={'userId': user_id})
        current_prefs = response.get('Item', {
            'userId': user_id,
            'allergens': [],
            'dietaryRestrictions': []
        })
        update_expr = 'SET savedRestaurants = :r'
        expr_values = {
            ':r': preferences['savedRestaurants']
        }
        table.update_item(
            Key={'userId': user_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        current_prefs['savedRestaurants'] = preferences['savedRestaurants']
        return make_response(200, current_prefs)
    except Exception as e:
        print(f'Error updating saved restaurants: {str(e)}')
        return make_response(500, {'error': 'Internal server error'})

def delete_dietary_preferences(user_id: str) -> Dict[str, Any]:
    try:
        response = table.get_item(Key={'userId': user_id})
        if 'Item' not in response:
            return make_response(404, {'error': 'User preferences not found'})
        update_expr = 'SET allergens = :empty_list, dietaryRestrictions = :empty_list'
        expr_values = {
            ':empty_list': []
        }
        table.update_item(
            Key={'userId': user_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        return make_response(200, {'message': 'Dietary preferences removed successfully'})
    except Exception as e:
        print(f'Error deleting dietary preferences: {str(e)}')
        return make_response(500, {'error': 'Internal server error'})

def delete_saved_restaurants(user_id: str) -> Dict[str, Any]:
    try:
        response = table.get_item(Key={'userId': user_id})
        if 'Item' not in response:
            return make_response(404, {'error': 'User preferences not found'})
        update_expr = 'SET savedRestaurants = :empty_list'
        expr_values = {
            ':empty_list': []
        }
        table.update_item(
            Key={'userId': user_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        return make_response(200, {'message': 'Saved restaurants removed successfully'})
    except Exception as e:
        print(f'Error deleting saved restaurants: {str(e)}')
        return make_response(500, {'error': 'Internal server error'})