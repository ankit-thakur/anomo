"""
One-time script to generate allergen_kb_embeddings.json.

Run this locally whenever you update allergen_kb_data.json OR add new FDA/FARE
documents to the fda_docs/ folder. Commit the output file — Lambda loads it at
cold start with zero runtime cost.

Usage:
    python build_kb_embeddings.py

Inputs:
    - rag/allergen_kb_data.json       (curated structured KB)
    - rag/fda_docs/*.txt / *.pdf      (optional: drop FDA/FARE docs here)

Output:
    - rag/allergen_kb_embeddings.json (commit this file)

Requires env vars: AWS_REGION (see lambdas/.env)
Requires packages: boto3, pdfplumber (already Lambda layers in this project)
"""

import boto3
import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("pdfplumber not available — PDF ingestion skipped.")

SCRIPT_DIR = Path(__file__).parent
KB_DATA_PATH = SCRIPT_DIR / "allergen_kb_data.json"
FDA_DOCS_DIR = SCRIPT_DIR / "fda_docs"
OUTPUT_PATH = SCRIPT_DIR / "allergen_kb_embeddings.json"

CHUNK_SIZE = 800    # characters per chunk for free-text docs
CHUNK_OVERLAP = 150

region = os.environ.get("AWS_REGION", "us-east-1")
bedrock = boto3.client("bedrock-runtime", region_name=region)


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def get_embedding(text: str) -> list[float]:
    response = bedrock.invoke_model(
        modelId="amazon.titan-embed-text-v2:0",
        body=json.dumps({"inputText": text}),
    )
    return json.loads(response["body"].read())["embedding"]


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split free-form text into overlapping character-level chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start += chunk_size - overlap
    return [c for c in chunks if len(c) > 50]  # drop tiny trailing chunks


def chunks_from_structured_kb(entry: dict) -> list[dict]:
    """
    Convert one structured KB entry into searchable text chunks.
    Dispatches to the appropriate chunker based on entry type.
    Returns list of {text, allergen, display_name, chunk_type, source}.
    """
    if "diet_restriction" in entry:
        return _chunks_from_diet_restriction(entry)
    return _chunks_from_allergen(entry)


def _chunks_from_allergen(entry: dict) -> list[dict]:
    """Chunk an allergen entry (FDA Big-9 style)."""
    allergen = entry["allergen"]
    display_name = entry["display_name"]
    chunks = []

    direct = ", ".join(entry.get("direct_sources", []))
    chunks.append({
        "text": f"{display_name} allergen is directly present in: {direct}.",
        "allergen": allergen,
        "display_name": display_name,
        "chunk_type": "direct_sources",
        "source": "allergen_kb_data.json",
    })

    hidden = ", ".join(entry.get("hidden_names", []))
    if hidden:
        chunks.append({
            "text": f"{display_name} allergen may be hidden under alternate names or ingredients: {hidden}.",
            "allergen": allergen,
            "display_name": display_name,
            "chunk_type": "hidden_names",
            "source": "allergen_kb_data.json",
        })

    dishes = ", ".join(entry.get("common_dishes_containing", []))
    if dishes:
        chunks.append({
            "text": f"Common restaurant dishes that contain {display_name}: {dishes}.",
            "allergen": allergen,
            "display_name": display_name,
            "chunk_type": "common_dishes",
            "source": "allergen_kb_data.json",
        })

    notes_text = " ".join(filter(None, [
        entry.get("cross_contact_notes", ""),
        entry.get("notes", ""),
    ])).strip()
    if notes_text:
        chunks.append({
            "text": f"{display_name} allergen cross-contact and labeling notes: {notes_text}",
            "allergen": allergen,
            "display_name": display_name,
            "chunk_type": "notes",
            "source": "allergen_kb_data.json",
        })

    return chunks


