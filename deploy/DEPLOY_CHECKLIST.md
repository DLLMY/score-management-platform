# 🚀 快速部署检查清单

## 在新服务器上部署

### 第1步：下载安装 (10分钟)

- [ ] 下载 Python 3.10+
  - 官网: https://www.python.org/downloads/
  - ⚠️ **必须勾选** "Add Python to PATH"

- [ ] 下载 Node.js 18+ (LTS)
  - 官网: https://nodejs.org/
  - 默认安装即可

### 第2步：验证 (5分钟)

- [ ] 打开新的 CMD 窗口
- [ ] 运行: `python --version`
  - [ ] 显示 Python 3.10+
- [ ] 运行: `node --version`
  - [ ] 显示 Node.js 18+

### 第3步：安装依赖 (5-15分钟)

- [ ] 将 `管理平台设计` 文件夹复制到服务器
- [ ] 进入 deploy 目录
- [ ] 双击运行 `install_dependencies.bat`

### 第4步：启动系统 (5分钟)

- [ ] 双击运行 `start.bat`
- [ ] 等待所有服务启动
- [ ] 打开 http://localhost:3000
- [ ] 使用 admin/admin123 登录

---

## 快速命令

```cmd
# 快速检查
python --version
node --version

# 安装依赖
cd 管理平台设计\deploy
install_dependencies.bat

# 启动服务
start.bat
```

---

## 如果遇到问题

### npm 慢

```cmd
# 切换淘宝镜像
npm config set registry https://registry.npmmirror.com
```

### 端口被占用

```cmd
# 停止服务
stop.bat

# 检查状态
check_services.bat
```

---

**需要帮助？查看 NEW_SERVER_DEPLOYMENT.md
