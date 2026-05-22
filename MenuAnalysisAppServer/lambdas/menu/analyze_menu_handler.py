import json
import os
import sys
import datetime

import importlib.metadata
import boto3
from botocore.exceptions import ClientError
stepfunctions_client = boto3.client('stepfunctions', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb')


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

    # Write a placeholder immediately so other users querying this restaurant
    # while analysis is in-flight won't be shown the menu submission workflow.
    try:
        restaurant_table = dynamodb.Table(os.environ['RESTAURANT_TABLE'])
        restaurant_table.update_item(
            Key={'restaurantId': place_id},
            UpdateExpression='SET #nm = :n, address = :a, menuUrl = :m, #st = :s, updatedAt = :t',
            ExpressionAttributeNames={'#nm': 'name', '#st': 'status'},
            ExpressionAttributeValues={
                ':n': body_json.get('name', ''),
                ':a': body_json.get('address', ''),
                ':m': menu_url,
                ':s': 'pending',
                ':t': datetime.datetime.now().isoformat(),
            },
        )
    except Exception as e:
        print("*** Warning: could not write pending placeholder:", e)

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
    
    