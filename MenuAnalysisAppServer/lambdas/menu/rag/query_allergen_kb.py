"""
In-memory allergen knowledge base search.

Loads allergen_kb_embeddings.json once per Lambda container lifetime, then
answers queries with cosine similarity — no external service required.

Used by the Allergen Detection Agent as a Strands tool.

To update the KB: run build_kb_embeddings.py locally and redeploy.
To scale beyond ~5k chunks: swap _load_embeddings() to read from S3 instead.
"""

import boto3
import json
import math
import os
from pathlib import Path
from functools import lru_cache

try:
    from dotenv import load_dotenv
    load_dotenv()  # local dev only — Lambda env vars are set via CDK
except ImportError:
    pass

EMBEDDINGS_PATH = Path(__file__).parent / "allergen_kb_embeddings.json"
DEFAULT_TOP_K = 5
MIN_SCORE = 0.65  # cosine similarity threshold — below this, results are too distant

region = os.environ.get("AWS_REGION", "us-east-1")
bedrock = boto3.client("bedrock-runtime", region_name=region)


# ---------------------------------------------------------------------------
# Embedding store — loaded once, reused across Lambda invocations
# ---------------------------------------------------------------------------

_KB: list[dict] | None = None


def _load_kb() -> list[dict]:
    global _KB
    if _KB is None:
        if not EMBEDDINGS_PATH.exists():
            raise FileNotFoundError(
                f"{EMBEDDINGS_PATH} not found. "
                "Run build_kb_embeddings.py to generate it."
            )
        print(f"Loading allergen KB from {EMBEDDINGS_PATH.name}...")
        with open(EMBEDDINGS_PATH) as f:
            _KB = json.load(f)
        print(f"  Loaded {len(_KB)} KB chunks into memory.")
    return _KB


# ---------------------------------------------------------------------------
# Cosine similarity (pure Python — no numpy dependency)
# ---------------------------------------------------------------------------

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _get_embedding(text: str) -> list[float]:
    response = bedrock.invoke_model(
        modelId="amazon.titan-embed-text-v2:0",
        body=json.dumps({"inputText": text}),
    )
    return json.loads(response["body"].read())["embedding"]


# ---------------------------------------------------------------------------
# Public search API
# ---------------------------------------------------------------------------

def search_allergen_kb(ingredient: str, top_k: int = DEFAULT_TOP_K) -> list[dict]:
    """
    Search the allergen KB for information about an ingredient, dish, or sauce.

    Args:
        ingredient: An ingredient name, dish name, sauce, or preparation to look up.
                    Examples: "mole sauce", "caesar dressing", "natural flavors", "tahini"
        top_k: Max number of results to return.

    Returns:
        List of dicts with keys: allergen, display_name, text, score, chunk_type, source.
        Sorted by relevance score descending. Results below MIN_SCORE are excluded.
    """
    kb = _load_kb()
    query_embedding = _get_embedding(ingredient)

    scored = []
    for chunk in kb:
        score = _cosine_similarity(query_embedding, chunk["embedding"])
        if score >= MIN_SCORE:
            scored.append({
                "allergen": chunk.get("allergen"),
                "display_name": chunk.get("display_name"),
                "text": chunk.get("text"),
                "score": round(score, 4),
                "chunk_type": chunk.get("chunk_type"),
                "source": chunk.get("source"),
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def search_allergen_kb_batch(ingredients: list[str], top_k: int = 3) -> dict[str, list]:
    """
    Search the allergen KB for multiple ingredients in one call.
    More efficient than calling search_allergen_kb() in a loop because
    the KB is only loaded once.

    Args:
        ingredients: List of ingredient or dish names.
        top_k: Results per ingredient.

    Returns:
        Dict mapping each ingredient to its list of KB results.
    """
    _load_kb()  # warm the cache before looping
    return {ing: search_allergen_kb(ing, top_k=top_k) for ing in ingredients}


def format_kb_context(ingredient: str, kb_results: list[dict]) -> str:
    """
    Format KB results into a concise context block for LLM prompts.
    Deduplicates by allergen to avoid repeating the same allergen multiple times.

    Returns a string like:
        Allergen knowledge base context for "caesar dressing":
        - [Fish] Caesar dressing almost always contains anchovies...
        - [Egg] Caesar dressing contains egg-based aioli...
    """
    if not kb_results:
        return f'No allergen KB matches found for "{ingredient}".'

    seen = set()
    lines = [f'Allergen knowledge base context for "{ingredient}":']
    for r in kb_results:
        key = (r["allergen"], r["chunk_type"])
        if key not in seen:
            seen.add(key)
            lines.append(f'  - [{r["display_name"]}] {r["text"]}')
    return "\n".join(lines)


def build_full_context_for_ingredients(ingredients: list[str]) -> str:
    """
    Convenience function: search KB for all ingredients and return
    a single formatted context block ready to inject into a prompt.
    """
    lines = []
    results_map = search_allergen_kb_batch(ingredients, top_k=3)
    for ingredient, results in results_map.items():
        if results:
            lines.append(format_kb_context(ingredient, results))
    return "\n\n".join(lines) if lines else "No allergen context found for these ingredients."


# ---------------------------------------------------------------------------
# Lambda handler (for testing KB queries directly)
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    ingredient = event.get("ingredient", "mole sauce")
    results = search_allergen_kb(ingredient)
    return {
        "statusCode": 200,
        "ingredient": ingredient,
        "results": results,
        "formatted_context": format_kb_context(ingredient, results),
    }
