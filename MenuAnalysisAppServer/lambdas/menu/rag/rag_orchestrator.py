
import boto3
from botocore.exceptions import ClientError
import requests
import time
import re
import json
import pdfplumber
from io import BytesIO


# from utils.url_processor_utils import get_html, clean_menu
s3 = boto3.client("s3")


def invoke_rag(input):
    import os
    stepfunctions_client = boto3.client('stepfunctions', region_name='us-east-1')
    state_machine_arn = os.environ['RAG_STEP_FUNCTION_ARN']

    try:
        # Start the Step Function execution
        response = stepfunctions_client.start_execution(
            stateMachineArn=state_machine_arn,
            input=json.dumps({
                "input": input,
            })
        )
        print("***response: ", response)
        
        # return jsonify({'businessId': new_id, 'exists': False})
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
            'body': "ERROR: Error invoking step function."
        }


    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        'body': response
    }
    

def get_html(url):    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/115.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.text    


def clean_menu(menu_html):
    # print("* pre-clean: ", len(menu_html))
    pattern = re.compile(r'<(script|style|head|footer)[^>]*>.*?</\1>', re.DOTALL)
    new_html = re.sub(pattern, '', menu_html)
    # print("* post-clean: ", len(new_html))
    return new_html


if __name__ == "__main__":
    start_time = time.time()  # Record the starting time
    
    url = 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies'
    
    
    # html = get_html(url)
    # response = clean_menu(html)
    
    print("Processing PDF Link")
    obj = s3.get_object(Bucket='anomo-kb-docs', Key='FoodFacts-WhatYouNeedtoKnowAllergies_20240816.pdf')
    file_stream = BytesIO(obj["Body"].read())
    # Extract text with pdfplumber
    text = []
    with pdfplumber.open(file_stream) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)


    invoke_rag("\n".join(text))
    
    end_time = time.time()    # Record the ending time
    elapsed_time = end_time - start_time
    print(f"Elapsed time: {elapsed_time:.4f} seconds")