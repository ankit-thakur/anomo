# config.py

# Table names are injected as Lambda environment variables by CDK.
# Do not hardcode physical table names here.
import os
RESTAURANT_TABLE = os.environ.get('RESTAURANT_TABLE', '')
MENU_ITEMS_TABLE = os.environ.get('MENU_ITEMS_TABLE', '')

# Other global constants
DEBUG_MODE = True
LOG_LEVEL = 'INFO'
