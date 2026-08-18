# 部署目录

欢迎使用学生积分管理平台！

## 🚀 快速开始

### 🌟 一键部署（推荐）

**最简单的方式：**

双击运行 `启动器.bat`，选择 "一键部署"，系统将自动完成：
- ✅ 环境检查
- ✅ 依赖安装
- ✅ 配置初始化
- ✅ 数据库创建
- ✅ 服务启动

**或者直接运行：**
- `一键部署.bat` - 批处理版本
- `one_click_deploy.py` - Python版本（更好的体验）

### 📋 分步部署

如果需要更多控制：

1. **安装依赖** → 双击 `download_deps.py`
2. **启动服务** → 双击 `start_server.bat`
3. **访问系统** → 打开 http://localhost:3000

## 📂 文件说明

### 🌟 一键部署文件
| 文件 | 说明 |
|------|------|
| **启动器.bat** | 部署启动器（推荐使用） ⭐ |
| **一键部署.bat** | 批处理一键部署脚本 |
| **one_click_deploy.py** | Python一键部署脚本（更好体验） |

### 📦 标准部署文件
| 文件 | 说明 |
|------|------|
| **start_server.bat** | 一键启动所有服务 |
| **start_server.bat** | 手动启动（备用方案） |
| **stop_all.bat** | 停止所有服务 |
| **check_deploy.py** | 检查服务状态 |
| **download_deps.py** | 安装依赖 |
| **check_deploy.py** | 部署包验证工具 |

### ⚙️ 核心文件
| 文件 | 说明 |
|------|------|
| **service_manager.py** | 服务管理器（核心） |
| **config.json** | 部署配置文件 |

### 📚 文档文件
| 文件 | 说明 |
|------|------|
| **README.md** | 本文档 |
| **QUICK_REFERENCE.md** | 快速参考文档 |
| **DEPLOYMENT_GUIDE.md** | 完整部署指南 |
| **CHANGELOG.md** | 更新记录（位于仓库根目录） |

## 🎯 使用场景

### 场景1：首次部署
```
运行：启动器.bat → 选择 [1] 一键部署
```

### 场景2：日常启动
```
运行：启动器.bat → 选择 [3] 仅启动服务
或直接运行：start_server.bat
```

### 场景3：检查状态
```
运行：启动器.bat → 选择 [4] 检查服务状态
或直接运行：check_deploy.py
```

### 场景4：停止服务
```
运行：启动器.bat → 选择 [5] 停止所有服务
或直接运行：stop_all.bat
```

## 🔐 登录信息

- **用户名**: `admin`
- **密码**: `admin123`

## 🌐 访问地址

| 方式 | 地址 |
|------|------|
| 前端应用 | http://localhost:3000 |
| 后端API | http://localhost:5000 |
| API文档 | http://localhost:5000/apidocs |
| ngrok面板 | http://localhost:4040 |

## 📊 部署流程

### 一键部署流程
```
1. 检查系统环境 (Python, Node.js, npm)
2. 安装后端依赖 (Flask, SQLAlchemy, etc.)
3. 安装前端依赖 (React, Tailwind, etc.)
4. 创建配置文件 (.env)
5. 初始化数据库 (SQLite)
6. 清理端口占用 (3000, 5000, 4040)
7. 启动后端服务 (端口 5000)
8. 启动前端服务 (端口 3000)
```

## ⚡ 快速命令

### Windows批处理
```bash
# 一键部署
.\启动器.bat

# 或直接运行
.\一键部署.bat

# 或Python版本
py one_click_deploy.py
```

### PowerShell
```powershell
# 一键部署
.\启动器.bat

# 或Python版本
py .\one_click_deploy.py
```

## 🔧 故障排除

### 问题1：端口被占用
```bash
运行：stop_all.bat
或手动清理：
netstat -ano | findstr :5000
taskkill /F /PID <进程ID>
```

### 问题2：依赖安装失败
```bash
# 后端
cd ..\backend
pip install -r requirements.txt

# 前端
cd ..\frontend
npm cache clean --force
npm install
```

### 问题3：服务无法启动
```bash
# 检查环境
py --version
node --version

# 检查端口
netstat -ano | findstr :5000
netstat -ano | findstr :3000

# 查看日志
# 后端窗口和前端窗口会显示详细错误信息
```

## 💡 提示

- 🌟 **推荐使用** `启动器.bat` 进行部署
- 📝 **首次部署** 建议使用一键部署
- 🔄 **日常使用** 可直接运行 `start_server.bat`
- 🛠️ **遇到问题** 查看 `DEPLOYMENT_GUIDE.md`
- 📋 **快速参考** 查看 `QUICK_REFERENCE.md`

## 📞 获取帮助

- 查看 `DEPLOYMENT_GUIDE.md` 获取完整文档
- 查看 `QUICK_REFERENCE.md` 获取快速帮助
- 查看 `../CHANGELOG.md` 了解最新更新

---

**祝使用愉快！** 🎉
