def handler(event, context):
    """
    Pre-signup Lambda trigger for Cognito
    Automatically confirms users during development. In production, you might want to add additional validation.
    """
    
    # Log the incoming event
    print('Received event:', event)
    
    # Auto confirm the user
    event['response']['autoConfirmUser'] = True
    
    # Auto verify email
    if 'email' in event['request']['userAttributes']:
        event['response']['autoVerifyEmail'] = True
    
    return event