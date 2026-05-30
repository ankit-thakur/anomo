"""
Split Batches Lambda — sits between Scraper and the parallel Map state.

Receives the full scraper output and partitions the dish list into N groups,
where N scales dynamically with the number of dishes. Each group carries the
passthrough fields (place_id, name, address, email, menu_url, addToList) so
that the downstream Allergen and Verification Lambdas receive a self-contained
event identical in shape to what they already expect.

Scaling formula:
  num_groups = clamp(ceil(dish_count / TARGET_DISHES_PER_GROUP), 1, MAX_GROUPS)

Examples (TARGET=25, MAX=5):
  15 dishes  → 1 group  (no parallelism for tiny menus)
  50 dishes  → 2 groups
  100 dishes → 4 groups
  150+ dishes → 5 groups (capped)
"""

import json
import math
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)
sys.path.insert(0, os.path.join(_here, ".."))

TARGET_DISHES_PER_GROUP = 25
MAX_GROUPS = 5


def lambda_handler(event, context):
    dishes = event.get("dishes", [])
    passthrough = {k: v for k, v in event.items() if k != "dishes"}

    num_dishes = len(dishes)
    print(f"[SplitBatches] {num_dishes} dish(es) to split.")

    if num_dishes == 0:
        return {"dish_groups": []}

    num_groups = max(1, min(MAX_GROUPS, math.ceil(num_dishes / TARGET_DISHES_PER_GROUP)))
    group_size = math.ceil(num_dishes / num_groups)

    dish_groups = [
        {"dishes": dishes[i:i + group_size], **passthrough}
        for i in range(0, num_dishes, group_size)
    ]

    sizes = [len(g["dishes"]) for g in dish_groups]
    print(f"[SplitBatches] Created {len(dish_groups)} group(s) of sizes: {sizes}.")

    return {"dish_groups": dish_groups}
