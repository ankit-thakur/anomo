# Menu Analysis App

A full-stack application that analyzes restaurant menus to identify allergens and dietary restriction conflicts, helping users find dishes that are safe for them to eat.

---

## Project Structure

```
workplace/MenuAnalysis/
├── MenuAnalysisAppClient/          ← React Native / Expo frontend (TypeScript)
├── MenuAnalysisAppServer/          ← Python Lambda functions (backend)
│   └── lambdas/
│       ├── menu/                   ← Core pipeline, agents, API handlers
│       ├── search/                 ← Google Places integration
│       ├── auth/                   ← Cognito trigger handlers
│       └── layers/                 ← Lambda layer dependencies
├── MenuAnalysisAppCdk/             ← AWS CDK infrastructure (JavaScript)
│   ├── lib/                        ← CDK stack definitions
│   └── bin/cdk.js                  ← CDK app entry point
├── deploy_server.sh
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo), TypeScript, Expo Router |
| Authentication | AWS Cognito (OAuth 2.0, Hosted UI) |
| API | AWS API Gateway (REST) |
| Backend | Python 3.12, AWS Lambda |
| AI / ML | AWS Bedrock — Claude Sonnet 4 (agents + allergen reasoning), Claude Haiku (menu validation) |
| Agent Framework | Strands Agents (`strands-agents` — AWS-native, Bedrock-first) |
| Workflow | AWS Step Functions |
| Allergen KB | In-memory RAG — Amazon Titan Embed v2 embeddings, cosine similarity search |
| Database | AWS DynamoDB (NoSQL, pay-per-request) |
| Email | AWS SES |
| Infrastructure | AWS CDK (JavaScript / CloudFormation) |
| External APIs | Google Places API (restaurant search & details) |

---

## How It Works

### 1. Authentication
Users sign in through Cognito's Hosted UI. A pre-signup Lambda auto-confirms accounts, and a post-confirmation Lambda creates the user's record in DynamoDB.

### 2. Restaurant Search
The user types a restaurant name. The app calls Google Places TextSearch (`POST /searchPlaceId`) to find matching restaurants. When the user selects one, the app checks DynamoDB (`POST /queryRestaurants`) to see if the menu has already been analyzed.

- **Already analyzed:** restaurant details and menu items are returned immediately with per-user safety scoring.
- **Not yet analyzed:** the app fetches the restaurant's website URL from Google Places Details and proceeds to menu analysis.

### 3. Menu Analysis Pipeline (Async — Step Functions)

`POST /invokeAnalyzeMenu` starts an AWS Step Functions execution and returns immediately. The pipeline runs four agents in sequence, with a 60-minute overall timeout:

```
[Scraper Agent] → [Allergen Detection Agent] → [Verification Agent] → [Finalize Lambda]
```

#### Scraper Agent (`scraper_agent.py` + `scraper_lambda.py`)
- Crawls the restaurant website and ranks candidate menu URLs by keyword score
- Validates the top candidates with Claude Haiku (`is_menu()`) — cheap, fast LLM check
- Handles URL fragment anchors (`#food-section`): extracts the element subtree matching the fragment ID before fetching, scoping the content to just that section
- Supports both HTML menus (BeautifulSoup extraction) and PDF menus (pdfplumber extraction)
- Returns raw HTML as stripped plain text to keep agent context token-efficient

Output: `{dishes: [{name, price, description}]}`

#### Allergen Detection Agent (`allergen_agent.py` + `allergen_lambda.py`)
- Infers a realistic ingredient list for each dish using Claude Sonnet 4
- Deduplicates ingredient terms across all dishes and embeds them once via Amazon Titan Embed v2
- Searches the allergen knowledge base (in-memory cosine similarity) to retrieve grounded context per ingredient
- Classifies allergens and dietary restriction violations in batches of 15 dishes per LLM call, grounded in KB context
- Merges LLM results with a rule-based safety net (`apply_rules.py`)

Output: `{dishes: [{...name/price/desc, ingredients, allergens, allergen_reasoning, diet_restrictions}]}`

