import json
import os
import sys
    
import importlib.metadata
import boto3
from botocore.exceptions import ClientError
stepfunctions_client = boto3.client('stepfunctions', region_name='us-east-1')


def menu_analyzer_lambda_handler(event, context):
    
    print("*** Menu Analyzer Handler ***")

    print(event)
    print(context)

    body_json = json.loads(event['body'])
    menu_url = body_json['menu_url']
    place_id = body_json['place_id']    # Google Place ID
    
    email = body_json['email']
    add_email_to_list = body_json['addToList']
        
    state_machine_arn = os.environ['STEP_FUNCTION_ARN']
        
    try:
        # Start the Step Function execution
        response = stepfunctions_client.start_execution(
            stateMachineArn=state_machine_arn,
            input=json.dumps({
                "menu_url": menu_url, 
                "place_id": place_id, 
                "name": body_json['name'],
                "address": body_json['address'],
                "email": email if add_email_to_list else ""
            })
        )
        print("***response: ", response)
        
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
            'body': "ERROR: Error invoking step function: " + str(e)
        }


    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        'body': "PASS"
    }
    
    