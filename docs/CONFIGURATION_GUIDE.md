# 项目配置手册（全量）

> 覆盖项目中所有需要手动配置的部分：后端环境变量、前端环境变量、数据库连接、
> 第三方服务（MQTT / Redis / ngrok / Celery）、部署脚本参数，以及其他手动配置项。
> 配置模板：`backend/.env.example`（后端）、`frontend/.env.example`（前端）。

---

## 目录

- [1. 后端环境变量（backend/.env）](#1-后端环境变量backendenv)
  - [1.1 Flask 基础](#11-flask-基础)
  - [1.2 安全与认证](#12-安全与认证)
  - [1.3 数据库](#13-数据库)
  - [1.4 Redis 缓存](#14-redis-缓存)
  - [1.5 限流](#15-限流)
  - [1.6 MQTT 设备通信](#16-mqtt-设备通信)
  - [1.7 OTA 固件升级](#17-ota-固件升级)
  - [1.8 数据备份](#18-数据备份)
  - [1.9 CORS 跨域](#19-cors-跨域)
  - [1.10 Celery 后台任务](#110-celery-后台任务)
  - [1.11 日志与 Gunicorn（Linux 部署）](#111-日志与-gunicornlinux-部署)
- [2. 前端环境变量（frontend/.env）](#2-前端环境变量frontendenv)
- [3. 数据库连接（DATABASE_URI）](#3-数据库连接database_uri)
- [4. 第三方服务](#4-第三方服务)
- [5. 部署脚本配置（deploy/config.json）](#5-部署脚本配置deployconfigjson)
- [6. 其他手动配置](#6-其他手动配置)

---

## 1. 后端环境变量（backend/.env）

> 复制 `backend/.env.example` 为 `backend/.env` 后修改。一键部署脚本会自动生成（密钥随机）。
> 必填标注：**必填**=生产环境必须显式设置；`可选`=有默认值，按需修改。

### 1.1 Flask 基础

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `FLASK_ENV` | 运行环境：`development`=调试（热重载/详细日志）；`production`=生产（无 reloader，cookie Secure 自动启用） | `development` / `production` | `development` | 生产必填 | `FLASK_ENV=production` |
| `FLASK_DEBUG` | 是否开启调试模式（development 下默认 true） | `true` / `false` | `true` | 否 | `FLASK_DEBUG=false` |
| `FLASK_HOST` | 后端监听地址 | IP / 主机名 | `127.0.0.1` | 局域网部署必填 | `FLASK_HOST=0.0.0.0` |
| `FLASK_PORT` | 后端端口 | 1-65535 | `5000` | 否 | `FLASK_PORT=5000` |
| `FLASK_SECRET_KEY` | 会话/签名密钥（泄露可伪造会话，生产必须随机） | 任意长字符串（建议 `secrets.token_hex(32)`） | 随机生成 | **必填** | `FLASK_SECRET_KEY=a9f3...64hex` |
| `FLASK_APP` | Flask 入口模块标识 | `app.py` / `app` | `app.py` | 否 | `FLASK_APP=app` |

### 1.2 安全与认证

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `CSRF_SECRET_KEY` | CSRF 令牌签名密钥 | 任意长字符串 | 取 `JWT_SECRET_KEY` | 生产建议设置 | `CSRF_SECRET_KEY=<64hex>` |
| `JWT_SECRET_KEY` | JWT 签名密钥（泄露可伪造任意身份，**生产必须随机**） | 任意长字符串（建议 64 hex） | 随机生成 | **必填** | `JWT_SECRET_KEY=<64hex>` |
| `JWT_ACCESS_TOKEN_EXPIRES` | access token 有效期（秒） | 正整数 | `3600`（1h） | 否 | `JWT_ACCESS_TOKEN_EXPIRES=3600` |
| `JWT_REFRESH_TOKEN_EXPIRES` | refresh token 有效期（秒） | 正整数 | `604800`（7d） | 否 | `JWT_REFRESH_TOKEN_EXPIRES=604800` |
| `SESSION_COOKIE_SECURE` | HttpOnly cookie 是否仅 HTTPS 传输。**本机 http 部署必须 `false`，否则登录后会话失效**；HTTPS 生产设 `true`。未设置时按 `FLASK_ENV` 自动（production=True） | `true` / `false` | 按 `FLASK_ENV` 自动 | 本机 http 部署必填 `false` | `SESSION_COOKIE_SECURE=false` |
| `ADMIN_INIT_PASSWORD` | **首次启动**自动创建 `admin` 账户时的初始密码；未设置则随机生成并打印在启动日志 | 任意字符串（建议强密码） | 随机生成 | 否（建议设置） | `ADMIN_INIT_PASSWORD=MyAdmin2026!` |

### 1.3 数据库

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `DATABASE_URI` | 数据库连接串（SQLAlchemy 格式） | SQLite：`sqlite:///instance/score_management.db`；MySQL：`mysql+pymysql://用户:密码@主机:3306/库名?charset=utf8mb4`；PostgreSQL：`postgresql://用户:密码@主机:5432/库名` | SQLite（backend/instance/） | 生产建议 MySQL/PG | 见 [第 3 节](#3-数据库连接database_uri) |

### 1.4 Redis 缓存

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `REDIS_HOST` | Redis 地址（缺失时自动降级内存缓存） | IP / 主机名 | `localhost` | 否 | `REDIS_HOST=127.0.0.1` |
| `REDIS_PORT` | Redis 端口 | 1-65535 | `6379` | 否 | `REDIS_PORT=6379` |
| `REDIS_DB` | Redis 库编号（统一用 0） | 0-15 | `0` | 否 | `REDIS_DB=0` |
| `REDIS_PASSWORD` | Redis 密码（无密码留空） | 字符串 | 空 | 否 | `REDIS_PASSWORD=secret` |
| `REDIS_AUTO_START` | 是否自动拉起本地 Redis（仅开发） | `true` / `false` | 开发 true / 生产 false | 否 | `REDIS_AUTO_START=false` |

### 1.5 限流

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `RATE_LIMIT_ENABLED` | 是否启用全局限流 | `true` / `false` | `true` | 否 | `RATE_LIMIT_ENABLED=true` |
| `RATE_LIMIT_PER_MINUTE` | 单 IP 每分钟请求上限 | 正整数 | `30` | 否 | `RATE_LIMIT_PER_MINUTE=60` |
| `RATE_LIMIT_PER_HOUR` | 单 IP 每小时请求上限 | 正整数 | `1000` | 否 | `RATE_LIMIT_PER_HOUR=2000` |

### 1.6 MQTT 设备通信

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `MQTT_BROKER` | MQTT Broker 地址。生产建议 EMQX 云实例 | IP / 域名 | `broker.hivemq.com`（公共） | 生产必填 | `MQTT_BROKER=nc5233fc.ala.cn-hangzhou.emqxsl.cn` |
| `MQTT_PORT` | Broker 端口（SSL 一般为 8883） | 1-65535 | `1883` | 否 | `MQTT_PORT=8883` |
| `MQTT_SSL` | 是否启用 TLS | `true` / `false` | `false` | 生产建议 true | `MQTT_SSL=true` |
| `MQTT_CLIENT_ID` | 客户端 ID（同一 broker 内唯一） | 字符串 | `score_backend` | 否 | `MQTT_CLIENT_ID=score_backend_prod` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | Broker 认证凭据 | 字符串 | 空 | 视 broker 而定 | `MQTT_USERNAME=score` |
| `MQTT_TIMEOUT` | 连接超时（秒） | 正整数 | `10` | 否 | `MQTT_TIMEOUT=5` |
| `MQTT_KEEPALIVE` | 心跳间隔（秒） | 正整数 | `60` | 否 | `MQTT_KEEPALIVE=60` |
| `MQTT_TOPIC_PREFIX` | 主题前缀（控制/遥测/OTA 均在其下） | 字符串（建议 `score/<domain>`） | `score/management` | 否 | `MQTT_TOPIC_PREFIX=score/management` |
| `MQTT_TRANSPORT` | 传输协议 | `tcp` / `websockets` | `tcp` | 否 | `MQTT_TRANSPORT=tcp` |

### 1.7 OTA 固件升级

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `OTA_AUTO_PUSH_ENABLED` | 是否自动推送固件 | `true` / `false` | `true` | 否 | `OTA_AUTO_PUSH_ENABLED=false` |
| `OTA_FIRMWARE_BASE_URL` | 固件下载基础 URL（固件文件托管地址） | URL | 空 | 推送固件时必填 | `OTA_FIRMWARE_BASE_URL=https://example.com/firmware` |
| `OTA_PUSH_COOLDOWN_SEC` | 同设备两次推送最小间隔（秒） | 正整数 | `600` | 否 | `OTA_PUSH_COOLDOWN_SEC=600` |
| `OTA_RESPECT_CLASS_TIME` | 是否避开上课时间推送 | `true` / `false` | `true` | 否 | `OTA_RESPECT_CLASS_TIME=true` |
| `OTA_QUIET_WINDOWS` | 静默推送窗口（本地时间，逗号分隔，支持跨午夜） | `"HH:MM-HH:MM[,HH:MM-HH:MM]"` | 空 | 否 | `OTA_QUIET_WINDOWS=22:00-06:00,12:00-13:00` |
| `OTA_ROLLOUT_JITTER_SEC` | 推送随机抖动上限（秒，防同时打爆） | 正整数 | `30` | 否 | `OTA_ROLLOUT_JITTER_SEC=30` |
| `OTA_STAGED_ROLLOUT` | 是否启用灰度分批推送 | `true` / `false` | `false` | 否 | `OTA_STAGED_ROLLOUT=true` |
| `OTA_STAGE_PERCENT` | 首批灰度设备百分比 | 1-100 | `100` | 灰度时必填 | `OTA_STAGE_PERCENT=20` |
| `OTA_STAGE_BATCH_SIZE` | 每批推送数量（0=按百分比） | 非负整数 | `0` | 否 | `OTA_STAGE_BATCH_SIZE=10` |
| `OTA_STAGE_BATCH_INTERVAL_SEC` | 批次间隔（秒） | 正整数 | `60` | 否 | `OTA_STAGE_BATCH_INTERVAL_SEC=60` |
| `OTA_SIGNING_SECRET` | 固件签名密钥（防篡改；设备端需同密钥） | 字符串 | 空 | 启用签名时必填 | `OTA_SIGNING_SECRET=<secret>` |

### 1.8 数据备份

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `BACKUP_ENABLED` | 是否自动备份数据库 | `true` / `false` | `false` | 否 | `BACKUP_ENABLED=true` |
| `BACKUP_INTERVAL_HOURS` | 备份间隔（小时） | 正整数 | `24` | 否 | `BACKUP_INTERVAL_HOURS=24` |
| `BACKUP_MAX_COUNT` | 保留备份份数（超出删除最旧） | 正整数 | `10` | 否 | `BACKUP_MAX_COUNT=10` |

### 1.9 CORS 跨域

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `CORS_ORIGINS` | 允许的前端来源（逗号分隔）；生产必须限定为实际前端域名，禁止 `*` | 逗号分隔 URL | `http://localhost:3000,http://127.0.0.1:3000` | 生产必填 | `CORS_ORIGINS=https://score.example.com` |

### 1.10 Celery 后台任务

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `START_CELERY` | 是否启动 Celery worker（定时通知/归档等后台任务） | `1` / `0` | 开发 `0` / 生产 `1` | 生产建议 `1` | `START_CELERY=1` |
| `CELERY_BROKER_URL` | 任务队列 Broker（需 Redis） | Redis URL | `redis://localhost:6379/1` | 启用 Celery 时必填 | `CELERY_BROKER_URL=redis://localhost:6379/1` |
| `CELERY_RESULT_BACKEND` | 任务结果存储 | Redis URL | `redis://localhost:6379/1` | 否 | 同上 |
| `CELERY_WORKER_CONCURRENCY` | worker 并发数 | 正整数 | `4` | 否 | `CELERY_WORKER_CONCURRENCY=4` |

### 1.11 日志与 Gunicorn（Linux 部署）

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `LOG_LEVEL` | 后端日志级别 | `DEBUG` / `INFO` / `WARNING` / `ERROR` | `INFO` | 否 | `LOG_LEVEL=WARNING` |
| `GUNICORN_WORKER_CLASS` | Gunicorn worker 类型（Linux 生产） | `gevent` / `sync` / `eventlet` | `gevent` | 否 | `GUNICORN_WORKER_CLASS=gevent` |
| `GUNICORN_BIND` | Gunicorn 监听地址（固定值，如需修改改代码） | `IP:PORT` | `0.0.0.0:5000` | 否 | — |
| `GUNICORN_WORKERS` / `THREADS` | worker/线程数（自动按 CPU 计算） | 正整数 | 自动 | 否 | — |
| `GUNICORN_TIMEOUT` | 请求超时（秒） | 正整数 | `120` | 否 | — |

---

## 2. 前端环境变量（frontend/.env）

| 配置项 | 用途 | 可选值 / 格式 | 默认值 | 必填 | 示例 |
|--------|------|----------------|--------|------|------|
| `HOST` | 前端 dev server 监听地址 | IP / `0.0.0.0` | `0.0.0.0` | 否 | `HOST=0.0.0.0` |
| `PORT` | 前端 dev server 端口 | 1-65535 | `3000` | 否 | `PORT=3000` |
| `WDS_SOCKET_PORT` | WebSocket 调试端口（dev 热更新） | `0`=自动 | `0` | 否 | `WDS_SOCKET_PORT=0` |
| `BROWSER` | 启动是否自动开浏览器 | `none`=不开 | `none` | 否 | `BROWSER=none` |
| `REACT_APP_API_URL` | 后端 API 地址（**生产构建时需设置**；dev 默认走 Vite 代理到 5000） | URL | `http://127.0.0.1:5000` | 前后端分离部署必填 | `REACT_APP_API_URL=https://api.example.com` |

> 生产构建：`npm run build` 会将 `REACT_APP_API_URL` 打进静态包；同域部署（nginx 反代 `/api`、`/ws` 到后端）则无需设置。

---

## 3. 数据库连接（DATABASE_URI）

| 数据库 | 连接串格式 | 说明 |
|--------|------------|------|
| SQLite（默认） | `sqlite:///instance/score_management.db` | 路径相对 `backend/`；单机/教学场景够用，自动 WAL 优化 |
| MySQL | `mysql+pymysql://用户:密码@主机:3306/库名?charset=utf8mb4` | 生产推荐；需 `pip install pymysql` |
| PostgreSQL | `postgresql://用户:密码@主机:5432/库名` | 生产推荐；需 `pip install psycopg2-binary` |

> 切换生产数据库后：首次启动自动建表 + 建索引 + 建默认管理员；索引也可手动 `python scripts/create_indexes.py --create`。

---

## 4. 第三方服务

### 4.1 MQTT Broker（设备通信，必需）
- **选项 A：EMQX Cloud（推荐，生产）** — 注册创建免费实例，取连接信息填入 `.env`：`MQTT_BROKER=实例地址`、`MQTT_PORT=8883`、`MQTT_SSL=true`、`MQTT_USERNAME/PASSWORD`。
- **选项 B：本地 mosquitto** — `infra/mosquitto/` 提供配置；`MQTT_BROKER=127.0.0.1`、`MQTT_PORT=1883`、`MQTT_SSL=false`。
- **选项 C：公共 broker（仅测试）** — `broker.hivemq.com:1883`（默认，不推荐生产）。

### 4.2 Redis（缓存/任务队列，可选）
- 缺失时自动降级内存缓存（部分功能受限：跨进程缓存、Celery 队列）。
- Windows 本地：`deploy/redis/redis-server.exe redis.windows.conf`（部署脚本自动启动）。
- 连接配置见 1.4。

### 4.3 ngrok（外网穿透，可选）
- 配置文件：`deploy/ngrok/ngrok.yml`（隧道 `proxy` → 前端 3001）。
- 手动使用需注册 [ngrok](https://dashboard.ngrok.com) 获取 authtoken：`ngrok config add-authtoken <token>`。
- 免费版每次启动生成随机外网地址（见管理面板 `http://localhost:4040`）。

### 4.4 Celery Broker
- 依赖 Redis（见 4.2）；`CELERY_BROKER_URL=redis://localhost:6379/1`。

---

## 5. 部署脚本配置（deploy/config.json）

> 供 `deploy/service_manager.py`（服务监控）读取。

| 配置项 | 用途 | 默认值 |
|--------|------|--------|
| `backend_port` / `frontend_port` | 后端/前端端口（与 .env 保持一致） | `5000` / `3000` |
| `ngrok_port` | ngrok 管理面板端口 | `4040` |
| `max_restarts` | 服务异常最大重启次数 | `5` |
| `monitor_interval` | 健康检查轮询间隔（秒） | `5` |
| `startup_delay.backend/frontend/ngrok` | 各服务启动等待（秒） | `8` / `15` / `3` |
| `health_check_timeout` | 健康检查超时（秒） | `10` |

---

## 6. 其他手动配置

| 配置项 | 用途 | 说明 / 示例 |
|--------|------|-------------|
| **默认管理员** | 首次启动自动创建 `admin` | 密码 = `ADMIN_INIT_PASSWORD`（未设置则随机打印在启动日志）；创建后登录修改 |
| **模型资产**（NLP） | BERT / 分类模型 | 从原环境拷贝 `backend/models/bert/`（~393MB）与 `backend/models/trained/`（~169MB）到新环境，否则 `/api/nlp/*` 不可用 |
| **Python 版本** | 后端运行环境 | **必须系统 Python 3.11**（含 torch）；`py` 启动器可能解析到 3.13 缺依赖；部署脚本已自动探测 |
| **回归脚本 Python** | run_regression.sh 使用的解释器 | 环境变量 `PYTHON_BIN` 可覆盖（CI 用）；默认自动探测 |
| **前端静态部署** | 生产前端 | `npm run build` 产出 `dist/`；由 `start_server.bat`（http.server）或 nginx 托管；`/api`、`/ws` 反代到后端 |
| **HTTPS 生产** | Cookie Secure / 安全头完整生效 | 部署在 HTTPS 后：`SESSION_COOKIE_SECURE=true`、`CORS_ORIGINS` 限前端域名 |
| **Gunicorn（Linux）** | 生产 WSGI | `gunicorn --config gunicorn_config.py wsgi:application`（worker gevent，支持 WebSocket 需额外配置） |
| **Docker** | 容器化部署 | `docker-compose.yml`（见 infra/）；`.env` 通过环境变量注入 |
| **CSRF 豁免端点** | 前端错误上报等免 CSRF | 已内置（`/api/system/frontend-error`、`/api/nlp/analysis/errors`），无需手动配置 |

---

## 附：快速核对清单（部署前）

- [ ] `FLASK_ENV=production`、`FLASK_DEBUG=false`
- [ ] `FLASK_SECRET_KEY` / `JWT_SECRET_KEY` / `CSRF_SECRET_KEY` 为随机值
- [ ] 本机 http 部署：`SESSION_COOKIE_SECURE=false`；HTTPS 部署：`true` + `CORS_ORIGINS` 限域名
- [ ] `DATABASE_URI` 指向生产库（MySQL/PG）或确认 SQLite 路径
- [ ] MQTT 指向实际 broker（EMQX 云实例：端口 8883 + `MQTT_SSL=true`）
- [ ] `ADMIN_INIT_PASSWORD` 已预设（或记住首次随机密码）
- [ ] 首次部署后 `python scripts/verify_indexes.py` 全绿（启动已自动自举，此步双保险）
- [ ] NLP 模型资产已拷贝（如需要 NLP/算法功能）
