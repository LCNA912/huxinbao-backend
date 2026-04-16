from flask import Flask, request, Response
from flask_cors import CORS
import json
from sentence_transformers import SentenceTransformer
import chromadb

app = Flask(__name__)
CORS(app)

print("正在加载向量模型...")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_collection("labor_law")
print("模型和向量库加载完成。")

@app.route('/search', methods=['POST'])
def search():
    data = request.get_json()
    query = data.get('query', '')
    top_k = data.get('top_k', 3)
    if not query:
        return Response(
            json.dumps({"error": "query 参数不能为空"}, ensure_ascii=False),
            mimetype='application/json'
        ), 400

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

    # 使用 json.dumps 设置 ensure_ascii=False，并手动构造 Response
    response_json = json.dumps(laws, ensure_ascii=False)
    return Response(response_json, mimetype='application/json')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)