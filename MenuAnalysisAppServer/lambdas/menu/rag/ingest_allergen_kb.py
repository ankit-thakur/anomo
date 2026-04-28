# This file has been superseded by build_kb_embeddings.py (Option 1: in-memory embeddings).
#
# To rebuild the allergen knowledge base:
#   python rag/build_kb_embeddings.py
#
# To add FDA/FARE documentation:
#   1. Drop .txt or .pdf files into rag/fda_docs/
#   2. Re-run build_kb_embeddings.py
#   3. Commit the updated allergen_kb_embeddings.json
#   4. Redeploy the Lambda
