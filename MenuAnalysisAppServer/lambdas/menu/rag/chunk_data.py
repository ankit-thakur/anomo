import boto3
import os
import json

s3 = boto3.client("s3")

# def chunk_data(data, chunk_size=500, overlap=200):
#     sentences = text.split(". ")
#     chunks, current = [], []
#     for s in sentences:
#         if sum(len(c.split()) for c in current) + len(s.split()) > max_tokens:
#             chunks.append(". ".join(current))
#             current = []
#         current.append(s)
#     if current:
#         chunks.append(". ".join(current))
#     return chunks

def chunk_data(data, context):
    print("*** Chunk Data ***")
    
    chunk_size=1000
    overlap=200
    max_tokens=500
        
    data_input = data['input']
    
    chunks = []
    start = 0
    data_length = len(data_input)

    while start < data_length:
        end = min(start + chunk_size, data_length)
        chunk = data_input[start:end]
        chunks.append(chunk)
        if end == data_length:
            break
        start += chunk_size - overlap
        
    print("*** number of chunks: ", len(chunks))

    return chunks