def _chunks_from_diet_restriction(entry: dict) -> list[dict]:
    """
    Chunk a dietary restriction entry (vegan, vegetarian, gluten_free, dairy_free).
    Uses the 'diet_restriction' field as the 'allergen' key so the existing
    query/format pipeline works unchanged.
    """
    diet = entry["diet_restriction"]
    display_name = entry["display_name"]
    chunks = []

    violating = ", ".join(entry.get("violating_ingredients", []))
    if violating:
        chunks.append({
            "text": f"A dish is NOT {display_name} if it contains any of these ingredients: {violating}.",
            "allergen": diet,
            "display_name": display_name,
            "chunk_type": "violating_ingredients",
            "source": "allergen_kb_data.json",
        })

    hidden = ", ".join(entry.get("hidden_violators", []))
    if hidden:
        chunks.append({
            "text": f"These ingredients may not obviously violate {display_name} but they do: {hidden}.",
            "allergen": diet,
            "display_name": display_name,
            "chunk_type": "hidden_violators",
            "source": "allergen_kb_data.json",
        })

    violated_dishes = ", ".join(entry.get("commonly_violated_dishes", []))
    if violated_dishes:
        chunks.append({
            "text": f"Common restaurant dishes that are NOT {display_name}: {violated_dishes}.",
            "allergen": diet,
            "display_name": display_name,
            "chunk_type": "common_dishes",
            "source": "allergen_kb_data.json",
        })

    notes = entry.get("notes", "").strip()
    if notes:
        chunks.append({
            "text": f"{display_name} dietary restriction notes: {notes}",
            "allergen": diet,
            "display_name": display_name,
            "chunk_type": "notes",
            "source": "allergen_kb_data.json",
        })

    return chunks


def chunks_from_text_file(path: Path) -> list[dict]:
    """Chunk a plain .txt file (e.g., copied FDA webpage text)."""
    text = path.read_text(encoding="utf-8", errors="ignore")
    raw_chunks = chunk_text(text)
    return [
        {
            "text": c,
            "allergen": "general",
            "display_name": "FDA/FARE Reference",
            "chunk_type": "fda_document",
            "source": path.name,
        }
        for c in raw_chunks
    ]


def chunks_from_pdf(path: Path) -> list[dict]:
    """Chunk a PDF file using pdfplumber (already a Lambda layer)."""
    if not PDF_SUPPORT:
        print(f"  Skipping {path.name} — pdfplumber not installed.")
        return []
    full_text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            full_text += page_text + "\n"
    raw_chunks = chunk_text(full_text)
    return [
        {
            "text": c,
            "allergen": "general",
            "display_name": "FDA/FARE Reference",
            "chunk_type": "fda_document",
            "source": path.name,
        }
        for c in raw_chunks
    ]


# ---------------------------------------------------------------------------
# Main build
# ---------------------------------------------------------------------------

def build():
    all_chunks = []

    # 1. Structured curated KB
    print(f"Loading structured KB from {KB_DATA_PATH.name}...")
    with open(KB_DATA_PATH) as f:
        kb_entries = json.load(f)
    for entry in kb_entries:
        all_chunks.extend(chunks_from_structured_kb(entry))
    print(f"  {len(all_chunks)} chunks from structured KB.")

    # 2. FDA/FARE documents in fda_docs/ (optional)
    if FDA_DOCS_DIR.exists():
        doc_files = list(FDA_DOCS_DIR.glob("*.txt")) + list(FDA_DOCS_DIR.glob("*.pdf"))
        if doc_files:
            print(f"Found {len(doc_files)} document(s) in fda_docs/...")
            before = len(all_chunks)
            for doc_path in sorted(doc_files):
                print(f"  Processing {doc_path.name}...")
                if doc_path.suffix == ".pdf":
                    all_chunks.extend(chunks_from_pdf(doc_path))
                else:
                    all_chunks.extend(chunks_from_text_file(doc_path))
            print(f"  +{len(all_chunks) - before} chunks from FDA docs.")
        else:
            print("fda_docs/ exists but is empty — skipping.")
    else:
        print("No fda_docs/ folder found — skipping FDA document ingestion.")
        print("  Tip: create rag/fda_docs/ and drop .txt or .pdf files there.")

    # 3. Embed all chunks
    print(f"\nEmbedding {len(all_chunks)} total chunks with Titan Text Embed v2...")
    results = []
    for i, chunk in enumerate(all_chunks):
        print(f"  [{i+1}/{len(all_chunks)}] {chunk['source']} / {chunk['chunk_type'][:20]}")
        embedding = get_embedding(chunk["text"])
        results.append({**chunk, "embedding": embedding})

    # 4. Write output
    with open(OUTPUT_PATH, "w") as f:
        json.dump(results, f)

    size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    print(f"\nDone. {len(results)} embedded chunks written to {OUTPUT_PATH.name} ({size_mb:.1f} MB).")
    print("Commit allergen_kb_embeddings.json — Lambda loads it at cold start.")


if __name__ == "__main__":
    build()
