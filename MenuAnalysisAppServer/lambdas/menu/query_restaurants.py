import json
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from decimal import Decimal


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


# query DDB for place_id
dynamodb = boto3.resource('dynamodb')
restaurant_table = dynamodb.Table('DdbStack-RestaurantTableBDE2029A-1QA3XQE9B836T')
menu_items_table = dynamodb.Table('DdbStack-MenuItemsTableBDB50838-124BTKBL895OK')

def query_restaurants(event, context):
    print("*** QUERY RESTAURANTS ***")
    
    print("* event: ", event)
    print("* context: ", context)
    
    body_json = json.loads(event['body'])
    place_id = body_json['placeId']
            
    try:
        response = restaurant_table.get_item(Key={'restaurantId': place_id})
    except (ClientError, Exception) as e:
        print("*** Exception 400: ", e)
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': "ERROR"
        }
        
        
    if 'Item' in response:
        print("*** Menu already processed, querying Restaurants table ***")
        restaurant_item = response['Item']        
        
        menu_table_response = menu_items_table.query(
            KeyConditionExpression=Key('restaurantId').eq(restaurant_item.get('restaurantId'))
        )
        menu_items = menu_table_response['Items']
                    
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': json.dumps(menu_items, cls=DecimalEncoder)
        }
    else:
        print("*** Menu NOT processed ***")        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': ""
        }
