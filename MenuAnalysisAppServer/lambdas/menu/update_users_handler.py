import json
import boto3
import uuid
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
users_table = dynamodb.Table('DdbStack-UsersTable9725E9C8-SRM499JXGDIK')

def update_users_handler(event, context):
    print("*** UPDATE USERS ***")
    
    print("* event: ", event)
    print("* context: ", context)
    
    try:
        body_json = json.loads(event['body'])
        email = body_json.get('email')
        submission_type = body_json.get('type')
        feedback = None
        reported_issue = None
        
        if submission_type == 'feedback':
            # Handle feedback submission
            feedback = body_json.get('content')  
        elif submission_type == 'issue':
            # Handle feedback submission
            reported_issue = body_json.get('content')
        
        item = create_user_submission(
            email=email,
            feedback=feedback,
            reported_issue=reported_issue
        )
 
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps(item)
        }
        
    except (ClientError, Exception) as e:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            'body': "ERROR: Error updating user submission: " + str(e)
        }

def create_user_submission(
    email: str = None,
    feedback: str = None,
    reported_issue: str = None
):
    """
    Create a new user submission record in DynamoDB.

    Each submission gets a unique UUID as the partition key so multiple
    submissions can exist for the same user (or anonymously).
    """

    # Unique ID for this submission
    submission_id = str(uuid.uuid4())

    item = {
        "submission_id": submission_id,  # PartitionKey
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }

    # Add optional fields if provided
    if email:
        item["email"] = email
    if feedback:
        item["feedback"] = feedback
    if reported_issue:
        item["issue"] = reported_issue

    # Store in DynamoDB
    users_table.put_item(Item=item)

    return item