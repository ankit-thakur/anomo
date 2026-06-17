"""
Allergen Detection Agent — Phase 2 of the agentic menu analysis pipeline.

Responsibilities:
  - Infer likely ingredients for each dish (reuses ingredient_enrichment.py)
  - Query the allergen knowledge base for each ingredient/dish
  - Use LLM reasoning grounded in KB context to identify direct + hidden allergens
  - Identify dietary restriction violations

Input  (from Scraper Agent):      {dishes: [{name, price, description}], ...passthrough}
Output (to Verification Agent):   {dishes: [{...name/price/desc, ingredients,
                                    allergens, allergen_reasoning, diet_restrictions}],
                                    ...passthrough}
"""

import json
import sys
import os

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)
sys.path.insert(0, os.path.join(_here, ".."))

from strands import Agent, tool
from strands.models import BedrockModel

from ingredient_enrichment import infer_ingredients
from apply_rules import classify_allergens, classify_dietary_restrictions
from rag.query_allergen_kb import search_allergen_kb_batch, format_kb_context, build_full_context_for_ingredients
from invoke_model import invoke_model_from_analyze_menu

CLAUDE_SONNET_4 = os.environ.get("CLAUDE_SONNET_4", "us.anthropic.claude-sonnet-4-20250514-v1:0")

# Dishes per LLM classification call — balances prompt size vs. number of API round trips.
# 15 dishes × ~200 tokens each ≈ 3k input tokens, well within Claude's context.
CLASSIFY_BATCH_SIZE = 15

SYSTEM_PROMPT = """You are an allergen detection agent for a restaurant menu analysis system.

Your job is to analyze each dish and identify ALL allergens — both obvious and hidden.

For each dish you receive, you should:
1. Use enrich_dish_ingredients to infer the ingredient list.
2. Use lookup_allergen_context to query the allergen knowledge base for those ingredients.
3. Use classify_dish_allergens to combine the KB context with your reasoning to produce
   a final allergen list, dietary restriction flags, and a plain-English reasoning explanation.

Key principles:
- Go beyond keyword matching. Reason about whether an ingredient COULD contain an allergen.
  Example: "mole sauce" → likely contains tree nuts (almonds); "caesar dressing" → contains anchovies (fish) and egg.
- Flag hidden allergens in sauces, dressings, and compound ingredients.
- When uncertain, err on the side of caution and flag the allergen with a note.
- Return structured JSON for every dish — never skip a dish.
"""


@tool
def enrich_dish_ingredients(dishes_json: str) -> str:
    """
    Given a JSON array of dish objects (with name, price, description),
    infer a realistic ingredient list for each dish using an LLM.
    Returns a JSON array of enriched dish objects with an 'ingredients' field added.
    """
    print(f"[AllergenAgent] Enriching ingredients for dishes...")
    try:
        dishes = json.loads(dishes_json)
        enriched = infer_ingredients(dishes)
        print(f"[AllergenAgent] Enriched {len(enriched)} dish(es) with ingredients.")
        return json.dumps(enriched)
    except Exception as e:
        print(f"[AllergenAgent] enrich_dish_ingredients failed: {e}")
        return dishes_json  # pass through unchanged on failure


@tool
def lookup_allergen_context(ingredients_json: str) -> str:
    """
    Query the allergen knowledge base for a list of ingredients or dish names.
    Returns a formatted context string with relevant allergen information for each ingredient.
    Use this before classify_dish_allergens to ground the classification in official knowledge.

    Input: JSON array of ingredient/dish name strings.
           Example: ["mole sauce", "tahini", "caesar dressing", "natural flavors"]
    Output: Multi-line context string with allergen KB matches per ingredient.
    """
    print(f"[AllergenAgent] Looking up allergen KB context...")
    try:
        ingredients = json.loads(ingredients_json)
        context = build_full_context_for_ingredients(ingredients)
        print(f"[AllergenAgent] KB context length: {len(context)} chars")
        return context
    except Exception as e:
        print(f"[AllergenAgent] lookup_allergen_context failed: {e}")
        return "Allergen KB lookup failed — proceed with best-effort classification."


