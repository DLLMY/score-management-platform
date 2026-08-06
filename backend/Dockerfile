# 后端服务 Dockerfile
# 基于Python 3.11的Flask应用容器

FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production \
    FLASK_APP=app.py

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install gunicorn gevent

# 复制应用代码
COPY . .

# 创建必要的目录
RUN mkdir -p /app/instance /app/logs /app/mqtt_persistence

# 设置权限
RUN chmod -R 755 /app/instance /app/logs /app/mqtt_persistence

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["gunicorn", "--config", "gunicorn_config.py", "--worker-class", "gevent", "-w", "4", "--bind", "0.0.0.0:5000", "app:app"]