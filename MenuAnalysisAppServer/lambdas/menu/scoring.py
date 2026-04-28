"""
Scoring module — computes per-dish safety classification and restaurant-level summary.

New schema (produced by verification_agent v2):
  dish['allergens']        — map  {allergen_key: confidence}  items confirmed present (>= 0.5)
  dish['diet_restrictions'] — map {diet_key: confidence}      items confirmed violated (>= 0.5)

Old schema (records written before the schema change):
  dish['allergens']        — list of confirmed allergen strings
  dish['diet_restrictions'] — list of confirmed violation strings

Both schemas are handled transparently.

Classification thresholds (applied to the score value inside the map):
  unsafe  — confidence >= UNSAFE_THRESHOLD  (0.7): clearly confirmed
  caution — confidence >= CAUTION_THRESHOLD (0.5): confirmed but lower certainty
  safe    — key not present in the map at all

For old-schema records (list instead of map) the classification is binary:
  key in list → unsafe, key not in list → safe.
"""

UNSAFE_THRESHOLD  = 0.7   # clearly confirmed — "butter listed explicitly"
CAUTION_THRESHOLD = 0.5   # confirmed but uncertain — "inferred from compound ingredient"


def _get_score(data, key: str) -> float:
    """
    Return the confidence score for key from allergens/diet_restrictions data.
    Handles both new schema (dict) and old schema (list).
    """
    if isinstance(data, dict):
        return float(data.get(key, 0.0))
    if isinstance(data, list):
        return 1.0 if key in data else 0.0
    return 0.0


def score_dish(dish: dict, user_allergens: list, user_diet_restrictions: list) -> str:
    """
    Returns 'unsafe', 'caution', or 'safe' for a single dish given user preferences.

    If user_allergens and user_diet_restrictions are both empty the dish is 'safe'
    regardless of its contents (no restrictions → no risk).
    """
    allergens_data = dish.get("allergens", {})
    diet_data      = dish.get("diet_restrictions", {})

    # First pass: unsafe (any high-confidence hit)
    for allergen in user_allergens:
        if _get_score(allergens_data, allergen) >= UNSAFE_THRESHOLD:
            return "unsafe"
    for diet in user_diet_restrictions:
        if _get_score(diet_data, diet) >= UNSAFE_THRESHOLD:
            return "unsafe"

    # Second pass: caution (confirmed but lower certainty)
    for allergen in user_allergens:
        if _get_score(allergens_data, allergen) >= CAUTION_THRESHOLD:
            return "caution"
    for diet in user_diet_restrictions:
        if _get_score(diet_data, diet) >= CAUTION_THRESHOLD:
            return "caution"

    return "safe"


def compute_allergen_summary(dishes: list) -> dict:
    """
    Distil a full dish list into a compact form for fast query-time scoring.
    Keeps only the allergen/diet_restriction confidence maps per dish —
    strips names, ingredients, descriptions, etc.

    Stored on RestaurantTable at ingest time so recommendations never need
    to read MenuItemsTable per restaurant.
    """
    return {
        "total_dishes": len(dishes),
        "dishes": [
            {
                "a": dish.get("allergens") or {},
                "d": dish.get("diet_restrictions") or {},
            }
            for dish in dishes
        ],
    }


def score_from_summary(summary: dict, user_allergens: list, user_diet_restrictions: list) -> dict | None:
    """
    Compute a safety_score dict from a stored dish_allergen_summary.
    Returns None when summary is missing or empty (restaurant not yet ingested).
    Output shape is identical to score_restaurant()'s safety_score dict.
    """
    if not summary or not summary.get("dishes"):
        return None

    minimal_dishes = [
        {"allergens": d.get("a", {}), "diet_restrictions": d.get("d", {})}
        for d in summary["dishes"]
    ]
    _, safety_score = score_restaurant(minimal_dishes, user_allergens, user_diet_restrictions)
    return safety_score


def score_restaurant(
    dishes: list,
    user_allergens: list,
    user_diet_restrictions: list,
) -> tuple[list, dict]:
    """
    Score every dish and compute a restaurant-level safety summary.

    Returns:
      scored_dishes — same list with 'classification' field added per dish
      safety_score  — {score_pct, safe_count, caution_count, unsafe_count, total_dishes}
    """
    safe_count = caution_count = unsafe_count = 0
    scored_dishes = []

    for dish in dishes:
        classification = score_dish(dish, user_allergens, user_diet_restrictions)
        scored_dishes.append({**dish, "classification": classification})
        if classification == "safe":
            safe_count += 1
        elif classification == "caution":
            caution_count += 1
        else:
            unsafe_count += 1

    total = len(dishes)
    score_pct = round(safe_count / total * 100) if total > 0 else 100

    safety_score = {
        "score_pct":     score_pct,
        "safe_count":    safe_count,
        "caution_count": caution_count,
        "unsafe_count":  unsafe_count,
        "total_dishes":  total,
    }
    return scored_dishes, safety_score
