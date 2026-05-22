import boto3
import os
import json


def send_email(email, place_id, restaurant_name, results):
    ses_client = boto3.client("ses", region_name="us-east-1")  # adjust region
    print("*** Send Email ***")
    
    subject = "Your results for " + restaurant_name + " are ready!"
    
    # url = "exp://2hr-hl0-ankth-8081.exp.direct/--/home?placeId=" + place_id
    url = "anomo://home?placeId=" + place_id

    body = "Your results for " + restaurant_name + " are ready! Come check them out here: " + url
    
    SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'ankitthakur78701@gmail.com')

    response = ses_client.send_email(
        Source=SENDER_EMAIL,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": subject},
            "Body": {
                "Text": {"Data": body}
            }
        }
    )
    
    print("* response: ", response)

    return {
        "statusCode": 200,
        "body": f"Email sent! Message ID: {response['MessageId']}"
    }
