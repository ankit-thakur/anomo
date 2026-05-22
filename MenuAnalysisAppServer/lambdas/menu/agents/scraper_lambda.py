"""
Lambda handler for the Scraper Agent.
Invoked as the first state in the Step Functions menu analysis workflow.
"""

import json
import sys
import os

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)                    # /var/task/agents/ — finds scraper_agent
sys.path.insert(0, os.path.join(_here, ".."))  # /var/task/       — finds extract_links, dish_extraction, etc.

from scraper_agent import run_scraper


def lambda_handler(event, context):
    print("[ScraperLambda] Event:", json.dumps(event))

    body = event if isinstance(event, dict) else json.loads(event.get("body", "{}"))

    menu_url   = body.get("menu_url") or body.get("menuUrl")
    place_id   = body.get("place_id") or body.get("placeId")
    name       = body.get("name", "")
    address    = body.get("address", "")
    email      = body.get("email", "")
    add_to_list = body.get("addToList", False)
    user_id    = body.get("userId", "")

    if not menu_url:
        return {"statusCode": 400, "body": "menu_url is required"}

    dishes = run_scraper(menu_url)
    print(f"[ScraperLambda] Extracted {len(dishes)} dish(es) from {menu_url}")

    # Pass dishes + all original fields to the next Step Functions state
    return {
        "statusCode": 200,
        "dishes": dishes,
        "menu_url": menu_url,
        "place_id": place_id,
        "name": name,
        "address": address,
        "email": email,
        "addToList": add_to_list,
        "userId": user_id,
    }
