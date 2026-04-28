"""
cleanup_stale_restaurants.py

Deletes restaurants from RestaurantTable that either:
  - have no `updatedAt` field, OR
  - were last updated before CUTOFF_DATE

Also deletes all MenuItems rows for each matched restaurant.

Usage:
    python cleanup_stale_restaurants.py              # dry run — prints what would be deleted
    python cleanup_stale_restaurants.py --execute    # performs the deletions
"""

import argparse
import sys
import boto3
from boto3.dynamodb.conditions import Key

# ── Config ────────────────────────────────────────────────────────────────────

RESTAURANT_TABLE = 'DdbStack-RestaurantTableBDE2029A-1QA3XQE9B836T'
MENU_ITEMS_TABLE = 'DdbStack-MenuItemsTableBDB50838-124BTKBL895OK'
REGION           = 'us-east-1'

# Restaurants updated on or after this date are kept (ISO prefix comparison)
CUTOFF_DATE = '2026-04-24'

# DynamoDB batch_write_item max is 25 per call
BATCH_SIZE = 25

# ── Helpers ───────────────────────────────────────────────────────────────────

def scan_all(table) -> list[dict]:
    """Full table scan with automatic pagination."""
    items = []
    resp  = table.scan()
    items.extend(resp.get('Items', []))
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(ExclusiveStartKey=resp['LastEvaluatedKey'])
        items.extend(resp.get('Items', []))
    return items


def is_stale(restaurant: dict) -> bool:
    updated_at = restaurant.get('updatedAt')
    if not updated_at:
        return True
    # ISO string prefix comparison: '2026-04-23T...' < '2026-04-24' is True
    return str(updated_at)[:10] < CUTOFF_DATE


def batch_delete(table, key_dicts: list[dict], table_name: str, dry_run: bool):
    """Delete items in batches of 25. Prints each batch."""
    for i in range(0, len(key_dicts), BATCH_SIZE):
        batch = key_dicts[i : i + BATCH_SIZE]
        if dry_run:
            continue
        dynamodb = boto3.resource('dynamodb', region_name=REGION)
        client   = boto3.client('dynamodb',   region_name=REGION)
        requests_payload = [{'DeleteRequest': {'Key': k}} for k in batch]

        # boto3 resource batch_writer is the cleanest API for this
        with table.batch_writer() as writer:
            for key in batch:
                writer.delete_item(Key=key)


def get_menu_item_keys(menu_items_table, restaurant_id: str) -> list[dict]:
    """Return all {restaurantId, name} keys for a restaurant's menu items."""
    resp  = menu_items_table.query(
        KeyConditionExpression=Key('restaurantId').eq(restaurant_id),
        ProjectionExpression='restaurantId, #n',
        ExpressionAttributeNames={'#n': 'name'},
    )
    keys  = [{'restaurantId': item['restaurantId'], 'name': item['name']}
             for item in resp.get('Items', [])]
    # Handle pagination (rare but possible for large menus)
    while 'LastEvaluatedKey' in resp:
        resp = menu_items_table.query(
            KeyConditionExpression=Key('restaurantId').eq(restaurant_id),
            ProjectionExpression='restaurantId, #n',
            ExpressionAttributeNames={'#n': 'name'},
            ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        keys.extend(
            {'restaurantId': item['restaurantId'], 'name': item['name']}
            for item in resp.get('Items', [])
        )
    return keys


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Delete stale restaurant records.')
    parser.add_argument('--execute', action='store_true',
                        help='Actually delete records (default is dry run)')
    args = parser.parse_args()
    dry_run = not args.execute

    dynamodb         = boto3.resource('dynamodb', region_name=REGION)
    restaurant_table = dynamodb.Table(RESTAURANT_TABLE)
    menu_items_table = dynamodb.Table(MENU_ITEMS_TABLE)

    print(f'Scanning {RESTAURANT_TABLE}…')
    all_restaurants = scan_all(restaurant_table)
    print(f'  Total restaurants: {len(all_restaurants)}')

    stale = [r for r in all_restaurants if is_stale(r)]
    print(f'  Stale (no updatedAt or updated before {CUTOFF_DATE}): {len(stale)}')

    if not stale:
        print('Nothing to delete.')
        return

    # Preview
    print(f'\n{"[DRY RUN] " if dry_run else ""}Restaurants to delete:')
    total_dish_keys: list[dict] = []
    restaurant_keys: list[dict] = []

    for r in stale:
        rid        = r.get('restaurantId', '?')
        name       = r.get('name', '(no name)')
        updated_at = r.get('updatedAt', '(none)')
        dish_keys  = get_menu_item_keys(menu_items_table, rid)

        print(f'  {rid:<45}  {name:<35}  updatedAt={updated_at}  dishes={len(dish_keys)}')

        restaurant_keys.append({'restaurantId': rid})
        total_dish_keys.extend(dish_keys)

    total_dishes = len(total_dish_keys)
    print(f'\nWill delete {len(stale)} restaurant(s) and {total_dishes} menu item(s).')

    if dry_run:
        print('\nDry run complete — no changes made.')
        print('Re-run with --execute to apply deletions.')
        return

    # Confirm before writing
    answer = input('\nType YES to confirm deletion: ').strip()
    if answer != 'YES':
        print('Aborted.')
        sys.exit(0)

    # Delete menu items first (child records)
    print(f'\nDeleting {total_dishes} menu items…')
    with menu_items_table.batch_writer() as writer:
        for key in total_dish_keys:
            writer.delete_item(Key=key)
    print('  Menu items deleted.')

    # Delete restaurants
    print(f'Deleting {len(stale)} restaurants…')
    with restaurant_table.batch_writer() as writer:
        for key in restaurant_keys:
            writer.delete_item(Key=key)
    print('  Restaurants deleted.')

    print('\nDone.')


if __name__ == '__main__':
    main()