#### Verification Agent (`verification_agent.py` + `verification_lambda.py`)
- **Deterministic pre-pass:** flags ambiguous ingredients (`natural flavors`, `spices`, `sauce`) and `may contain` cross-contamination language
- **LLM batch pass (15 dishes/call):** reads the upstream `allergen_reasoning` and ingredient list to produce a `confidences` map per dish — a unified dict scoring every relevant allergen and dietary restriction
- Scoring bands:
  - `0.9+` Ingredient explicitly named
  - `0.7–0.89` Clearly present via well-known compound (e.g. parmesan → dairy)
  - `0.5–0.69` Reasonably inferred
  - `0.3–0.49` Possible due to ambiguous ingredient
  - `<0.1` Essentially ruled out
- Thresholds the `confidences` map at `0.5` to produce confirmed `allergens` and `diet_restrictions` maps — only confirmed items are stored, with their confidence score inline
- Catches false positives (e.g. coconut milk → not dairy) and corrects upstream mistakes

Output: `{dishes: [{...allergen_reasoning, allergens: {dairy: 0.95}, diet_restrictions: {vegan: 0.99}, flags, allergen_notes}]}`

#### Finalize Lambda (`finalize_lambda.py`)
- Writes restaurant metadata to `RestaurantTable`
- Writes all menu items to `MenuItemsTable` (all numeric values stored as `Decimal` per DynamoDB requirements)
- Optionally adds the user to the email list
- Sends notification email via SES

### 4. Safety Scoring (On Page Load)

When the frontend fetches a restaurant or its menu items with a `userId`, the backend computes per-user safety scores on the fly against the user's saved preferences in `UserPreferencesTable`:

- **`unsafe`** — allergen/diet confidence ≥ 0.7 (clearly confirmed)
- **`caution`** — allergen/diet confidence ≥ 0.5 (confirmed, lower certainty)
- **`safe`** — allergen/diet not present in the dish's confirmed maps

Each dish gets a `classification` field. The response also includes a restaurant-level `safety_score` summary:

```json
{
  "score_pct": 72,
  "safe_count": 90,
  "caution_count": 10,
  "unsafe_count": 25,
  "total_dishes": 125
}
```

Scoring handles both new records (allergens as confidence maps) and old records (allergens as plain lists) transparently.

---

## Allergen Knowledge Base (`lambdas/menu/rag/`)

The KB is a static, pre-embedded dataset loaded once per Lambda cold start — no external vector database required.

| File | Purpose |
|---|---|
| `allergen_kb_data.json` | Curated entries for FDA Big-9 allergens + sesame + mustard + 4 dietary restrictions (vegan, vegetarian, gluten-free, dairy-free). Each allergen entry includes direct sources, hidden names, common dishes, and cross-contact notes. Each dietary restriction entry includes violating ingredients, hidden violators, and commonly violated dishes. |
| `build_kb_embeddings.py` | One-time local script: embeds all KB entries + any `.txt`/`.pdf` files in `fda_docs/` using Amazon Titan Embed v2 → writes `allergen_kb_embeddings.json`. Re-run and commit whenever `allergen_kb_data.json` is updated. |
| `allergen_kb_embeddings.json` | Pre-computed embeddings (committed to repo). Loaded into Lambda memory at cold start. |
| `query_allergen_kb.py` | In-memory cosine similarity search. `search_allergen_kb_batch(terms)` deduplicates terms and embeds each unique one once, returning a cache dict `{term: [top-k results]}` used across all dishes in a batch. |
| `fda_docs/` | Drop FDA/FARE `.txt` or `.pdf` documents here to expand the KB. |

---

## Backend File Reference (`lambdas/menu/`)

