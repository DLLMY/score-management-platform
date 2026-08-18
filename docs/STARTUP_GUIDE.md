# 启动流程指南

本文档说明学生积分管理平台在**开发环境**、**测试环境**和**生产环境**下的标准启动流程。

> 清理日期：2026-07-31。本文档取代历史脚本（`start.bat`、`start_manual.bat`、`一键部署.bat`、`start_laptop.bat` 等）中的启动说明。

## 📋 环境要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Python | 3.10+ | 推荐 3.11 |
| Node.js | 16+ | 推荐 18 LTS（构建生产包需 20.19.0+ 以支持 Vite 8） |
| npm | 8+ | 随 Node.js 安装 |
| Redis | 5.0+ | 可选（未安装时自动降级为内存缓存） |

## 🚀 开发环境启动

### 1. 配置环境变量

```bash
# 后端
cd backend
cp .env.example .env
# 编辑 .env，至少配置 SECRET_KEY 和 JWT_SECRET_KEY

# 前端
cd ../frontend
cp .env.example .env
# 编辑 .env，配置 REACT_APP_API_URL=http://localhost:5000
```

### 2. 安装依赖

```bash
# 后端依赖
cd backend
pip install -r requirements.txt

# 前端依赖
cd ../frontend
npm install
```

### 3. 初始化数据库（首次部署）

```bash
cd backend
python scripts/init_admin.py          # 创建管理员账户
python scripts/migrate_database.py    # 执行数据库迁移
python scripts/seed_test_data.py      # （可选）预置测试数据
```

### 4. 启动服务

**后端**（终端 1）：

```bash
cd backend
python run.py --env development
# 默认监听 http://127.0.0.1:5000
# 开启调试模式：python run.py --env development --debug
```

**前端**（终端 2）：

```bash
cd frontend
npm start
# 默认监听 http://localhost:3000
# 开发服务器已配置代理，/api 请求转发到 http://localhost:5000
```

### 5. 访问系统

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:3000 |
| 后端 API | http://localhost:5000 |
| API 文档（Swagger） | http://localhost:5000/api/docs/ |

**默认登录账户**：`admin` / `123456`

## 🧪 测试环境

### 运行后端测试

```bash
cd backend
python -m pytest tests/ -v
```

### 运行前后端联合测试

确保后端与前端服务均已启动，然后执行：

```bash
cd backend
python scripts/joint_test_v2.py
# 报告输出：JOINT_TEST_REPORT_V2.json
```

### 健康检查

```bash
cd backend
python scripts/full_health_check_v2.py
```

## 🏭 生产环境部署

### 方式一：Waitress（Windows 推荐）

```bash
cd backend
pip install waitress
waitress-serve --host=0.0.0.0 --port=5000 wsgi:application
```

### 方式二：Gunicorn（Linux/Docker 推荐）

```bash
cd backend
pip install gunicorn
gunicorn --config gunicorn_config.py wsgi:application
# 或使用默认参数：
gunicorn --bind 0.0.0.0:5000 --workers=4 --threads=2 wsgi:application
```

### 方式三：Docker Compose

```bash
docker-compose up -d
# 包含后端、前端、Redis 容器
```

### 生产环境配置要点

1. **环境变量**：设置 `FLASK_ENV=production`、`FLASK_DEBUG=false`
2. **密钥**：务必修改 `SECRET_KEY` 和 `JWT_SECRET_KEY` 为强随机值
3. **前端构建**：`cd frontend && npm run build`，使用 Nginx 或静态服务器托管 `build/` 目录
4. **数据库**：建议切换为 MySQL/PostgreSQL，配置 `SQLALCHEMY_DATABASE_URI`
5. **HTTPS**：通过 Nginx/Caddy 反向代理启用 TLS

## 🛠️ 常用维护脚本

位于 `backend/scripts/` 目录：

| 脚本 | 用途 |
|------|------|
| `init_admin.py` | 初始化管理员账户 |
| `manage_admin.py` | 管理员账户管理 |
| `reset_admin_password.py` | 重置管理员密码 |
| `migrate_database.py` | 数据库迁移 |
| `update_db_schema.py` | 更新数据库结构 |
| `backup_db.py` | 数据库备份 |
| `create_indexes.py` | 创建数据库索引 |
| `optimize_database.py` | 数据库优化 |
| `seed_test_data.py` | 预置测试数据 |
| `create_test_accounts.py` | 创建测试账户 |
| `clear_login_locks.py` | 清除登录锁定 |
| `migrate_passwords.py` | 密码迁移至 bcrypt |
| `reset_passwords_bcrypt.py` | 重置密码为 bcrypt |
| `add_rules.py` | 添加积分规则 |
| `joint_test_v2.py` | 前后端联合测试 |
| `full_health_check_v2.py` | API 健康检查 |
| `run_performance_test.py` | 性能测试 |
| `run_bandit.py` | 安全扫描（Bandit） |

## 📁 Windows 部署脚本

位于 `deploy/` 目录（已清理冗余脚本，仅保留以下文件）：

| 脚本 | 用途 |
|------|------|
| `start_server.bat` | 服务器模式启动（生产环境，后台运行） |
| `stop_all.bat` | 停止所有服务 |
| `server_deploy.ps1` | PowerShell 部署脚本 |
| `service_manager.py` | 服务管理器 |
| `one_click_deploy.py` | Python 一键部署脚本 |

## 🔍 故障排查

### 端口被占用

```bash
# 查看占用进程
netstat -ano | findstr ":5000 "
# 终止进程（替换 PID）
taskkill /F /PID <PID>
```

### 后端无法启动

1. 检查 `.env` 文件是否存在且配置完整
2. 检查 Python 依赖：`pip install -r requirements.txt`
3. 检查数据库文件权限：`backend/instance/`
4. 查看日志输出中的错误信息

### 前端无法连接后端

1. 确认后端已启动：`curl http://localhost:5000/api/auth/login`
2. 检查 `frontend/.env` 中的 `REACT_APP_API_URL` 配置
3. 检查 `frontend/package.json` 中的 proxy 配置

### wsgi.py 验证

```bash
cd backend
python -c "from wsgi import application; print('OK:', application)"
```

## 📚 相关文档

- [部署完整指南](../deploy/DEPLOYMENT_GUIDE.md)
- [环境变量配置](../deploy/ENV_CONFIG.md)
- [配置指南](../deploy/CONFIG_GUIDE.md)
- [快速参考](../deploy/QUICK_REFERENCE.md)
- [发布流程](../deploy/RELEASE_GUIDE.md)
- [分支策略](../deploy/BRANCH_STRATEGY.md)
