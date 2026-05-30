"""
Verification Agent — Phase 3 of the agentic menu analysis pipeline.

Responsibilities:
  - Reconcile allergens and diet restrictions against the ingredient list and
    allergen_reasoning produced by the Allergen Agent
  - Assign a per-item confidence score for every allergen and dietary restriction,
    stored in a single unified 'confidences' map
  - Derive the confirmed allergens / diet_restrictions lists from that map
  - Produce human-readable allergen_notes and structured flags

Input  (from Allergen Agent):   {dishes: [{name, price, description, ingredients,
                                  allergens, allergen_reasoning, diet_restrictions}]}
Output (to DynamoDB + Email):   {dishes: [{...all above,
                                  confidences, allergens (corrected),
                                  diet_restrictions (corrected),
                                  flags, allergen_notes}]}

confidences map semantics:
  allergen keys  (dairy, egg, fish, …) — confidence the allergen IS present   (0=absent, 1=certain)
  diet keys      (vegan, gluten_free, …) — confidence the dish VIOLATES the diet (0=safe,  1=certain)

Confirmed lists are derived by thresholding confidences at CONFIRM_THRESHOLD (0.5).
Items scored below the threshold are retained in confidences so the frontend can show
borderline cases (e.g. dairy=0.12 → "dairy was considered and likely absent").

Confidence score guide:
  0.9+     Ingredient explicitly named in the list
  0.7–0.89 Clearly present via a well-known compound (e.g. parmesan → dairy)
  0.5–0.69 Inferred with reasonable confidence
  0.3–0.49 Possible but uncertain (ambiguous terms like 'spices', 'sauce')
  0.1–0.29 Flagged but likely incorrect — contradicted by reasoning or ingredients
  <0.1     Essentially ruled out
"""

import json
import re
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)
sys.path.insert(0, os.path.join(_here, ".."))

from invoke_model import invoke_model_from_analyze_menu

CLAUDE_SONNET_4 = os.environ.get("CLAUDE_SONNET_4", "us.anthropic.claude-sonnet-4-20250514-v1:0")

VERIFY_BATCH_SIZE      = 25
MAX_CONCURRENT_BATCHES = 5
CONFIRM_THRESHOLD  = 0.5   # confidences >= this go into the confirmed allergens/diet_restrictions lists

# Used to distinguish allergen keys from diet restriction keys in the unified confidences map
ALLERGEN_KEYS = {"dairy", "egg", "fish", "shellfish", "tree_nut", "peanut",
                 "wheat", "soy", "sesame", "mustard", "sulfite"}
DIET_KEYS     = {"vegan", "vegetarian", "gluten_free", "dairy_free"}

# ---------------------------------------------------------------------------
# Deterministic pre-pass (fast, no LLM)
# ---------------------------------------------------------------------------

AMBIGUOUS_INGREDIENT_PATTERNS = [
    r"\bnatural flavors?\b", r"\bartificial flavors?\b",
    r"\bspices?\b", r"\bseasonings?\b",
    r"\bsauce\b", r"\bgravy\b", r"\bdressing\b",
    r"\bbroth\b", r"\bstock\b",
    r"\bextract\b", r"\bflavoring\b",
    r"\bother ingredients\b", r"\bmixed herbs?\b", r"\bherbs and spices\b",
]

MAY_CONTAIN_PATTERNS = [
    r"\bmay contain\b",
    r"\bprocessed (in|on|with) (a )?shared\b",
    r"\bmanufactured (in|on) (a )?shared\b",
    r"\btrace(s)? of\b",
    r"\bcross.?contact\b", r"\bcross.?contamination\b",
    r"\bsame (facility|kitchen|fryer|equipment)\b",
    r"\bmade (in|on) equipment (that|which) also processes\b",
]

FALLBACK_PATTERNS = [r"\bfallback\b", r"\brule.?based fallback\b",
                     r"\bbatch classification failed\b", r"\bparse error\b"]


def _get_ambiguous_flags(ingredients: list[str]) -> list[str]:
    flags = []
    for ing in ingredients:
        ing_lower = ing.lower().strip()
        for pattern in AMBIGUOUS_INGREDIENT_PATTERNS:
            if re.search(pattern, ing_lower):
                flags.append(f"ambiguous: {ing}")
                break
    return flags


def _get_may_contain_flags(text: str) -> list[str]:
    flags = []
    text_lower = (text or "").lower()
    for pattern in MAY_CONTAIN_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            start = max(0, match.start() - 10)
            end   = min(len(text_lower), match.end() + 30)
            flags.append(f"may_contain: ...{text_lower[start:end].strip()}...")
    return flags


def _used_fallback(reasoning: str) -> bool:
    text = (reasoning or "").lower()
    return any(re.search(p, text) for p in FALLBACK_PATTERNS)


# ---------------------------------------------------------------------------
# LLM batch verification
# ---------------------------------------------------------------------------

