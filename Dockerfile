# 使用官方 Python 3.13 镜像作为基础
FROM python:3.13-slim

# 设置工作目录
WORKDIR /app

# 1. 安装 Node.js 和 npm
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. 复制 Python 依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. 复制 Node.js 依赖文件并安装
COPY package*.json .
RUN npm install

# 4. 复制项目所有文件到容器
COPY . .

# 5. 暴露端口（3000）
EXPOSE 3000

# 6. 启动命令：先启动 Flask 微服务，再启动 Node 主服务
CMD ["sh", "-c", "python rag_server.py & node app.js"]