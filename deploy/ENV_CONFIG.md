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

> **模板来源（单一来源）**：所有后端配置键以 [`backend/.env.example`](../backend/.env.example) 为准（含全部键与注释）。部署时复制为 `backend/.env` 后按需修改：
> ```bash
> # Windows
> copy backend\.env.example backend\.env
> # Linux/Mac
> cp backend/.env.example backend/.env
> ```
> 一键部署（`deploy/one_click_deploy.py` / `deploy.ps1`）会自动基于模板生成 `.env`，无需手动复制。

#### Flask 基础

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FLASK_APP` | Flask 应用入口 | `app` |
| `FLASK_ENV` | 运行环境：`development`（热重载/详细日志）/ `production`（无 reloader，cookie 自动 Secure） | `development` |
| `FLASK_DEBUG` | 调试模式开关 | `true` |
| `FLASK_HOST` | 监听地址 | `127.0.0.1` |
| `FLASK_PORT` | 后端服务端口 | `5000` |
| `FLASK_SECRET_KEY` | 会话/CSRF 签名密钥（生产必须改为随机值） | `change-me-flask-secret` |
| `CSRF_SECRET_KEY` | CSRF 签名密钥（生产必须改为随机值） | `change-me-csrf-secret` |

#### 认证（JWT / Cookie）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `JWT_SECRET_KEY` | JWT 签名密钥（生产必须改为随机值） | `change-me-jwt-secret` |
| `JWT_ACCESS_TOKEN_EXPIRES` | Access Token 有效期（秒） | `3600` |
| `JWT_REFRESH_TOKEN_EXPIRES` | Refresh Token 有效期（秒） | `604800` |
| `SESSION_COOKIE_SECURE` | HttpOnly Cookie 是否仅 HTTPS 传输。默认按 `FLASK_ENV` 自动（`production=true`）；本机 http 调试显式设 `false`，HTTPS 生产设 `true` | 自动 |
| `ADMIN_INIT_PASSWORD` | 首次初始化管理员密码。后端启动时如无 admin 会自动创建，密码取此变量；**未设置则随机生成并打印在启动日志**，不再固定 123456。初始化完成后建议删除该行 | 空（随机） |

#### 数据库与缓存

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URI` | 数据库连接 URI（相对 backend/ 目录） | `sqlite:///instance/score_management.db` |
| `REDIS_HOST` | Redis 主机地址 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_DB` | Redis 数据库编号 | `0` |
| `REDIS_PASSWORD` | Redis 密码（可选） | 空 |

#### 限流

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `RATE_LIMIT_ENABLED` | 是否启用接口限流 | `false` |
| `RATE_LIMIT_PER_HOUR` | 每小时请求上限 | `1000` |
| `RATE_LIMIT_PER_MINUTE` | 每分钟请求上限 | `30` |

#### MQTT（设备通信）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `MQTT_BROKER` | Broker 地址。**生产建议使用 EMQX 云实例（SSL 8883）**，如 `nc5233fc.ala.cn-hangzhou.emqxsl.cn` | `127.0.0.1` |
| `MQTT_PORT` | Broker 端口（EMQX 云 SSL 为 `8883`） | `1883` |
| `MQTT_SSL` | 是否启用 SSL/TLS | `false` |
| `MQTT_CLIENT_ID` | 客户端 ID | `score_backend` |
| `MQTT_USERNAME` | 认证用户名 | 空 |
| `MQTT_PASSWORD` | 认证密码 | 空 |
| `MQTT_TIMEOUT` | 连接超时（秒） | `10` |
| `MQTT_KEEPALIVE` | 心跳保活（秒） | `60` |
| `MQTT_TOPIC_PREFIX` | 主题前缀 | `score/management` |

#### OTA 固件升级策略

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OTA_AUTO_PUSH_ENABLED` | 是否自动推送固件 | `false` |
| `OTA_FIRMWARE_BASE_URL` | 固件下载基础 URL | 空 |
| `OTA_PUSH_COOLDOWN_SEC` | 推送冷却时间（秒） | `600` |
| `OTA_QUIET_WINDOWS` | 静默升级窗口 | 空 |
| `OTA_RESPECT_CLASS_TIME` | 是否避开上课时间 | `true` |
| `OTA_ROLLOUT_JITTER_SEC` | 下发随机抖动（秒） | `30` |
| `OTA_SIGNING_SECRET` | 固件签名密钥 | 空 |
| `OTA_STAGED_ROLLOUT` | 是否分批灰度 | `false` |
| `OTA_STAGE_BATCH_INTERVAL_SEC` | 批次间隔（秒） | `60` |
| `OTA_STAGE_BATCH_SIZE` | 每批台数 | `10` |
| `OTA_STAGE_PERCENT` | 首批灰度比例（%） | `20` |

