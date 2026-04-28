import json

def connectionHandler(event, context):
    print("Connection event: ", event)
    print("Connection context: ", context)

    return {
        'statusCode': 200,
        'body': 'Connection event processed'
    }