import json
import boto3
import os
from invoke_model import invoke_model_from_analyze_menu

CLAUDE_SONNET_4 = os.environ.get("CLAUDE_SONNET_4", "us.anthropic.claude-sonnet-4-5-20251001-v1:0")

BATCH_SIZE = 15


def infer_ingredients(dishes):
    # Batch up to 10 dishes per request
    batches = [dishes[i:i+BATCH_SIZE] for i in range(0, len(dishes), BATCH_SIZE)]
    enriched = []
    prompt = build_prompt()

    for batch in batches:
        
        response = invoke_model_from_analyze_menu(prompt, json.dumps(batch, indent=2), True, CLAUDE_SONNET_4, 10000)

        print("*** Model response:", response)
        
        response_body = json.loads(response[0])
        enriched.extend(response_body)

    return enriched


def build_prompt():
    return f"""
You are given restaurant dishes. For each, infer a likely ingredient list.

Always return a strict JSON array of objects with no other text. Example:
[
  {{"name": "Dish Name", "price": 12.99, "description": "...", "ingredients": ["item1", "item2"]}}
]

"""