```
agents/
  scraper_agent.py          ← Strands agent: crawl → find menu URL → extract dishes
  scraper_lambda.py         ← Lambda handler for Scraper Agent
  allergen_agent.py         ← Strands agent: ingredient enrichment + KB lookup + classification
  allergen_lambda.py        ← Lambda handler for Allergen Agent
  verification_agent.py     ← Batch LLM verification: unified confidences map, flags, allergen_notes
  verification_lambda.py    ← Lambda handler for Verification Agent
  finalize_lambda.py        ← DynamoDB writes + SES email

rag/
  allergen_kb_data.json     ← Curated allergen + dietary restriction knowledge base
  allergen_kb_embeddings.json ← Pre-computed Titan embeddings (committed, loaded at cold start)
  build_kb_embeddings.py    ← Local script to regenerate embeddings
  query_allergen_kb.py      ← In-memory cosine search helpers

dish_extraction.py          ← BeautifulSoup HTML parsing → section blocks → dish extraction
ingredient_enrichment.py    ← Batched Claude calls to infer ingredients per dish
apply_rules.py              ← Rule-based allergen + diet classification (safety net)
get_menu.py                 ← Website crawling, menu URL validation, PDF/HTML fetching
                               Fragment-aware: resolves #anchor IDs to element subtrees
extract_links.py            ← Keyword-scored candidate link discovery
invoke_model.py             ← Bedrock client wrapper (batching, retry, backoff)
scoring.py                  ← score_dish() / score_restaurant() — per-user safety classification
get_restaurant_data.py      ← GET /getRestaurant and /getMenuItems — includes safety scoring
query_restaurants.py        ← DynamoDB lookup used during search flow
update_tables.py            ← Legacy DynamoDB write helpers
user_preferences_handler.py ← Save/load user allergen + diet preferences
send_email.py               ← SES notification email
analyze_menu_handler.py     ← POST /invokeAnalyzeMenu — validates request, starts Step Function
```

---

## Infrastructure (`MenuAnalysisAppCdk/lib/`)