def _verify_dishes_batch(dishes: list[dict], prepass_flags: list[list[str]]) -> list[dict]:
    """
    LLM pass: assign a unified confidences map per dish, produce flags and allergen_notes.
    Returns a list (same length as dishes) of dicts with keys:
      confidences, flags, allergen_notes
    Falls back to _deterministic_fallback per dish if the LLM call or parse fails.
    """
    dish_sections = []
    for idx, dish in enumerate(dishes):
        name        = dish.get("name", "Unknown")
        description = dish.get("description", "") or ""
        ingredients = dish.get("ingredients", [])
        allergens   = dish.get("allergens", [])
        reasoning   = dish.get("allergen_reasoning", "") or ""
        diet_rest   = dish.get("diet_restrictions", [])
        pre_flags   = prepass_flags[idx]
        fallback    = _used_fallback(reasoning)

        dish_sections.append(
            f"--- Dish {idx + 1}: {name} ---\n"
            f"Description: {description}\n"
            f"Ingredients: {', '.join(ingredients) if ingredients else 'none listed'}\n"
            f"Allergens flagged upstream: {allergens}\n"
            f"Allergen reasoning: {reasoning}\n"
            f"Diet restrictions flagged upstream (dish VIOLATES these): {diet_rest}\n"
            f"Pre-pass flags: {pre_flags}\n"
            f"Upstream used fallback: {fallback}\n"
        )

    prompt = (
        f"You are a food safety expert verifying allergen and dietary restriction "
        f"classifications for {len(dishes)} restaurant dishes.\n\n"

        f"For each dish, produce a 'confidences' map scoring every relevant allergen and "
        f"dietary restriction. Scores mean:\n"
        f"  allergen keys  — how confident you are the allergen IS present (0=absent, 1=certain)\n"
        f"  diet keys      — how confident the dish VIOLATES that diet (0=safe, 1=certain violation)\n\n"

        f"Scoring — use qualitative judgment, not arithmetic:\n"
        f"  0.9+     Ingredient explicitly named (e.g. 'milk', 'wheat flour', 'shrimp')\n"
        f"  0.7–0.89 Clearly present via a well-known compound (e.g. parmesan → dairy, "
        f"caesar dressing → fish/egg)\n"
        f"  0.5–0.69 Reasonably inferred but some uncertainty\n"
        f"  0.3–0.49 Possible due to ambiguous ingredient (natural flavors, spices, sauce)\n"
        f"  0.1–0.29 Likely incorrect — contradicted by reasoning or ingredient list\n"
        f"  <0.1     Essentially ruled out\n\n"

        f"What to include in confidences:\n"
        f"  - Every allergen/diet the upstream agent flagged, even if you think it's wrong "
        f"(score it low so the consumer knows it was considered)\n"
        f"  - Any allergen/diet you believe the upstream agent MISSED\n\n"

        f"Key facts to apply:\n"
        f"  - Coconut milk, almond milk, oat milk, rice milk → NOT dairy allergen (score ≤ 0.15)\n"
        f"  - Chicken, beef, pork, lamb, fish, shrimp, anchovies → violates vegan + vegetarian (score ≥ 0.95)\n"
        f"  - Milk, cream, butter, cheese, yogurt, ghee → violates dairy_free + vegan (score ≥ 0.90)\n"
        f"  - Wheat, flour, bread, pasta, most soy sauce, barley → violates gluten_free (score ≥ 0.90)\n"
        f"  - If allergen_reasoning says something was wrongly flagged → score ≤ 0.20\n"
        f"  - If upstream used fallback → be conservative, do not score anything above 0.65\n"
        f"  - If no ingredients listed → score all flagged items at ~0.40 (high uncertainty)\n\n"

        f"Also produce:\n"
        f"  flags — short strings noting corrections or issues, e.g.:\n"
        f'    "corrected: dairy scored 0.12 (coconut milk is not dairy)"\n'
        f'    "corrected: added vegan violation 0.99 (chicken present)"\n'
        f'    "possible_false_positive: wheat (no wheat ingredient found)"\n'
        f"  allergen_notes — 1–2 sentences summarising what a cautious consumer should know\n\n"

        + "\n".join(dish_sections)

        + f"\n\nReturn ONLY a JSON array with exactly {len(dishes)} objects, one per dish:\n"
        f'[{{"confidences": {{"dairy": 0.12, "vegan": 0.99}}, '
        f'"flags": ["corrected: dairy scored 0.12 (coconut milk is not dairy)"], '
        f'"allergen_notes": "No confirmed allergens."}}, ...]'
    )

    try:
        response = invoke_model_from_analyze_menu(prompt, "", False, CLAUDE_SONNET_4, 4096)
        raw = response.strip() if isinstance(response, str) else str(response).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        results = json.loads(raw)
        if not isinstance(results, list) or len(results) != len(dishes):
            raise ValueError(
                f"Expected {len(dishes)} results, got "
                f"{len(results) if isinstance(results, list) else type(results)}"
            )
        return results

    except Exception as e:
        print(f"[VerificationAgent] Batch LLM failed: {e} — using deterministic fallback.")
        return [_deterministic_fallback(dishes[i], prepass_flags[i]) for i in range(len(dishes))]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_confirmed_maps(confidences: dict) -> tuple[dict, dict]:
    """
    Split the unified confidences map into two confirmed maps (confidence >= CONFIRM_THRESHOLD).

    Returns:
      allergen_map       — {allergen_key: score}  allergen IS present
      diet_map           — {diet_key: score}       dish VIOLATES that diet
    """
    allergen_map = {k: v for k, v in confidences.items()
                    if k in ALLERGEN_KEYS and v >= CONFIRM_THRESHOLD}
    diet_map     = {k: v for k, v in confidences.items()
                    if k in DIET_KEYS and v >= CONFIRM_THRESHOLD}
    return allergen_map, diet_map


