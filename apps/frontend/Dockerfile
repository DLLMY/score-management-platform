# 前端服务 Dockerfile
# 多阶段构建：构建阶段 + 生产阶段

# 阶段1: 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    GENERATE_SOURCEMAP=false \
    CI=true

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖（含 devDependencies 中的 vite，用于构建）
RUN npm install --ignore-scripts \
    && npm cache clean --force

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 阶段2: 生产阶段 - 使用nginx serving静态文件
FROM nginx:alpine AS production

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物（Vite 输出到 dist/）
COPY --from=builder /app/dist /usr/share/nginx/html

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]