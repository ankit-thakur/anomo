"""
Finalize Lambda — final state in the Step Functions menu analysis workflow.

Receives verified dishes from the Verification Agent and:
  1. Writes restaurant metadata to RestaurantTable
  2. Writes all menu items (with allergens, confidence_score, flags, allergen_notes) to MenuItemsTable
  3. Optionally adds the user to the email list
  4. Sends the notification email
"""

import json
import sys
import os
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)
sys.path.insert(0, os.path.join(_here, ".."))

from send_email import send_email
from scoring import compute_allergen_summary
from update_tables import update_restaurants_table

dynamodb = boto3.resource("dynamodb")


def _to_decimal(obj):
    """Recursively convert floats to Decimal — DynamoDB rejects float types."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_decimal(v) for v in obj]
    return obj

RESTAURANT_TABLE = os.environ['RESTAURANT_TABLE']
MENU_ITEMS_TABLE = os.environ['MENU_ITEMS_TABLE']
EMAIL_LIST_TABLE = os.environ['EMAIL_LIST_TABLE']


def _update_menu_items_table(restaurant_id, dishes):
    table = dynamodb.Table(MENU_ITEMS_TABLE)
    for dish in dishes:
        # allergens and diet_restrictions are now maps: {key: confidence_score}
        # Only confirmed items (confidence >= 0.5) are present.
        # allergen keys  (dairy, wheat, …): confidence allergen IS present
        # diet keys      (vegan, gluten_free, …): confidence dish VIOLATES that diet
        item = _to_decimal({
            "restaurantId":      restaurant_id,
            "name":              dish.get("name", ""),
            "price":             str(dish.get("price", "")),
            "description":       dish.get("description", ""),
            "ingredients":       dish.get("ingredients", []),
            "allergens":         dish.get("allergens", {}),
            "diet_restrictions": dish.get("diet_restrictions", {}),
            "allergen_reasoning": dish.get("allergen_reasoning", ""),
            "flags":             dish.get("flags", []),
            "allergen_notes":    dish.get("allergen_notes", ""),
        })
        table.put_item(Item=item)


def _add_to_email_list(email, add_to_list):
    if add_to_list and email:
        table = dynamodb.Table(EMAIL_LIST_TABLE)
        table.put_item(Item={"email": email})


def lambda_handler(event, context):
    print("[FinalizeLambda] Event keys:", list(event.keys()))

    dishes      = event.get("dishes", [])
    place_id    = event.get("place_id", "")
    name        = event.get("name", "")
    address     = event.get("address", "")
    menu_url    = event.get("menu_url", "")
    email       = event.get("email", "")
    add_to_list = event.get("addToList", False)

    print(f"[FinalizeLambda] Writing {len(dishes)} dish(es) for restaurant: {name} ({place_id})")

    summary = compute_allergen_summary(dishes)
    update_restaurants_table(place_id, name, address, menu_url, dish_allergen_summary=summary)
    _update_menu_items_table(place_id, dishes)
    _add_to_email_list(email, add_to_list)

    if email:
        try:
            send_email(email, place_id, name, dishes)
        except ClientError as e:
            print(f"[FinalizeLambda] Email send failed (non-fatal): {e}")

    return {
        "statusCode": 200,
        "place_id": place_id,
        "dishes_written": len(dishes),
        "message": f"Menu analysis complete for {name}.",
    }