| CDK Stack | Key Resources |
|---|---|
| `dynamodb-stack.js` | RestaurantTable, MenuItemsTable, UsersTable, UserPreferencesTable, EmailListTable, ConnectionIdTable |
| `lambda-layers-stack.js` | Shared layers: boto3, requests, BeautifulSoup4, pdfplumber, OpenAI SDK, dotenv, Strands Agents (public ECR layer) |
| `cognito-stack.js` | Cognito User Pool, App Client, OAuth, pre/post-confirmation Lambda triggers |
| `step-function-lambda-stack.js` | **Scraper → Allergen → Verification → Finalize** Step Functions chain; all agent Lambdas with Bedrock IAM permissions |
| `cdk-stack.js` | API Gateway REST APIs, restaurantDataLambda (with UserPreferencesTable read access + safety scoring), search Lambdas, menu analysis trigger Lambda |
| `ses-email-stack.js` | SES identity configuration |
| `websocket-stack.js` | API Gateway WebSocket for real-time status updates |
| `rag-stack.js` | RAG infrastructure |

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/searchPlaceId` | POST | Search restaurants via Google Places |
| `/searchPlaceDetails` | GET | Get restaurant website/address by place ID |
| `/queryRestaurants` | POST | Check if menu is already analyzed; return items |
| `/getMenu` | POST | Crawl website and find/validate menu URL |
| `/invokeAnalyzeMenu` | POST | Trigger async Step Functions pipeline |
| `/getRestaurant` | POST | Fetch restaurant details; include `safety_score` if `userId` provided |
| `/getMenuItems` | POST | Fetch all menu items; include per-dish `classification` and `safety_score` if `userId` provided |
| `/updateUsers` | POST | Save user allergen/diet preferences |

### `POST /getRestaurant` and `POST /getMenuItems` — optional scoring

Pass `userId` (Cognito `sub`) in the request body to receive safety scoring alongside data:

```json
{ "placeId": "ChIJ...", "userId": "d408e458-..." }
```

`/getRestaurant` response with `userId`:
```json
{
  "restaurantId": "ChIJ...",
  "name": "...",
  "safety_score": { "score_pct": 72, "safe_count": 90, "caution_count": 10, "unsafe_count": 25, "total_dishes": 125 }
}
```

`/getMenuItems` response with `userId`:
```json
{
  "dishes": [
    { "name": "...", "classification": "unsafe", "allergens": {"dairy": 0.95}, "diet_restrictions": {} },
    { "name": "...", "classification": "safe",   "allergens": {}, "diet_restrictions": {} }
  ],
  "safety_score": { "score_pct": 72, ... }
}
```

---

## DynamoDB Schema

### RestaurantTable
| Key | Type | Notes |
|---|---|---|
| `restaurantId` (PK) | String | Google Place ID |
| `name` | String | |
| `address` | String | |
| `menuUrl` | String | Analyzed menu URL |
| `updatedAt` | String | ISO timestamp |

### MenuItemsTable
| Key | Type | Notes |
|---|---|---|
| `restaurantId` (PK) | String | Google Place ID |
| `name` (SK) | String | Dish name |
| `price` | String | |
| `description` | String | |
| `ingredients` | List | Inferred ingredient list |
| `allergens` | Map | `{allergen_key: confidence}` — confirmed allergens (confidence ≥ 0.5) |
| `diet_restrictions` | Map | `{diet_key: confidence}` — confirmed dietary violations (confidence ≥ 0.5) |
| `allergen_reasoning` | String | Plain-English explanation from allergen agent |
| `allergen_notes` | String | Human-readable summary from verification agent |
| `flags` | List | `["ambiguous: natural flavors", "may_contain: ..."]` |

Allergen keys: `dairy` `egg` `fish` `shellfish` `tree_nut` `peanut` `wheat` `soy` `sesame` `mustard` `sulfite`
Diet keys (violation = dish is NOT safe for that diet): `vegan` `vegetarian` `gluten_free` `dairy_free`

### UserPreferencesTable
| Key | Type | Notes |
|---|---|---|
| `userId` (PK) | String | Cognito `sub` claim |
| `allergens` | List | Allergen keys the user cannot have |
| `dietaryRestrictions` | List | Diets the user follows (e.g. `["vegan", "gluten_free"]`) |
| `savedRestaurants` | List | Saved place IDs |

### UsersTable
| Key | Type | Notes |
|---|---|---|
| `userId` (PK) | String | Cognito `sub` claim |
| `email` | String | |
| `given_name` | String | |
| `family_name` | String | |

---

## Allergen & Dietary Restriction Keys

**Allergens** (confidence = how certain the allergen IS present):
`dairy` · `egg` · `fish` · `shellfish` · `tree_nut` · `peanut` · `wheat` · `soy` · `sesame` · `mustard` · `sulfite`

**Dietary restrictions** (confidence = how certain the dish VIOLATES the diet):
`vegan` · `vegetarian` · `gluten_free` · `dairy_free`

---

## Deployment

### Prerequisites

**1. Build allergen KB embeddings** (run once locally, re-run when `allergen_kb_data.json` changes):
```bash
cd MenuAnalysisAppServer/lambdas
python menu/rag/build_kb_embeddings.py
# Commit the output: menu/rag/allergen_kb_embeddings.json
```

**2. Strands layer** — uses the public AWS-managed layer, no build required. Version is pinned in `step-function-lambda-stack.js` (`STRANDS_LAYER_VERSION`). Check for updates at the [strands-agents GitHub releases](https://github.com/strands-agents/strands-agents).

### Deploy order

```bash
cd MenuAnalysisAppCdk
cdk deploy DdbStack           # DynamoDB tables (exports ARNs for other stacks)
cdk deploy LambdaLayersStack  # Shared Lambda layers
cdk deploy StepFunctionWithLambdasStack  # Agent Lambdas + Step Functions
cdk deploy CdkStack           # API Gateway + restaurantDataLambda + other handlers
```

Or deploy all at once:
```bash
cdk deploy --all
```

---

## Known Issues / Notes

- Google Places API key is embedded in `cdk-stack.js` and appears in CloudFormation templates. Move to AWS Secrets Manager for production.
- CORS is configured with `"*"`. Restrict to the app's domain for production.
- Cognito callback and logout URLs include hardcoded localhost/Expo URIs — update for production.
- Old `MenuItemsTable` records (written before the agent pipeline) store `allergens` and `diet_restrictions` as lists rather than confidence maps. The scoring module handles both formats transparently, treating list membership as a binary `unsafe` signal.
