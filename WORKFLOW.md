# Menu Analysis App — Workflow Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            MENU ANALYSIS APPLICATION                            │
├──────────────────┬──────────────────────────────────┬──────────────────────────┤
│    FRONTEND       │           BACKEND (AWS)           │     AWS INFRASTRUCTURE   │
│  (React Native/  │         (Lambda + API GW)         │    (CDK / CloudFormation) │
│    Expo TS)      │                                   │                          │
└──────────────────┴──────────────────────────────────┴──────────────────────────┘
```

---

## User Journey Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           1. AUTHENTICATION                                  │
│                                                                              │
│  User Opens App                                                              │
│       │                                                                      │
│       ▼                                                                      │
│  AuthContext checks token (AsyncStorage)                                     │
│       │                                                                      │
│       ├─── Token valid ──────────────────────► Home Screen                  │
│       │                                                                      │
│       └─── No token / expired ──► Sign In Page                              │
│                                        │                                     │
│                                        ▼                                     │
│                               Cognito Hosted UI (OAuth)                      │
│                                        │                                     │
│                                        ▼                                     │
│                              Pre-Signup Lambda                               │
│                         (auto-confirm user & email)                          │
│                                        │                                     │
│                                        ▼                                     │
│                             Post-Confirmation Lambda                         │
│                         (create user record in DynamoDB)                     │
│                                        │                                     │
│                                        ▼                                     │
│                          Access Token → AsyncStorage                         │
│                                        │                                     │
│                                        ▼                                     │
│                                  Home Screen                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        2. RESTAURANT SEARCH                                  │
│                                                                              │
│  User types restaurant name in SearchBar                                     │
│       │                                                                      │
│       ▼                                                                      │
│  POST /searchPlaceId                                                         │
│  search_places.py → Google Places TextSearch API                             │
│       │                                                                      │
│       ▼                                                                      │
│  Returns: [{place_id, name, address}]                                        │
│       │                                                                      │
│       ▼                                                                      │
│  User selects a result                                                       │
│       │                                                                      │
│       ▼                                                                      │
│  POST /queryRestaurants {place_id}                                           │
│  query_restaurants.py → DynamoDB RestaurantTable lookup                      │
│       │                                                                      │
│       ├─── Restaurant found (menu already analyzed) ──────────────────────► │
│       │    Return MenuItems from DynamoDB                                    │
│       │         │                                                            │
│       │         ▼                                                            │
│       │    Skip to step 5 (DISPLAY RESULTS)                                 │
│       │                                                                      │
│       └─── Restaurant NOT found ─────────────────────────────────────────► │
│            GET /searchPlaceDetails?placeId=...                               │
│            search_places.py → Google Places Details API                      │
│            Returns: {website, name, address}                                 │
│                 │                                                            │
│                 ▼                                                            │
│            Continue to step 3 (MENU DISCOVERY)                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        3. MENU DISCOVERY                                     │
│                                                                              │
│  POST /getMenu {website_url}                                                 │
│  get_menu.py                                                                 │
│       │                                                                      │
│       ▼                                                                      │
│  crawl_for_menu(website_url)                                                 │
│  extract_links.py: scrape all <a href> links from page                       │
│  Filter links containing keywords: "menu", "food", "drink", "dine"          │
│       │                                                                      │
│       ▼                                                                      │
│  For each candidate link:                                                    │
│       │                                                                      │
│       ├─── .pdf extension ──► Download PDF, extract text                    │
│       │                                                                      │
│       └─── HTML page ────────► Download HTML                                │
│                                        │                                     │
│                                        ▼                                     │
│                              is_menu() via Claude (Bedrock)                  │
│                              Haiku model validates if content                │
│                              is actually a restaurant menu                   │
│                                        │                                     │
│                                        ├── YES ──► Return menu URL           │
│                                        │                                     │
│                                        └── NO ───► Try next link            │
│       │                                                                      │
│       ▼                                                                      │
│  Returns: {is_menu: true/false, link: url}                                  │
│  Frontend shows MenuInputComponent pre-filled with detected URL             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        4. MENU ANALYSIS PIPELINE                             │
│                                                                              │
│  User confirms menu URL + enters email → Submit                             │
│       │                                                                      │
│       ▼                                                                      │
│  POST /invokeAnalyzeMenu                                                     │
│  {menu_url, place_id, name, address, email, addToList}                      │
│  analyze_menu_handler.py → Starts AWS Step Function                         │
│  Returns 200 immediately (async — user doesn't wait)                        │
│       │                                                                      │
│       ▼                                                                      │
│  ╔══════════════════════════════════════════════════════════════════════╗    │
│  ║            AWS STEP FUNCTION (async, up to 15 min)                   ║    │
│  ║                                                                      ║    │
│  ║  MenuAnalyzerLambda (10 GB memory, Python 3.12)                     ║    │
│  ║       │                                                              ║    │
│  ║       ▼                                                              ║    │
│  ║  STEP 1: extract_dishes(html_text)                                  ║    │
│  ║  dish_extraction.py                                                  ║    │
│  ║  • Fetch HTML from menu_url via requests                             ║    │
│  ║  • Parse with BeautifulSoup4                                         ║    │
│  ║  • Extract: {name, price, description} per dish                     ║    │
│  ║       │                                                              ║    │
│  ║       ▼                                                              ║    │
│  ║  STEP 2: infer_ingredients(dishes)                                  ║    │
│  ║  ingredient_enrichment.py + invoke_model.py                          ║    │
│  ║  • For each dish, call AWS Bedrock (Claude Sonnet 3.5/4)            ║    │
│  ║  • Prompt: infer typical ingredients from dish name/description      ║    │
│  ║  • Handles batching for large menus (chunk + overlap)                ║    │
│  ║  • Exponential backoff retry (max 4 retries on throttle)            ║    │
│  ║  • Returns: dishes + ingredients[]                                   ║    │
│  ║       │                                                              ║    │
│  ║       ▼                                                              ║    │
│  ║  STEP 3: apply_rules(dish)                                          ║    │
│  ║  apply_rules.py                                                      ║    │
│  ║  • Scan ingredients for FDA major allergens:                         ║    │
│  ║    milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy      ║    │
│  ║  • Check dietary restrictions:                                       ║    │
│  ║    vegetarian, vegan, dairy-free, gluten-free                        ║    │
│  ║  • Returns: dishes + allergens[] + diet_restrictions[]              ║    │
│  ║       │                                                              ║    │
│  ║       ▼                                                              ║    │
│  ║  STEP 4: update_restaurants_table()                                  ║    │
│  ║  update_tables.py                                                    ║    │
│  ║  DynamoDB PUT: {restaurantId, name, address, menuUrl, timestamp}    ║    │
│  ║       │                                                              ║    │
│  ║       ▼                                                              ║    │
│  ║  STEP 5: update_menu_items_table()                                  ║    │
│  ║  update_tables.py                                                    ║    │
│  ║  DynamoDB BATCH WRITE MenuItems:                                     ║    │
│  ║  {restaurantId+name → price, description, ingredients,              ║    │
│  ║                        allergens, diet_restrictions}                 ║    │
│  ║       │                                                              ║    │
│  ║       ▼                                                              ║    │
│  ║  STEP 6: send_email() (if email provided)                           ║    │
│  ║  send_email.py → AWS SES                                             ║    │
│  ║  Email user with analysis summary                                    ║    │
│  ╚══════════════════════════════════════════════════════════════════════╝    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        5. DISPLAY & FILTER RESULTS                           │
│                                                                              │
│  User selects allergens & dietary restrictions (FilterComponent)             │
│       │                                                                      │
│       ▼                                                                      │
│  POST /queryRestaurants {place_id}                                           │
│  Returns MenuItems from DynamoDB                                             │
│       │                                                                      │
│       ▼                                                                      │
│  Frontend filtering logic (HomeScreen.tsx):                                  │
│                                                                              │
│  For each menu item:                                                         │
│       │                                                                      │
│       ├─── item.allergens ∩ selectedAllergens ≠ ∅  ──► UNSAFE (red card)   │
│       │                                                                      │
│       ├─── item.diet_restrictions ∩ selectedDiets ≠ ∅ ─► UNSAFE (red card)│
│       │                                                                      │
│       └─── no overlap ─────────────────────────────► SAFE (green card)     │
│                                                                              │
│  MenuItemCard shows:                                                         │
│  • Dish name + price                                                         │
│  • Description                                                               │
│  • Matched allergen/restriction warnings (red items)                        │
│  • Safe indicator (green items)                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## AWS Infrastructure Map

```
                          ┌─────────────────────────────────────────┐
                          │           AWS Account (us-east-1)        │
                          │                                          │
  User/App               │   ┌──────────────┐   ┌──────────────┐   │
  ──────────►  API        │   │   Cognito    │   │  Step Fns    │   │
              Gateway     │   │  User Pool   │   │  State Mach. │   │
              (REST)      │   │  + App Client│   │  (15 min)    │   │
                          │   └──────┬───────┘   └──────┬───────┘   │
                          │          │                   │           │
                          │   ┌──────▼────────────────── ▼────────┐ │
                          │   │            Lambda Functions        │ │
                          │   │                                    │ │
                          │   │  search_places.py                  │ │
                          │   │  query_restaurants.py              │ │
                          │   │  get_menu.py                       │ │
                          │   │  analyze_menu_handler.py           │ │
                          │   │  analyze_menu.py (Step Fn)         │ │
                          │   │  get_restaurant_data.py            │ │
                          │   │  update_users_handler.py           │ │
                          │   │  pre_signup.py                     │ │
                          │   │  post_confirmation.py              │ │
                          │   └──────┬─────────────────────────────┘ │
                          │          │                                │
                          │    ┌─────▼──────┐  ┌─────────────────┐  │
                          │    │  DynamoDB  │  │  AWS Bedrock    │  │
                          │    │            │  │  Claude Sonnet  │  │
                          │    │ Restaurants│  │  3.5 / 4        │  │
                          │    │ MenuItems  │  │  (Haiku for     │  │
                          │    │ Users      │  │   validation)   │  │
                          │    │ EmailList  │  └─────────────────┘  │
                          │    │ ConnectionId│                       │
                          │    └────────────┘  ┌─────────────────┐  │
                          │                    │    AWS SES      │  │
                          │                    │  (Email notify) │  │
                          │                    └─────────────────┘  │
                          └─────────────────────────────────────────┘
                                                        │
                                                        ▼
                                             Google Places API
                                             (external — search
                                              & place details)
```

---

## Data Model

```
RestaurantTable
  PK: restaurantId (place_id from Google)
  ├── name
  ├── address
  ├── menuUrl
  └── analyzed (timestamp)

MenuItemsTable
  PK: restaurantId  SK: name
  ├── price
  ├── description
  ├── ingredients[]
  ├── allergens[]           ← from FDA list
  └── diet_restrictions[]   ← vegetarian/vegan/dairy-free/gluten-free

UsersTable
  PK: userId (Cognito sub)
  ├── email
  ├── given_name / family_name
  ├── email_verified
  └── preferences {allergens[], diet_restrictions[]}

EmailListTable
  PK: email
  └── (opted-in users for updates)
```

---

## CDK Stack Dependency Order

```
CognitoStack
     │
     ▼
DynamoDBStack
     │
     ▼
LambdaLayersStack
     │
     ▼
MainCdkStack  (API Gateway + most Lambdas)
     │
     ▼
StepFunctionLambdaStack  (MenuAnalyzerLambda + State Machine)
     │
     └── (also deploys: SesEmailStack, WebSocketStack,
                        UserPreferencesStack, RagStack)
```
