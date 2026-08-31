# 学生积分管理平台 - 部署指南

## 📋 目录

- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [手动部署](#手动部署)
- [服务管理](#服务管理)
- [访问地址](#访问地址)
- [故障排查](#故障排查)
- [安全建议](#安全建议)

---

## 🖥️ 环境要求

### 必需软件

| 软件 | 版本 | 说明 | 下载地址 |
|------|------|------|----------|
| Python | 3.11 | 后端运行环境（含 torch 依赖） | https://www.python.org/downloads/ |
| Node.js | 18+ | 前端运行环境 | https://nodejs.org/ |
| ngrok | 3.x | 内网穿透工具（已自带） | 已放在 `deploy/ngrok/` |

### 安装步骤

1. **安装 Python 3.11**
   - 下载并安装 Python 3.11（含 torch 等后端依赖）
   - **重要**：安装时勾选 "Add Python to PATH"
   - ⚠️ **必须使用系统 Python 3.11**：`py` 启动器可能解析到 3.13，而 3.13 缺少 torch 等依赖会导致后端无法启动。`deploy.ps1` / `one_click_deploy.py` 已改为 3.11 绝对路径优先探测，手动部署时请同样确认 `python --version` 输出为 3.11。

2. **安装 Node.js**
   - 下载并安装 Node.js 18+ (LTS版本)
   - 默认安装即可

3. **验证安装**
   ```cmd
   python --version   # 应显示 Python 3.11.x
   node --version
   npm --version
   ```

---

## 🚀 快速部署

### 一键启动（推荐）

```cmd
# 1. 进入部署目录
cd 管理平台设计\deploy

# 2. 一键启动所有服务
start_server.bat
```

> 💡 `one_click_deploy.py`（及 `deploy.ps1`）已自动包含**创建核心索引**（`create_indexes.py --create`）+ **索引完整性校验**（`verify_indexes.py`）步骤，无需手动执行。后端启动时 `app/db_init.py` 也会自动自举核心索引（幂等），部署脚本的索引步骤是双保险。
>
> 🔑 首次启动后端会自动创建默认管理员 `admin`：密码取自 `ADMIN_INIT_PASSWORD` 环境变量，未设置则**随机生成并打印在启动日志**（不再固定 123456）。请从启动日志中获取并尽快修改。

### 一键停止

```cmd
# 进入部署目录
cd 管理平台设计\deploy

# 停止所有服务
stop_all.bat
```

---

## 🔧 手动部署

如果一键脚本无法使用，请按以下步骤手动启动：

### 步骤1：安装依赖

```cmd
cd 管理平台设计\deploy
download_deps.py
```

### 步骤2：创建核心索引（M11+）

```cmd
# 进入后端目录（需要先初始化数据库）
cd 管理平台设计\backend

# 创建核心索引（幂等，已存在会跳过）
python scripts/create_indexes.py --create

# 校验索引完整性（缺失任一索引将退出码 1）
python scripts/verify_indexes.py
```

> 说明：后端启动时 `app/db_init.py` 已自动自举核心索引（幂等），此步骤为部署双保险。直接启动后端也可，但建议显式执行一次以便尽早暴露问题。

### 步骤3：启动后端服务

```cmd
# 新开一个命令行窗口
cd 管理平台设计\backend
python run.py            # 开发环境（默认）
python run.py --env production   # 生产环境（无 reloader，cookie 自动 Secure）
```

> 首次启动时后端会自动创建默认管理员 `admin`：密码取 `ADMIN_INIT_PASSWORD` 环境变量，未设置则随机生成并打印在启动日志。

### 步骤4：启动前端服务

```cmd
# 新开一个命令行窗口
cd 管理平台设计\frontend
npm start
```

### 步骤5：启动内网穿透

```cmd
# 新开一个命令行窗口
cd 管理平台设计\deploy\ngrok
ngrok.exe http 3000
```

---

## ⚙️ 服务管理

### 启动顺序

1. **后端服务** (端口 5000)
   - 开发环境：`cd backend && python run.py`
   - 生产环境：`cd backend && python run.py --env production`（无 reloader）
   - 状态检查：http://localhost:5000/api/docs/

2. **前端服务** (端口 3000)
   - 启动命令：`cd frontend && npm start`
   - 状态检查：http://localhost:3000

3. **ngrok内网穿透** (端口 4040)
   - 启动命令：`cd deploy\ngrok && ngrok.exe http 3000`
   - 管理面板：http://localhost:4040

### 自恢复功能

服务管理器 (`service_manager.py`) 具有以下功能：

- ✅ 自动监控服务状态
- ✅ 服务异常时自动重启（最多5次）
- ✅ 启动前自动清理已有进程
- ✅ 详细的日志记录
- ✅ 支持Ctrl+C优雅停止

---

## 🌐 访问地址

### 本地访问

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:3000 |
| 后端API | http://localhost:5000 |
| API文档 | http://localhost:5000/api/docs/ |
| ngrok面板 | http://localhost:4040 |

### 外网访问

启动ngrok后，访问管理面板查看外网地址：
```
http://localhost:4040
```

外网地址格式：`https://xxxx-xxxx-xxxx.ngrok-free.app`

### 默认登录信息

- **用户名**：`admin`
- **密码**：由 `ADMIN_INIT_PASSWORD` 环境变量决定
  - 设置该变量 → 使用你设置的密码
  - 未设置 → **随机生成**，打印在**后端首次启动日志**中（`⚠️ 临时密码: xxxx`），请及时登录修改
  - 不再固定为 `123456`

---

## 🔍 故障排查

### 问题1：端口被占用

```
Error: Port 3000 is already in use
```

**解决方案**：
```cmd
# 查找占用端口的进程
netstat -ano | findstr ":3000"

# 结束进程（将PID替换为实际进程ID）
taskkill /PID <PID> /F
```

### 问题2：ngrok连接失败

```
ERR_NGROK_8012: Connection refused
```

**解决方案**：
1. 确保前端服务已启动（http://localhost:3000）
2. 重启ngrok：
   ```cmd
   cd deploy\ngrok
   ngrok.exe http 3000
   ```

### 问题3：登录失败（外网访问）

**症状**：本地登录正常，外网访问登录失败

**解决方案**：
1. 确保 `.env` 文件中 `REACT_APP_API_URL=` 为空
2. 重启前端服务：
   ```cmd
   cd frontend
   npm start
   ```

### 问题4：npm install 失败

**解决方案**：
```cmd
# 清理npm缓存
npm cache clean --force

# 删除node_modules
rd /s /q frontend\node_modules

# 重新安装
cd frontend
npm install
```

---

## 🔐 安全建议

### 1. 修改默认密码

后端首次启动自动创建的 `admin` 密码来自 `ADMIN_INIT_PASSWORD`（未设置则随机打印在启动日志）。首次使用后请立即修改管理员密码：
1. 登录系统
2. 进入"个人资料"页面
3. 修改密码

### 2. Cookie 认证与 HTTPS

- 认证凭证通过 **HttpOnly Cookie**（`SameSite=Lax`）传递，**不存 localStorage**，前端无法被 XSS 窃取 token
- `SESSION_COOKIE_SECURE` 控制 Cookie 是否仅 HTTPS 传输：
  - **生产环境（HTTPS）**：默认按 `FLASK_ENV=production` 自动启用 Secure，也可显式设 `SESSION_COOKIE_SECURE=true`
  - **本机 http 调试**：显式设 `SESSION_COOKIE_SECURE=false`，否则 Cookie 在 http 下无法写入导致登录失效
- 生产环境务必配置 HTTPS 证书后以 `python run.py --env production` 启动

### 3. 限制外网访问（可选）

如果仅内网使用，可以：
- 停止ngrok服务
- 只在局域网内访问

### 4. 定期备份数据

```cmd
cd backend
python -c "from utils.backup_utils import backup_manager; backup_manager.create_backup(backup_type='full')"
```

### 5. 查看日志

```cmd
# 查看后端日志
cd backend
python run.py  # 查看控制台输出

# 查看操作日志
# 在系统后台的"操作日志"页面查看
```

---

## 📂 文件结构

```
管理平台设计/
├── deploy/                    # 部署目录
│   ├── service_manager.py    # 服务管理器（自恢复）
│   ├── start_server.bat             # 一键启动脚本
│   ├── stop_all.bat              # 一键停止脚本
│   ├── download_deps.py  # 安装依赖脚本
│   ├── DEPLOYMENT_GUIDE.md  # 本文档
│   └── ngrok/                # 内网穿透工具
│       ├── ngrok.exe
│       ├── ngrok.yml
│       └── start_server.bat
│
├── backend/                  # 后端服务
│   ├── run.py               # Flask应用入口
│   ├── mqtt_client.py       # MQTT客户端
│   ├── instance/            # 数据库
│   └── backups/             # 备份目录
│
├── frontend/                 # 前端服务
│   ├── src/                 # React源代码
│   ├── public/              # 静态资源
│   └── package.json         # 依赖配置
│
└── firmware/phonebox.ino      # ESP32固件
```

---

## 📞 常用命令

### 查看所有服务状态

```cmd
netstat -ano | findstr ":3000 :5000 :4040"
```

### 创建并校验核心索引

```cmd
cd backend
python scripts/create_indexes.py --create   # 幂等创建
python scripts/verify_indexes.py            # 校验完整性（缺失则退出码1）
```

### 重启所有服务

```cmd
# 先停止
cd deploy
stop_all.bat

# 再启动
start_server.bat
```

### 查看ngrok外网地址

```cmd
# 方法1：访问管理面板
start http://localhost:4040

# 方法2：查看命令行输出
# ngrok启动后会显示 Forwarding: https://xxx.ngrok-free.app
```

---

## 🎯 部署检查清单

部署完成后，请确认：

- [ ] Python 3.11（含 torch）已安装，`python --version` 为 3.11.x
- [ ] Node.js 18+ 已安装
- [ ] 核心索引已创建并校验通过（`create_indexes.py --create` + `verify_indexes.py`）
- [ ] 后端服务运行正常（端口5000）
- [ ] 前端服务运行正常（端口3000）
- [ ] ngrok内网穿透已启动
- [ ] 可以通过 http://localhost:3000 访问
- [ ] 可以通过外网地址访问
- [ ] 登录功能正常（admin 密码见 `ADMIN_INIT_PASSWORD` 或启动日志）

---

## 📝 注意事项

1. **保持服务运行**：部署后请保持命令行窗口开启

2. **ngrok免费版限制**：
   - 每次重启会生成新域名
   - 有带宽限制
   - 适合测试和小规模使用

3. **生产环境建议**：
   - 使用固定域名
   - 配置HTTPS证书
   - 使用云服务器部署

---

## 🎉 部署完成！

如果所有服务正常运行，你现在可以：

1. 🌐 访问 http://localhost:3000
2. 🔐 使用 `admin` 登录（密码见 `ADMIN_INIT_PASSWORD`，未设置则查看后端首次启动日志中的临时密码）
3. 📱 通过外网地址访问系统

**有问题？查看上方故障排查或重新阅读本指南！**

---

*最后更新：2026-08-20*
