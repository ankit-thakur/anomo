import boto3
import os

def handler(event, context):
    """
    Post confirmation Lambda trigger for Cognito
    Creates a record in DynamoDB after user confirmation
    """
    
    # Log the incoming event
    print('Received event:', event)
    
    try:
        # Get user attributes from the event
        user_attributes = event['request']['userAttributes']
        
        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ.get('USERS_TABLE_NAME', 'Users'))
        
        # Create user record in DynamoDB
        user_item = {
            'userId': user_attributes['sub'],  # Cognito User ID
            'email': user_attributes['email'],
            'given_name': user_attributes.get('given_name', ''),
            'family_name': user_attributes.get('family_name', ''),
            'email_verified': user_attributes.get('email_verified', 'false'),
            'createdAt': event['request']['userAttributes'].get('custom:createdAt', ''),
            'updatedAt': event['request']['userAttributes'].get('custom:updatedAt', ''),
            'preferences': {},  # Initialize empty preferences
        }
        
        # Put item in DynamoDB
        table.put_item(Item=user_item)
        
        print(f"Successfully created user record for {user_attributes['email']}")
        
    except Exception as e:
        print(f"Error creating user record: {str(e)}")
        # Don't raise the error - we don't want to prevent user confirmation
        # But we should log it for monitoring
        
    return event