import json
import chromadb
from sentence_transformers import SentenceTransformer

# 1. 初始化 Chroma 客户端（数据会保存在本地文件夹 chroma_db）
client = chromadb.PersistentClient(path="./chroma_db")

# 2. 创建或获取集合（类似数据库中的“表”）
collection = client.get_or_create_collection(name="labor_law")

# 3. 加载本地的中文向量化模型（首次运行会自动下载，约 120MB）
print("正在加载向量模型...")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
print("模型加载完成。")

# 4. 读取法条 JSON 文件
with open('knowledge-base/law-data.json', 'r', encoding='utf-8') as f:
    law_data = json.load(f)

print(f"共读取到 {len(law_data)} 条法条。")

# 5. 准备数据：把每条法条变成向量，并存入 Chroma
ids = []
documents = []
metadatas = []
embeddings = []

for item in law_data:
    # 每条法条的唯一 ID
    ids.append(item['id'])
    
    # 存入的文本内容（用于检索和展示）
    documents.append(item['content'])
    
    # 附加信息（可以用于过滤和显示来源）
    metadatas.append({
        'title': item['title'],
        'source': item['source'],
        'tags': ','.join(item.get('tags', []))
    })
    
    # 把文本内容变成向量
    embedding = model.encode(item['content']).tolist()
    embeddings.append(embedding)

# 6. 批量存入 Chroma（如果已存在相同 ID 会覆盖）
collection.upsert(
    ids=ids,
    documents=documents,
    metadatas=metadatas,
    embeddings=embeddings
)

print(f"✅ 成功将 {len(law_data)} 条法条向量化并存入 Chroma 数据库！")
print(f"向量库保存在: ./chroma_db")