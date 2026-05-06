
import os
import boto3
import json


def send_websocket_message_3(connection_key, action, message):

    print("*** connection_key: ", connection_key)
    print("*** action: ", action)

    websocket_client = boto3.client('apigatewaymanagementapi',
                      endpoint_url=os.environ['WEBSOCKET_ENDPOINT'])
    dynamodb = boto3.resource('dynamodb')
    connection_table = dynamodb.Table(os.environ['CONNECTIONS_TABLE'])
    connection_item = connection_table.get_item(Key={'connectionKey': connection_key})['Item']
    
    data = {
        'action': action,
        'message': message
    }
    
    print("*** connection ddb: ", connection_item)
    print("*** connection ddb: ", connection_item.get('connectionId'))
    print("**** sending message from backend to frontend: ", data)
    response = websocket_client.post_to_connection(
        ConnectionId=connection_item.get('connectionId'),
        Data=json.dumps(data)
    )
    return response