def _deterministic_fallback(dish: dict, pre_flags: list[str]) -> dict:
    """
    Used when the LLM call fails. Assigns conservative uniform scores to all
    previously flagged items, incorporating data-quality signals as score caps.
    """
    allergens  = dish.get("allergens", [])
    diet_rest  = dish.get("diet_restrictions", [])
    reasoning  = dish.get("allergen_reasoning", "") or ""
    ingredients = dish.get("ingredients", [])

    # Determine a base score from data quality signals
    if not ingredients:
        base = 0.40          # no ingredients — high uncertainty across the board
    elif _used_fallback(reasoning):
        base = 0.50          # fallback used — moderate uncertainty
    else:
        base = 0.65          # normal case without LLM verification

    # Ambiguous ingredients push the base down slightly
    ambiguous_count = sum(1 for f in pre_flags if f.startswith("ambiguous:"))
    base = round(max(0.30, base - ambiguous_count * 0.05), 2)

    confidences = {a: base for a in allergens}
    confidences.update({d: base for d in diet_rest})

    notes = f"Contains: {', '.join(allergens)}." if allergens else "No allergens detected."
    notes += " Verification used deterministic fallback — review manually."

    return {
        "confidences":    confidences,
        "flags":          pre_flags + ["verification_fallback"],
        "allergen_notes": notes,
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_verification(dishes: list[dict]) -> list[dict]:
    """
    Run verification over all dishes.

    Pipeline:
      1. Deterministic pre-pass — flag ambiguous ingredients and may-contain language.
      2. LLM batch verification — unified confidences map per dish.
      3. Derive confirmed allergens / diet_restrictions lists by thresholding confidences.

    Output fields added / replaced per dish:
      confidences        — unified dict: allergen and diet keys → confidence score (0–1)
      allergens          — confirmed allergens  (confidence >= CONFIRM_THRESHOLD)
      diet_restrictions  — confirmed violations (confidence >= CONFIRM_THRESHOLD)
      flags              — list of flag strings
      allergen_notes     — human-readable summary
    """
    if not dishes:
        return []

    # Step 1: deterministic pre-pass
    all_prepass_flags = []
    for dish in dishes:
        text = " ".join(filter(None, [dish.get("description", ""),
                                      dish.get("allergen_reasoning", "")]))
        all_prepass_flags.append(
            _get_ambiguous_flags(dish.get("ingredients", [])) +
            _get_may_contain_flags(text)
        )

    # Step 2: LLM batch verification (concurrent)
    batch_list = [
        (dishes[i:i + VERIFY_BATCH_SIZE], all_prepass_flags[i:i + VERIFY_BATCH_SIZE])
        for i in range(0, len(dishes), VERIFY_BATCH_SIZE)
    ]
    print(f"[VerificationAgent] Verifying {len(dishes)} dish(es) in {len(batch_list)} batch(es) (concurrent)...")

    ordered_verifications = [None] * len(batch_list)
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_BATCHES) as executor:
        future_to_idx = {
            executor.submit(_verify_dishes_batch, batch, flags): idx
            for idx, (batch, flags) in enumerate(batch_list)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            ordered_verifications[idx] = future.result()

    results = []
    for (batch, batch_flags), verifications in zip(batch_list, ordered_verifications):
        for dish, v in zip(batch, verifications):
            confidences = v.get("confidences", {})
            allergen_map, diet_map = _to_confirmed_maps(confidences)

            results.append({
                **dish,
                "allergens":         allergen_map,
                "diet_restrictions": diet_map,
                "flags":             v.get("flags",          batch_flags[batch.index(dish)]),
                "allergen_notes":    v.get("allergen_notes", ""),
            })

    print(f"[VerificationAgent] Done. {len(results)} dishes verified.")
    return results
