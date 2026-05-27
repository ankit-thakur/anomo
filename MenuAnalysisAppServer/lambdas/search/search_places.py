import requests
import json
import os

google_api_key = os.environ['GOOGLE_API_KEY']

_CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

def get_place_id(event, context):
    print("* event: ", event)
    print("* context: ", context)

    body_json = json.loads(event["body"])

    # New Places API v1 — Text Search
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': google_api_key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types',
    }
    body = {'textQuery': body_json['searchQuery']}

    response = requests.post(url, headers=headers, json=body)
    print(f"Google Places response status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        raw_places = data.get('places', [])
        # Normalize to the shape the frontend expects: place_id, name, formatted_address
        results = [
            {
                'place_id': p.get('id', ''),
                'name': p.get('displayName', {}).get('text', ''),
                'formatted_address': p.get('formattedAddress', ''),
                'types': p.get('types', []),
            }
            for p in raw_places
        ]
        return {
            'statusCode': 200,
            'headers': _CORS_HEADERS,
            'body': json.dumps(results)
        }
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return {
            'statusCode': response.status_code,
            'headers': _CORS_HEADERS,
            'body': "Error calling Places API text search: " + response.text
        }


def get_place_details(event, context):
    print("* event: ", event)
    print("* context: ", context)

    qry_str_params = event.get("queryStringParameters") or {}
    place_id = qry_str_params['placeId']

    # New Places API v1 — Place Details
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': google_api_key,
        'X-Goog-FieldMask': 'id,displayName,websiteUri,formattedAddress',
    }

    response = requests.get(url, headers=headers)
    print(f"Google Places details response status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        ret_data = {
            'id': place_id,
            'name': data.get('displayName', {}).get('text', ''),
            'website': data.get('websiteUri', ''),
            'formatted_address': data.get('formattedAddress', ''),
        }
        return {
            'statusCode': 200,
            'headers': _CORS_HEADERS,
            'body': json.dumps(ret_data)
        }
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return {
            'statusCode': response.status_code,
            'headers': _CORS_HEADERS,
            'body': "Error calling Places API details: " + response.text
        }
    
        