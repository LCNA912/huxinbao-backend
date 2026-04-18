# 使用官方 Python 3.13 轻量镜像
FROM python:3.13-slim

WORKDIR /app

# 1. 配置国内镜像源，加速 apt 和 pip 下载
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources && \
    pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 2. 安装 Node.js 20.x 和基础工具（合并步骤减少层数）
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 3. 复制并安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 复制并安装 Node.js 依赖
COPY package*.json .
RUN npm install --production

# 5. 【关键优化】预下载模型（指定缓存目录，避免重复下载）
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# 6. 复制项目文件
COPY . .

# 7. 暴露端口并启动
EXPOSE 3000
CMD ["sh", "-c", "python rag_server.py & node app.js"]