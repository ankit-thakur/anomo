import json
import boto3


websocket_client = boto3.client('apigatewaymanagementapi', 
                      endpoint_url='https://djh0fnzlrc.execute-api.us-east-1.amazonaws.com/prod/')
dynamodb = boto3.resource('dynamodb')
connection_table = dynamodb.Table('DdbStack-ConnectionIdTable77777283-1306I0N1TTPNL')  

        
def message_handler(event, context):
    print("Message received event: ", event)
    print("Message received context: ", context)
    
    body_json = json.loads(event['body'])
    
    print("********* : ", body_json['action'])
    
    if body_json['action'] == 'establishConnection':
        # get connection id or any other information necessary to use the connection
        connection_id = event['requestContext']['connectionId']
        print("**** connection key,id: ", body_json['connectionKey'], connection_id)
        
        # write connectionId to connections table
        connection_table.put_item(Item={
            'connectionKey': body_json['connectionKey'],
            'connectionId': connection_id
        })
        
    return {
        'statusCode': 200,
        'body': "Message received"
    }    
    

def send_websocket_message(connection_key, action, message):
    
    connection_id = connection_table.get_item(Key={'connectionKey': connection_key})
    
    data = {
        'action': action,
        'message': message
    }
    
    print("**** sending message from backend to frontend: ", data)
    response = websocket_client.post_to_connection(
        ConnectionId=connection_id,
        Data=json.dumps(data)
    )
    return response

