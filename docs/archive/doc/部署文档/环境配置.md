# 环境变量配置指南

本文档说明如何配置系统的环境变量，以支持不同的部署场景。

## 📋 目录

- [本地部署](#本地部署)
- [分布式部署](#分布式部署)
- [生产环境部署](#生产环境部署)
- [Docker 部署](#docker-部署)

---

## 🔧 环境变量说明

### 前端环境变量

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `BACKEND_URL` | 后端 API 地址 | `http://localhost:5000` | `http://api.example.com` |
| `FRONTEND_URL` | 前端地址 | `http://localhost:3000` | `http://localhost:3000` |
| `REACT_APP_API_URL` | React 开发服务器代理地址 | `http://localhost:5000` | `http://api.example.com` |
| `PORT` | 前端服务端口 | `3000` | `3000` |

### 后端环境变量

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `FLASK_PORT` | 后端服务端口 | `5000` | `5000` |
| `DATABASE_URI` | 数据库连接 URI | `sqlite:///instance/score_management.db` | `postgresql://user:pass@host:5432/db` |
| `REDIS_HOST` | Redis 主机地址 | `localhost` | `redis.example.com` |
| `REDIS_PORT` | Redis 端口 | `6379` | `6379` |

---

## 🏠 本地部署

### 默认配置（无需修改）

本地开发环境使用默认配置即可，所有服务都在 localhost 运行：

```bash
# 前端 .env
HOST=0.0.0.0
PORT=3000

# 后端 .env
FLASK_PORT=5000
DATABASE_URI=sqlite:///instance/score_management.db
REDIS_HOST=localhost
```

### 一键部署

直接运行 `一键部署.bat` 即可，脚本会自动配置环境变量：

```batch
cd deploy
一键部署.bat
```

---

## 🌐 分布式部署

当前后端分离部署在不同服务器时，需要配置环境变量。

### 场景：前后端分离

**服务器 A（前端）**: `192.168.1.100`
**服务器 B（后端）**: `192.168.1.200`

#### 前端服务器配置

编辑 `frontend/.env`：

```bash
HOST=0.0.0.0
PORT=3000
REACT_APP_API_URL=http://192.168.1.200:5000
```

#### 后端服务器配置

编辑 `backend/.env`：

```bash
FLASK_PORT=5000
DATABASE_URI=sqlite:///instance/score_management.db
CORS_ORIGINS=http://192.168.1.100:3000
```

#### 启动服务

**前端服务器**：
```bash
cd frontend
npm start
```

**后端服务器**：
```bash
cd backend
py run.py
```

---

## 🚀 生产环境部署

### 使用环境变量文件

创建生产环境配置文件 `production.env`：

```bash
# 前端生产环境配置
HOST=0.0.0.0
PORT=3000
REACT_APP_API_URL=https://api.yourdomain.com

# 后端生产环境配置
FLASK_ENV=production
FLASK_DEBUG=false
FLASK_PORT=5000
DATABASE_URI=postgresql://user:password@db-host:5432/score_db
REDIS_HOST=redis-cluster.internal
JWT_SECRET_KEY=your_production_secret_key
```

### 使用环境变量启动

**Linux/Mac**:
```bash
# 前端
export REACT_APP_API_URL=https://api.yourdomain.com
npm start

# 后端
export FLASK_ENV=production
export DATABASE_URI=postgresql://user:pass@host:5432/db
py run.py
```

**Windows PowerShell**:
```powershell
# 前端
$env:REACT_APP_API_URL="https://api.yourdomain.com"
npm start

# 后端
$env:FLASK_ENV="production"
$env:DATABASE_URI="postgresql://user:pass@host:5432/db"
py run.py
```

**Windows CMD**:
```cmd
# 前端
set REACT_APP_API_URL=https://api.yourdomain.com
npm start

# 后端
set FLASK_ENV=production
set DATABASE_URI=postgresql://user:pass@host:5432/db
py run.py
```

---

## 🐳 Docker 部署

### Docker Compose 示例

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:5000
      - PORT=3000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - DATABASE_URI=postgresql://user:pass@db:5432/score_db
      - REDIS_HOST=redis
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=score_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 启动 Docker 部署

```bash
docker-compose up -d
```

---

## 🔍 验证配置

### 检查环境变量是否生效

**前端**：
```bash
# 查看启动日志，应该显示配置的 API 地址
npm start
```

**后端**：
```bash
# 查看启动日志，确认配置加载
py run.py
```

### 测试 API 连接

```bash
# 测试后端 API
curl http://localhost:5000/api/health

# 测试前端代理
curl http://localhost:3001/api/health
```

---

## ⚠️ 常见问题

### Q1: 修改环境变量后不生效？

**A**: 需要重启服务才能生效：
```bash
# 停止服务
Ctrl+C

# 重新启动
npm start  # 或 py run.py
```

### Q2: 如何查看当前环境变量？

**A**: 
- Windows CMD: `set`
- Windows PowerShell: `Get-ChildItem Env:`
- Linux/Mac: `env` 或 `printenv`

### Q3: CORS 错误怎么办？

**A**: 在后端 `.env` 中添加前端地址：
```bash
CORS_ORIGINS=http://your-frontend-domain.com
```

---

## 📞 技术支持

如有问题，请查看：
- [部署指南](DEPLOYMENT_GUIDE.md)
- [快速参考](QUICK_REFERENCE.md)
