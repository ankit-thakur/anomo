"""
Lambda handler for the Allergen Detection Agent.
Invoked as the second state in the Step Functions menu analysis workflow.
"""

import json
import sys
import os

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)
sys.path.insert(0, os.path.join(_here, ".."))

from allergen_agent import run_allergen_detection


def lambda_handler(event, context):
    print("[AllergenLambda] Event keys:", list(event.keys()))

    dishes     = event.get("dishes", [])
    place_id   = event.get("place_id")
    name       = event.get("name", "")
    address    = event.get("address", "")
    menu_url   = event.get("menu_url", "")
    email      = event.get("email", "")
    add_to_list = event.get("addToList", False)

    if not dishes:
        print("[AllergenLambda] No dishes received — passing through empty list.")
        return {**event, "dishes": []}

    enriched_dishes = run_allergen_detection(dishes)
    print(f"[AllergenLambda] Allergen detection complete for {len(enriched_dishes)} dish(es).")

    return {
        "statusCode": 200,
        "dishes": enriched_dishes,
        "menu_url": menu_url,
        "place_id": place_id,
        "name": name,
        "address": address,
        "email": email,
        "addToList": add_to_list,
    }
