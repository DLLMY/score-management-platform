# 学生积分管理平台 - 配置指南

## 一、配置文件位置清单

### 1. 部署配置 (`deploy/config.json`)
**位置**: `deploy/config.json`
**用途**: 控制服务端口、启动延迟、部署模式参数

```json
{
  "backend_port": 5000,      // 后端API端口
  "frontend_port": 3000,     // 前端访问端口
  "ngrok_port": 4040,        // ngrok管理面板端口

  "max_restarts": 5,         // 服务最大重启次数
  "monitor_interval": 5,     // 健康检查轮询间隔(秒)

  "startup_delay": {
    "backend": 8,            // 后端启动等待时间(秒)
    "frontend": 15,          // 前端启动等待时间(秒)
    "ngrok": 3               // ngrok启动等待时间(秒)
  },

  "health_check_timeout": 10 // 健康检查超时(秒)
}
```

### 2. 后端环境配置 (`backend/config/.env`)
**位置**: `backend/config/.env` (从 `.env.example` 复制)
**用途**: Flask应用、数据库、Redis、MQTT、JWT等核心配置

**必须配置项**:
```bash
# Flask密钥 (必须修改，用于session加密)
FLASK_SECRET_KEY=your_strong_secret_key_here_must_be_at_least_32_characters_long

# JWT密钥 (必须修改，用于token加密)
JWT_SECRET_KEY=jwt_strong_secret_key_must_be_kept_secret

# CSRF密钥 (必须修改，用于CSRF保护)
CSRF_SECRET_KEY=csrf_secret_key_here_different_from_flask_secret
```

**可选配置项**:
```bash
# Redis缓存 (如不使用Redis可留空)
REDIS_HOST=localhost
REDIS_PORT=6379

# MQTT消息推送 (可选)
MQTT_BROKER=broker.hivemq.com
MQTT_PORT=1883

# 数据库路径 (默认使用SQLite)
DATABASE_URI=sqlite:///instance/score_management.db
```

### 3. 前端环境配置 (`frontend/.env`)
**位置**: `frontend/.env.development` (开发) / `.env.production` (生产)
**用途**: API地址、MQTT连接、WebSocket配置

**开发环境配置**:
```bash
# API代理地址 (开发时代理到后端)
REACT_APP_API_BASE_URL=/api

# MQTT WebSocket配置
REACT_APP_MQTT_BROKER=broker.hivemq.com
REACT_APP_MQTT_PORT=8083
REACT_APP_MQTT_USE_TLS=true
```

### 4. ngrok外网穿透配置 (`deploy/ngrok/ngrok.yml`)
**位置**: `deploy/ngrok/ngrok.yml`
**用途**: 外网穿透隧道配置

**配置步骤**:
1. 注册ngrok账号: https://ngrok.com
2. 获取authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. 配置authtoken (两种方式):
   - 方式A: 运行 `ngrok.exe authtoken <your_token>`
   - 方式B: 编辑系统配置文件 `%USERPROFILE%\AppData\Local\ngrok\ngrok.yml`

```yaml
version: "3"

agent:
    connect_url: connect.us.ngrok-agent.com:443

tunnels:
    proxy:
        proto: http
        addr: 3001          # 代理服务器端口
        host_header: localhost:3001
```

### 5. Redis配置 (`deploy/redis/redis.windows.conf`)
**位置**: `deploy/redis/redis.windows.conf`
**用途**: Redis服务器配置

**关键配置**:
```conf
bind 127.0.0.1
port 6379
maxmemory 256mb
```

---

## 二、一键启动脚本

### 服务器模式启动
**脚本**: `deploy/start_server.bat`
**特点**:
- 生产模式运行 (Waitress + 静态文件服务)
- 后台最小化运行
- 不自动打开浏览器
- 适合长期运行的服务器

### 笔记本模式启动
**脚本**: `deploy/start_server.bat`
**特点**:
- 开发模式运行 (热重载)
- 自动打开浏览器
- 实时状态监控
- 适合教学现场快速部署

### 停止所有服务
**脚本**: `deploy/stop_all.bat`
**功能**: 停止所有端口上的服务进程

---

## 三、首次部署配置流程

### 步骤1: 环境安装
```bash
# 运行环境安装脚本 (自动安装Python/Node.js/Redis/ngrok)
双击 deploy/deploy.ps1 → 选择 [3] 仅安装依赖
```

### 步骤2: 配置密钥
```bash
# 1. 复制后端配置模板
copy backend\config\.env.example backend\config\.env

# 2. 编辑 backend\config\.env，修改以下密钥:
FLASK_SECRET_KEY=<生成32位以上随机字符串>
JWT_SECRET_KEY=<生成32位以上随机字符串>
CSRF_SECRET_KEY=<生成32位以上随机字符串>
```

### 步骤3: 配置ngrok (可选)
```bash
# 如果需要外网访问，配置ngrok authtoken
cd deploy\ngrok
ngrok.exe authtoken <your_authtoken>
```

### 步骤4: 启动服务
```bash
# 服务器模式
双击 deploy/start_server.bat

# 笔记本模式
双击 deploy/start_server.bat
```

---

## 四、密钥生成方法

### Python生成随机密钥:
```python
import secrets
print(secrets.token_urlsafe(32))
```

### PowerShell生成随机密钥:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## 五、端口冲突处理

如果默认端口被占用，修改 `deploy/config.json`:

```json
{
  "backend_port": 5001,    // 改为其他端口
  "frontend_port": 3001,
  "ngrok_port": 4041
}
```

同时修改后端配置 `backend/config/.env`:
```bash
FLASK_PORT=5001
```

---

## 六、日志位置

- **服务管理日志**: `deploy/logs/service_manager.log`
- **后端运行日志**: `deploy/logs/backend.log`
- **前端运行日志**: `deploy/logs/frontend.log`

---

## 七、常见问题

### Q1: 日志显示乱码
**解决**: 脚本已内置UTF-8编码处理，如仍有问题：
```bash
# 设置控制台编码
chcp 65001
```

### Q2: Python找不到
**解决**: 脚本自动检测Python路径，如失败：
```bash
# 手动设置Python路径
where python
```

### Q3: npm找不到
**解决**: 确保Node.js已安装并添加到PATH：
```bash
where npm
where node
```

### Q4: ngrok无法连接
**解决**: 
1. 检查authtoken是否配置
2. 检查网络连接
3. ngrok免费版有连接限制

---

## 八、安全建议

1. **密钥安全**: 所有SECRET_KEY必须使用强随机字符串
2. **生产环境**: 使用HTTPS，不要暴露5000端口到公网
3. **数据库备份**: 定期备份 `backend/instance/score_management.db`
4. **日志清理**: 定期清理 `deploy/logs/` 目录