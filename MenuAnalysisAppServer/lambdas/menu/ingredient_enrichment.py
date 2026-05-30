import json
import boto3
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from invoke_model import invoke_model_from_analyze_menu

CLAUDE_SONNET_4 = os.environ.get("CLAUDE_SONNET_4", "us.anthropic.claude-sonnet-4-5-20251001-v1:0")

BATCH_SIZE = 25
MAX_CONCURRENT_BATCHES = 5


def infer_ingredients(dishes):
    batches = [dishes[i:i+BATCH_SIZE] for i in range(0, len(dishes), BATCH_SIZE)]
    prompt = build_prompt()

    def _call(idx_batch):
        idx, batch = idx_batch
        response = invoke_model_from_analyze_menu(prompt, json.dumps(batch, indent=2), True, CLAUDE_SONNET_4, 10000)
        print(f"*** Model response (batch {idx}):", response)
        return idx, json.loads(response[0])

    ordered = [None] * len(batches)
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_BATCHES) as executor:
        future_to_idx = {
            executor.submit(_call, (idx, batch)): idx
            for idx, batch in enumerate(batches)
        }
        for future in as_completed(future_to_idx):
            idx, result = future.result()
            ordered[idx] = result

    return [item for batch_result in ordered for item in batch_result]


def build_prompt():
    return f"""
You are given restaurant dishes. For each, infer a likely ingredient list.

Always return a strict JSON array of objects with no other text. Example:
[
  {{"name": "Dish Name", "price": 12.99, "description": "...", "ingredients": ["item1", "item2"]}}
]

"""
