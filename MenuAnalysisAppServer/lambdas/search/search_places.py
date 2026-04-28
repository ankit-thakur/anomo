import requests
import json
import os

# Access your API key
google_api_key = os.environ['GOOGLE_API_KEY'],

"""
1. Call Google Places API
2. Get 
"""
def get_place_id(event, context):
    base_url = "https://maps.googleapis.com/maps/api/place/textsearch/json?"
        
    print("* event: ", event)
    print("* context: ", context)
    
    body_json = json.loads(event["body"])
    
    # Define the parameters for the API request
    params = {
        'key': google_api_key,
        'query': body_json['searchQuery']
        # 'location': 42.3601° N, 71.0589° W,  # latitude,longitude
        # 'radius': radius,      # Search radius in meters
        # 'keyword': place_name, # Name or keyword of the place to search for
        # 'type': place_type     # Type of place (e.g., restaurant, store)
    }
   
    # Calls the Google Places TextSearch API
    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        data = response.json()
        data_str = json.dumps(data['results'])
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': data_str
        }

    else:
        # Handle error
        print(f"Error: {response.status_code}, {response.text}")
        return {
            'statusCode': response.status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': "Error calling googleapis place textsearch api: " + response.text
        }
    

def get_place_details(event, context):  
    print("* event: ", event)
    print("* context: ", context)
    
    qry_str_params = event.get("queryStringParameters") or {}

    place_id = qry_str_params['placeId']
    
    params = {
        'place_id': place_id,
        'fields': 'name,website,formatted_address',
        'key': google_api_key
    }
    
    # Make the API request to Google Places Details API
    base_url = "https://maps.googleapis.com/maps/api/place/details/json"
    response = requests.get(base_url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        ret_data = data['result']
        ret_data['id'] = place_id
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': json.dumps(ret_data)
        }

    else:
        # Handle error
        print(f"Error: {response.status_code}, {response.text}")
        return {
            'statusCode': response.status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': "Error calling googleapis place details api: " + response.text
        }
    
    

def get_place_photos(event, context):    
    print("* event: ", event)
    print("* context: ", context)
    
    qry_str_params = event.get("queryStringParameters") or {}

    place_id = qry_str_params['placeId']
    
    params = {
        'place_id': place_id,
        'fields': 'name,website,formatted_address',
        'key': google_api_key
    }
    
    # Make the API request to Google Places Details API
    base_url = "https://maps.googleapis.com/maps/api/place/details/json"
    response = requests.get(base_url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        ret_data = data['result']
        ret_data['id'] = place_id
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': json.dumps(ret_data)
        }

    else:
        # Handle error
        print(f"Error: {response.status_code}, {response.text}")
        return {
            'statusCode': response.status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': "Error calling googleapis place details api: " + response.text
        }
    