#### 备份

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `BACKUP_ENABLED` | 是否启用自动备份 | `false` |
| `BACKUP_INTERVAL_HOURS` | 备份间隔（小时） | `24` |
| `BACKUP_MAX_COUNT` | 最大保留备份数 | `10` |

#### CORS 与 Celery

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CORS_ORIGINS` | 前端地址列表（逗号分隔）；生产同域部署可保持默认 | `http://localhost:3000,http://127.0.0.1:3000` |
| `START_CELERY` | 是否启动 Celery 后台任务。生产默认启用（=1），开发默认关闭 | `0` |
| `CELERY_BROKER_URL` | Celery Broker 地址 | `redis://localhost:6379/1` |

---

## 🏠 本地部署

### 默认配置（无需修改）

本地开发环境使用默认配置即可，所有服务都在 localhost 运行。后端配置基于 `backend/.env.example` 模板生成：

```bash
# 前端 .env
HOST=0.0.0.0
PORT=3000

# 后端 .env（由 .env.example 复制生成）
FLASK_ENV=development
FLASK_PORT=5000
DATABASE_URI=sqlite:///instance/score_management.db
REDIS_HOST=localhost
MQTT_BROKER=127.0.0.1
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

编辑 `backend/.env`（从 `backend/.env.example` 复制）：

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

**后端服务器**（开发环境）：
```bash
cd backend
python run.py
```

---

## 🚀 生产环境部署

### 使用环境变量文件

创建生产环境配置文件 `production.env`（或直接基于 `backend/.env.example` 生成 `backend/.env`）：

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
FLASK_SECRET_KEY=<32位以上随机字符串>
CSRF_SECRET_KEY=<32位以上随机字符串>
JWT_SECRET_KEY=<32位以上随机字符串>
# HTTPS 生产环境 cookie 自动 Secure，无需显式设置；
# 本机 http 调试可设 SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SECURE=true
# 首次初始化管理员密码（初始化完成后建议删除该行）
ADMIN_INIT_PASSWORD=<强密码>
# 生产建议 EMQX 云实例（SSL 8883）
MQTT_BROKER=nc5233fc.ala.cn-hangzhou.emqxsl.cn
MQTT_PORT=8883
MQTT_SSL=true
```

### 使用环境变量启动

**后端生产模式**（无 reloader，自动启用 cookie Secure）：

```bash
cd backend
python run.py --env production
```

`run.py` 支持 `--env development|production`（默认 development）。`FLASK_DEBUG`、`FLASK_HOST`、`FLASK_PORT` 等仍可被环境变量覆盖。

**Linux/Mac**:
```bash
# 前端
export REACT_APP_API_URL=https://api.yourdomain.com
npm start

# 后端
export FLASK_ENV=production
export DATABASE_URI=postgresql://user:pass@host:5432/db
python run.py --env production
```

**Windows PowerShell**:
```powershell
# 前端
$env:REACT_APP_API_URL="https://api.yourdomain.com"
npm start

# 后端
$env:FLASK_ENV="production"
$env:DATABASE_URI="postgresql://user:pass@host:5432/db"
python run.py --env production
```

**Windows CMD**:
```cmd
# 前端
set REACT_APP_API_URL=https://api.yourdomain.com
npm start

# 后端
set FLASK_ENV=production
set DATABASE_URI=postgresql://user:pass@host:5432/db
python run.py --env production
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
      - FLASK_SECRET_KEY=change-me
      - JWT_SECRET_KEY=change-me
      - SESSION_COOKIE_SECURE=true
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
python run.py --env production
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
npm start  # 或 python run.py
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
