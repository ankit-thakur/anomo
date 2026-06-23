import boto3
import json
import uuid
import os
from dotenv import load_dotenv
load_dotenv()  # load variables from .env into os.environ
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth

# --- Config ---
region = os.environ["AWS_REGION"]
opensearch_host = os.environ["OPENSEARCH_ENDPOINT"]
index_name = "anomo-documents"

# Clients
bedrock = boto3.client("bedrock-runtime", region_name=region)
session = boto3.Session()
credentials = session.get_credentials()

auth = AWSV4SignerAuth(credentials, region, "aoss")

os_client = OpenSearch(
    hosts=[{"host": opensearch_host, "port": 443}],
    http_auth=auth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection
)

def get_embedding(text: str):
    body = json.dumps({"inputText": text})
    response = bedrock.invoke_model(
        modelId="amazon.titan-embed-text-v2:0",
        body=body
    )
    output = json.loads(response["body"].read())
    return output["embedding"]

def lambda_handler(event, context):
    print("*** Embed and Vectorize Chunk ***")
    print("* event: ", event)
        
    chunks = event["input"]
    source_doc = event.get("source_doc", "unknown")
    doc_id = str(uuid.uuid4())
    
    for chunk in [chunks]:
        embedding = get_embedding(chunk)

        doc = {
            "id": doc_id,
            # "settings": {"index.knn": True},
            "text": chunk,
            "embedding": embedding,
            "metadata": {"source": source_doc}
        }
        
                # Optional: check if index exists before creating
        if not os_client.indices.exists(index=index_name):
            print(f"Index '{index_name}' does not exist. Creating it.")
            os_client.indices.create(index=index_name, body=doc)
        else:
            print(f"Index '{index_name}' already exists.")
            os_client.index(index=index_name, body=doc, id=doc_id)

    return {"doc_id": doc_id}


# index_body = {
#     "settings": {"index.knn": True},
#     "mappings": {
#         "properties": {
#             "embedding": {
#                 "type": "knn_vector",
#                 "dimension": 1536,
#                 "method": {"name": "hnsw", "space_type": "cosinesimil"}
#             },
#             "text": {"type": "text"},
#             "metadata": {"type": "object"}
#         }
#     }
# }