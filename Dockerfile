# 使用官方 Python 3.13 轻量镜像作为基础
FROM python:3.13-slim

# 设置工作目录
WORKDIR /app

# 1. 安装 Node.js 20.x 和 npm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 2. 复制并安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. 复制并安装 Node.js 依赖
COPY package*.json .
RUN npm install --production

# 4. 【关键】预下载 Sentence-Transformers 模型，避免运行时超时
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# 5. 复制项目所有文件
COPY . .

# 6. 确保 Railway 能正确检测到端口
EXPOSE 3000

# 7. 启动命令：同时运行 Flask 和 Node.js
CMD ["sh", "-c", "python rag_server.py & node app.js"]