@tool
def classify_dish_allergens(dish_json: str, kb_context: str) -> str:
    """
    Classify allergens for a single dish using its ingredients + allergen KB context.
    Reasons about hidden allergens in sauces and compound ingredients.

    Returns a JSON object with:
      - allergens: list of allergen category strings (e.g., ["dairy", "fish", "tree_nut"])
      - allergen_reasoning: plain-English explanation of why each allergen was flagged
      - diet_restrictions: list of dietary restriction violations (e.g., ["vegan", "gluten_free"])

    Input dish_json example:
      {"name": "Caesar Salad", "ingredients": ["romaine", "parmesan", "caesar dressing", "croutons"]}
    """
    print(f"[AllergenAgent] Classifying allergens for a dish...")
    try:
        dish = json.loads(dish_json)
        ingredients = dish.get("ingredients", [])

        # Step 1: rule-based pass as baseline (fast, catches obvious ones)
        rule_allergens = set(classify_allergens(ingredients))
        rule_violations = set(classify_dietary_restrictions(ingredients))

        # Step 2: LLM reasoning pass grounded in KB context
        prompt = f"""You are an allergen classification expert.

Allergen knowledge base context:
{kb_context}

Dish: {dish.get('name', 'Unknown')}
Description: {dish.get('description', '')}
Ingredients: {', '.join(ingredients)}

Task: Identify ALL allergens present in this dish, including hidden ones in sauces,
dressings, and compound ingredients. Also identify dietary restriction violations.

Rule-based detection already found these allergens (may be incomplete): {list(rule_allergens)}

Respond ONLY with a JSON object in this exact format:
{{
  "allergens": ["allergen1", "allergen2"],
  "allergen_reasoning": "Brief explanation of why each allergen is present, especially hidden ones.",
  "diet_restrictions": ["violation1", "violation2"]
}}

Use these allergen category names: dairy, egg, fish, shellfish, tree_nut, peanut, wheat, soy, sesame, mustard, sulfite
Use these dietary restriction names: vegan, vegetarian, pescatarian, gluten_free, dairy_free, egg_free, nut_free
"""
        response = invoke_model_from_analyze_menu(prompt, "", False, CLAUDE_SONNET_4, 1024)
        raw = response.strip() if isinstance(response, str) else str(response).strip()

        # Strip markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)

        # Merge rule-based allergens so we don't lose any
        llm_allergens = set(result.get("allergens", []))
        merged_allergens = sorted(rule_allergens | llm_allergens)
        llm_violations = set(result.get("diet_restrictions", []))
        merged_violations = sorted(rule_violations | llm_violations)

        return json.dumps({
            "allergens": merged_allergens,
            "allergen_reasoning": result.get("allergen_reasoning", ""),
            "diet_restrictions": merged_violations,
        })

    except Exception as e:
        print(f"[AllergenAgent] classify_dish_allergens failed: {e}")
        # Graceful fallback: rule-based only
        ingredients = json.loads(dish_json).get("ingredients", [])
        return json.dumps({
            "allergens": classify_allergens(ingredients),
            "allergen_reasoning": "Classification used rule-based fallback due to an error.",
            "diet_restrictions": classify_dietary_restrictions(ingredients),
        })


# ---------------------------------------------------------------------------
# Batch helpers — used by run_allergen_detection (bypass the agent loop)
# ---------------------------------------------------------------------------

def _build_dish_kb_context(dish: dict, kb_cache: dict) -> str:
    """Build KB context for a single dish from the pre-computed cache (no new embed calls)."""
    ingredients = dish.get("ingredients", [])
    lookup_terms = ingredients + [dish.get("name", "")]
    lines = []
    for term in lookup_terms:
        results = kb_cache.get(term, [])
        if results:
            lines.append(format_kb_context(term, results))
    return "\n\n".join(lines) if lines else "No allergen KB matches found."


