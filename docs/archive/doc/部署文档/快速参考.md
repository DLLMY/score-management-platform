# 部署工具快速参考

## 📁 文件说明

| 文件 | 功能 | 使用场景 |
|------|------|----------|
| **start.bat** | 一键启动所有服务（推荐） | 正常启动 |
| **start_manual.bat** | 手动启动（备用） | 自动启动失败时使用 |
| **stop.bat** | 一键停止所有服务 | 停止服务 |
| **check_services.bat** | 检查服务状态 | 查看哪些服务在运行 |
| **install_dependencies.bat** | 安装依赖 | 首次部署时运行 |
| **service_manager.py** | 服务管理器（核心） | 自动启动和监控 |
| **DEPLOYMENT_GUIDE.md** | 完整部署指南 | 详细文档 |

---

## 🚀 快速开始

### 首次部署

1. 安装 Python 3.10+
2. 安装 Node.js 18+
3. 运行 `install_dependencies.bat`
4. 运行 `start.bat`
5. 访问 http://localhost:3000

### 日常使用

- **启动**: 双击 `start.bat`
- **停止**: 双击 `stop.bat`
- **检查**: 双击 `check_services.bat`

---

## 🔧 故障排除

### 问题：端口被占用

```cmd
# 运行检查工具
check_services.bat

# 或手动停止
stop.bat
```

### 问题：自动启动失败

```cmd
# 使用备用方案
start_manual.bat
```

### 问题：ngrok 失败

- ngrok 失败不影响本地使用
- 仍然可以访问 http://localhost:3000
- 查看 http://localhost:4040 状态

### 问题：登录失败（外网）

确保 `frontend/.env` 中 `REACT_APP_API_URL=` 为空（删除等号后内容）

---

## 🌐 访问地址

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:3000 |
| 后端API | http://localhost:5000 |
| API文档 | http://localhost:5000/api/docs/ |
| ngrok面板 | http://localhost:4040 |

### 默认登录

- **用户名**: `admin`
- **密码**: `admin123`

---

## 📋 服务状态检查

运行 `check_services.bat` 会显示：

```
✓ 后端服务运行中 (端口: 5000)
✓ 前端服务运行中 (端口: 3000)
✓ ngrok管理面板运行中 (端口: 4040)
```

---

## 🛡 功能特性

### service_manager.py 的功能

- ✅ 无额外依赖（使用Python标准库）
- ✅ 自动检查环境（Python、Node.js）
- ✅ 端口检查和清理
- ✅ 自动重启（最多5次）
- ✅ 实时日志记录
- ✅ ngrok失败不影响本地功能
- ✅ UTF-8编码支持

---

## 📝 部署文件结构

```
deploy/
├── start.bat                    ← 一键启动（推荐）
├── start_manual.bat             ← 手动启动（备用）
├── stop.bat                     ← 一键停止
├── check_services.bat           ← 检查服务状态
├── install_dependencies.bat      ← 安装依赖
├── service_manager.py           ← 服务管理器
├── DEPLOYMENT_GUIDE.md          ← 完整部署指南
├── QUICK_REFERENCE.md           ← 本文档
└── ngrok/                       ← 内网穿透工具
    ├── ngrok.exe
    └── ngrok.yml
```

---

## 🎯 部署流程图

```
首次部署
   ↓
install_dependencies.bat
   ↓
检查环境（Python、Node.js）
   ↓
start.bat
   ↓
service_manager.py
   ↓
检查端口 → 清理冲突 → 启动后端 → 启动前端 → 启动ngrok
   ↓
访问 http://localhost:3000
```

---

## 💡 提示

1. **Windows 防御者**: 如果提示安全警告，点击"更多信息" → "仍要运行"
2. **首次启动**: 前端需要1-2分钟编译，请耐心等待
3. **多个窗口**: start_manual.bat 会打开多个窗口，保持它们打开
4. **日志文件**: service_manager.log 记录了详细日志
5. **外网地址**: 查看 ngrok 窗口或 http://localhost:4040

---

## 📞 需要帮助？

查看完整文档：`DEPLOYMENT_GUIDE.md`

---

**祝部署顺利！** 🚀
