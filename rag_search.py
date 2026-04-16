import sys
import json
from sentence_transformers import SentenceTransformer
import chromadb

# 初始化模型和向量库
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_collection("labor_law")

def search(query, top_k=3):
    query_embedding = model.encode(query).tolist()
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    laws = []
    if results['documents'] and results['documents'][0]:
        for i in range(len(results['documents'][0])):
            meta = results['metadatas'][0][i]
            laws.append({
                'title': meta['title'],
                'content': results['documents'][0][i],
                'source': meta['source'],
                'tags': meta.get('tags', '')
            })
    return laws

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "请提供查询语句"}, ensure_ascii=False))
        sys.exit(1)
    query = sys.argv[1]
    top_k = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    result = search(query, top_k)
    print(json.dumps(result, ensure_ascii=False))