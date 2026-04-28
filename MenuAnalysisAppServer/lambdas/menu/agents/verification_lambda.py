"""
Lambda handler for the Verification Agent.
Invoked as the third (final) state in the Step Functions menu analysis workflow.
After this, results go to DynamoDB and email.
"""

import json
import sys
import os

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)                       # /var/task/agents/ — finds verification_agent
sys.path.insert(0, os.path.join(_here, ".."))   # /var/task/       — finds invoke_model etc.

from verification_agent import run_verification


def lambda_handler(event, context):
    print("[VerificationLambda] Event keys:", list(event.keys()))

    dishes      = event.get("dishes", [])
    place_id    = event.get("place_id")
    name        = event.get("name", "")
    address     = event.get("address", "")
    menu_url    = event.get("menu_url", "")
    email       = event.get("email", "")
    add_to_list = event.get("addToList", False)

    if not dishes:
        print("[VerificationLambda] No dishes received — passing through.")
        return {**event, "dishes": []}

    verified_dishes = run_verification(dishes)
    print(f"[VerificationLambda] Verification complete for {len(verified_dishes)} dish(es).")

    return {
        "statusCode": 200,
        "dishes": verified_dishes,
        "menu_url": menu_url,
        "place_id": place_id,
        "name": name,
        "address": address,
        "email": email,
        "addToList": add_to_list,
    }
