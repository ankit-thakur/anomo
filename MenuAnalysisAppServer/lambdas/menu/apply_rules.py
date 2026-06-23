ALLERGENS = {
    "milk": "dairy",
    "cheese": "dairy",
    "butter": "dairy",
    "cream": "dairy",
    "egg": "egg",
    "peanut": "peanut",
    "almond": "tree nut",
    "walnut": "tree nut",
    "bread": "gluten",
    "wheat": "gluten",
    "soy": "soy",
    "fish": "fish",
    "shrimp": "shellfish",
    "crab": "shellfish"
}

def classify_allergens(ingredients):
    found = set()
    for ing in ingredients:
        for k, v in ALLERGENS.items():
            if k in ing.lower():
                found.add(v)
    return list(found)


# Define dietary restrictions and their forbidden ingredients
DIETARY_RULES = {
    "vegan": {"meat", "fish", "dairy", "egg", "eggs", "honey", "gelatin"},
    "vegetarian": {"meat", "fish", "gelatin"},
    "pescatarian": {"meat"},
    "gluten_free": {"wheat", "barley", "rye"},
    "dairy_free": {"dairy"},
    "egg_free": {"egg"},
    "nut_free": {"nuts", "peanuts", "almonds", "cashews"},
}

def classify_dietary_restrictions(ingredients: list[str]) -> dict:
    """
    Classify a dish's dietary compliance and violations.
    
    Args:
        ingredients (list): list of lowercased ingredient keywords
    
    Returns:
        dict: {
            "compliant": [restrictions satisfied],
            "violations": {restriction: [conflicting ingredients]}
        }
    """
    results = {"compliant": [], "violations": {}}
    violations = []

    for restriction, forbidden in DIETARY_RULES.items():
        # Find intersection of dish ingredients with forbidden ones
        conflicts = [i for i in ingredients if i in forbidden]

        if conflicts:
            violations.append(restriction)
            results["violations"][restriction] = conflicts
        else:
            results["compliant"].append(restriction)

    return violations


def apply_rules(dish):
    allergens = classify_allergens(dish.get("ingredients", []))
    dietary = classify_dietary_restrictions(dish.get("ingredients", []))
    dish["allergens"] = allergens
    dish["diet_restrictions"] = dietary
    return dish
