const { ChromaClient } = require('chromadb');
const { pipeline } = require('@xenova/transformers');

// 全局单例
let embedder = null;
let collection = null;

// 初始化向量模型（只加载一次）
async function initEmbedder() {
  if (!embedder) {
    console.log('正在加载向量模型...');
    embedder = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    console.log('向量模型加载完成。');
  }
  return embedder;
}

// 初始化 Chroma 集合
async function initCollection() {
  if (!collection) {
    const client = new ChromaClient({ path: './chroma_db' });
    collection = await client.getOrCreateCollection({ name: 'labor_law' });
    console.log('Chroma 集合已连接。');
  }
  return collection;
}

// 文本向量化（平均池化）
async function encodeTexts(texts) {
  const embedder = await initEmbedder();
  const embeddings = [];
  for (const text of texts) {
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    embeddings.push(Array.from(output.data));
  }
  return embeddings;
}

// 检索函数
async function searchLaws(query, topK = 3) {
  const collection = await initCollection();
  const queryEmbedding = (await encodeTexts([query]))[0];

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
  });

  const laws = [];
  if (results.documents && results.documents[0]) {
    for (let i = 0; i < results.documents[0].length; i++) {
      laws.push({
        title: results.metadatas[0][i].title,
        content: results.documents[0][i],
        source: results.metadatas[0][i].source,
        tags: results.metadatas[0][i].tags,
      });
    }
  }
  return laws;
}

module.exports = { searchLaws };