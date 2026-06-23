"""
GET /getRecommendations  { userId, limit? }

Returns up to `limit` restaurants sorted by safety score for the user.

Scoring strategy:
  - Restaurants with a dish_allergen_summary (ingested) are scored against
    the user's allergen/diet profile and sorted by score_pct DESC.
  - Restaurants without a summary (not yet ingested) are appended at the
    end unranked so they still appear in the list.

The user profile is resolved from the request body if provided
(allergens / dietaryRestrictions), falling back to UserPreferencesTable
when only a userId is given. Passing prefs directly in the request avoids
any race condition between a client-side filter save and this call.
"""

import json
import os
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError

from scoring import score_from_summary

# ── DynamoDB ──────────────────────────────────────────────────────────────────

dynamodb = boto3.resource('dynamodb')

restaurant_table = dynamodb.Table(
    os.environ.get('RESTAURANT_TABLE', 'DdbStack-RestaurantTableBDE2029A-1QA3XQE9B836T')
)
user_preferences_table = dynamodb.Table(
    os.environ.get('USER_PREFERENCES_TABLE', 'DdbStack-UserPreferencesTable')
)

RECOMMENDATION_LIMIT = 10

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}


class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


# ── Handler ───────────────────────────────────────────────────────────────────

def get_recommendations(event, context):
    body = json.loads(event.get('body') or '{}')

    user_id    = body.get('userId')
    limit      = int(body.get('limit', RECOMMENDATION_LIMIT))

    # Prefer prefs sent inline (avoids race condition with a recent save).
    # Fall back to server-stored prefs when only userId is provided.
    user_allergens = body.get('allergens')
    user_diets     = body.get('dietaryRestrictions')

    if (user_allergens is None or user_diets is None) and user_id:
        user_allergens, user_diets = _fetch_user_prefs(user_id)

    user_allergens = user_allergens or []
    user_diets     = user_diets     or []

    # ── Scan RestaurantTable ──────────────────────────────────────────────────
    try:
        restaurants = _scan_all(restaurant_table)
    except Exception as e:
        print(f'[get_recommendations] scan failed: {e}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'message': 'Failed to fetch restaurants'}),
        }

    # ── Score and partition ───────────────────────────────────────────────────
    scored   = []
    unscored = []

    for r in restaurants:
        summary = r.pop('dish_allergen_summary', None)   # strip from response
        if summary:
            safety_score = score_from_summary(summary, user_allergens, user_diets)
            r['safety_score'] = safety_score
            scored.append(r)
        else:
            r['safety_score'] = None
            unscored.append(r)

    # Sort scored restaurants best-first, append unscored at the end
    scored.sort(key=lambda r: (r['safety_score'] or {}).get('score_pct', 0), reverse=True)

    results = (scored + unscored)[:limit]

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(results, cls=_DecimalEncoder),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_user_prefs(user_id: str) -> tuple[list, list]:
    try:
        resp  = user_preferences_table.get_item(Key={'userId': user_id})
        prefs = resp.get('Item', {})
        return prefs.get('allergens', []), prefs.get('dietaryRestrictions', [])
    except Exception as e:
        print(f'[get_recommendations] prefs fetch failed: {e}')
        return [], []


def _scan_all(table) -> list:
    """Full table scan with automatic pagination."""
    items = []
    resp  = table.scan()
    items.extend(resp.get('Items', []))
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(ExclusiveStartKey=resp['LastEvaluatedKey'])
        items.extend(resp.get('Items', []))
    return items
