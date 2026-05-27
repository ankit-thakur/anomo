import json
import os
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
users_table = dynamodb.Table(os.environ['USERS_TABLE'])

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

def update_users_handler(event, context):
    print("*** UPDATE USERS ***")
    print("* event: ", event)

    try:
        body_json = json.loads(event['body'])
        email = body_json.get('email') or 'anonymous'
        submission_type = body_json.get('type')
        content = body_json.get('content', '').strip()

        if submission_type not in ('feedback', 'issue'):
            return {
                'statusCode': 400,
                'headers': HEADERS,
                'body': json.dumps({'error': 'type must be feedback or issue'})
            }

        if not content:
            return {
                'statusCode': 400,
                'headers': HEADERS,
                'body': json.dumps({'error': 'content is required'})
            }

        entry = {
            'content': content,
            'submitted_at': datetime.now(timezone.utc).isoformat(),
        }

        list_attr = 'feedback' if submission_type == 'feedback' else 'issues'

        users_table.update_item(
            Key={'email': email},
            UpdateExpression=f'SET {list_attr} = list_append(if_not_exists({list_attr}, :empty), :entry)',
            ExpressionAttributeValues={
                ':entry': [entry],
                ':empty': [],
            }
        )

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps({'ok': True})
        }

    except (ClientError, Exception) as e:
        print("ERROR:", e)
        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({'error': str(e)})
        }
