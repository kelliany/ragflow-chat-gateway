# 1. 使用轻量级 Node.js 镜像
FROM node:18-alpine

# 2. 设置工作目录
WORKDIR /app

# 3. 单独复制 package.json 安装依赖 (利用 Docker 缓存)
COPY package*.json ./
RUN npm install --production

# 4. 复制所有源代码
COPY . .

# 5. 暴露端口 (您的网关端口)
EXPOSE 3000

# 6. 启动命令
CMD ["node", "src/app.js"]