def _classify_dishes_batch(dishes: list[dict], kb_cache: dict) -> list[dict]:
    """
    Classify allergens for a batch of dishes in a single LLM call.

    Returns a list (same length as dishes) of dicts:
      {allergens, allergen_reasoning, diet_restrictions}

    Falls back to rule-based classification per dish if the LLM call or parse fails.
    """
    dish_sections = []
    for idx, dish in enumerate(dishes):
        name        = dish.get("name", "Unknown")
        desc        = dish.get("description", "") or ""
        ingredients = dish.get("ingredients", [])
        kb_context  = _build_dish_kb_context(dish, kb_cache)
        rule_allergens = classify_allergens(ingredients)

        dish_sections.append(
            f"--- Dish {idx + 1}: {name} ---\n"
            f"Description: {desc}\n"
            f"Ingredients: {', '.join(ingredients) if ingredients else 'unknown'}\n"
            f"KB Context:\n{kb_context}\n"
            f"Rule-based allergens (may be incomplete): {rule_allergens}\n"
        )

    prompt = (
        f"You are an allergen and dietary restriction classification expert for a restaurant menu system.\n\n"
        f"For each of the {len(dishes)} dishes below, use the provided KB Context to identify:\n"
        f"1. ALL allergens — both obvious and hidden.\n"
        f"2. ALL dietary restriction violations — use the KB Context entries labeled [Vegan], [Vegetarian], [Gluten-Free], and [Dairy-Free].\n\n"
        f"Key rules:\n"
        f"- Hidden allergens: anchovies in caesar dressing → fish; mole sauce → tree nuts; "
        f"Worcestershire sauce → fish; soy sauce → wheat (unless tamari); miso → soy.\n"
        f"- Hidden dietary violations: chicken/beef/fish stock → not vegan/vegetarian; "
        f"fish sauce → not vegan/vegetarian; soy sauce → not gluten_free; "
        f"butter/ghee → not dairy_free; caesar dressing → not vegan (anchovies + egg).\n"
        f"- When uncertain, err on the side of caution and flag it.\n\n"
        + "\n".join(dish_sections) +
        f"\nReturn ONLY a JSON array with exactly {len(dishes)} objects, one per dish in the same order:\n"
        f'[{{"allergens": ["allergen1"], "allergen_reasoning": "One sentence explanation.", "diet_restrictions": ["restriction1"]}}, ...]\n\n'
        f"Allergen categories: dairy, egg, fish, shellfish, tree_nut, peanut, wheat, soy, sesame, mustard, sulfite\n"
        f"Dietary restriction names: vegan, vegetarian, gluten_free, dairy_free\n"
        f"Only include a dietary restriction in the list if the dish VIOLATES it (i.e. is NOT safe for that diet)."
    )

    try:
        response = invoke_model_from_analyze_menu(prompt, "", False, CLAUDE_SONNET_4, 4096)
        raw = response.strip() if isinstance(response, str) else str(response).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        classifications = json.loads(raw)
        if not isinstance(classifications, list) or len(classifications) != len(dishes):
            raise ValueError(
                f"Expected {len(dishes)} results, got "
                f"{len(classifications) if isinstance(classifications, list) else type(classifications)}"
            )

    except Exception as e:
        print(f"[AllergenAgent] Batch LLM classification failed: {e} — falling back to rule-based.")
        return [
            {
                "allergens": classify_allergens(d.get("ingredients", [])),
                "allergen_reasoning": "Batch classification failed — used rule-based fallback.",
                "diet_restrictions": classify_dietary_restrictions(d.get("ingredients", [])),
            }
            for d in dishes
        ]

    # Merge LLM results with rule-based allergens (rule-based as safety net)
    results = []
    for dish, cls in zip(dishes, classifications):
        ingredients = dish.get("ingredients", [])
        rule_allergens  = set(classify_allergens(ingredients))
        rule_violations = set(classify_dietary_restrictions(ingredients))
        llm_allergens   = set(cls.get("allergens", []))
        llm_violations  = set(cls.get("diet_restrictions", []))
        results.append({
            "allergens":          sorted(rule_allergens | llm_allergens),
            "allergen_reasoning": cls.get("allergen_reasoning", ""),
            "diet_restrictions":  sorted(rule_violations | llm_violations),
        })

    return results


def build_allergen_agent() -> Agent:
    model = BedrockModel(
        model_id=CLAUDE_SONNET_4,
        temperature=0.1,
    )
    return Agent(
        model=model,
        tools=[enrich_dish_ingredients, lookup_allergen_context, classify_dish_allergens],
        system_prompt=SYSTEM_PROMPT,
    )


def run_allergen_detection(dishes: list[dict]) -> list[dict]:
    """
    Run allergen detection on a list of dishes.
    Returns the same list enriched with: ingredients, allergens, allergen_reasoning, diet_restrictions.

    Optimized for large menus (100+ dishes):
      - Ingredient enrichment: batched at 15 dishes/call (handled by infer_ingredients)
      - KB lookups: deduplicated — each unique ingredient is embedded exactly once,
        regardless of how many dishes share it
      - Allergen classification: batched at CLASSIFY_BATCH_SIZE dishes/call,
        reducing 165 sequential LLM calls to ~11
    """
    if not dishes:
        return []

    # Step 1: Enrich all dishes with ingredients (already batched inside infer_ingredients)
    print(f"[AllergenAgent] Enriching {len(dishes)} dish(es) with ingredients...")
    enriched_dishes = infer_ingredients(dishes)

    # Step 2: Deduplicate KB lookups — collect every unique term, embed once
    all_terms: set[str] = set()
    for dish in enriched_dishes:
        for ing in dish.get("ingredients", []):
            if ing:
                all_terms.add(ing)
        name = dish.get("name", "")
        if name:
            all_terms.add(name)

    print(f"[AllergenAgent] KB lookup: {len(all_terms)} unique terms across {len(enriched_dishes)} dishes...")
    kb_cache = search_allergen_kb_batch(list(all_terms), top_k=3)

    # Step 3: Batch allergen classification
    total_batches = (len(enriched_dishes) + CLASSIFY_BATCH_SIZE - 1) // CLASSIFY_BATCH_SIZE
    print(f"[AllergenAgent] Classifying in {total_batches} batch(es) of up to {CLASSIFY_BATCH_SIZE} dishes...")

    results = []
    for i in range(0, len(enriched_dishes), CLASSIFY_BATCH_SIZE):
        batch = enriched_dishes[i:i + CLASSIFY_BATCH_SIZE]
        batch_num = i // CLASSIFY_BATCH_SIZE + 1
        print(f"[AllergenAgent] Batch {batch_num}/{total_batches} — {len(batch)} dish(es)...")

        classifications = _classify_dishes_batch(batch, kb_cache)

        for dish, cls in zip(batch, classifications):
            results.append({
                **dish,
                "allergens":          cls["allergens"],
                "allergen_reasoning": cls["allergen_reasoning"],
                "diet_restrictions":  cls["diet_restrictions"],
            })

    print(f"[AllergenAgent] Done. {len(results)} dishes classified.")
    return results
