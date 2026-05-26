
# 积分管理平台 - 部署指南

---

## 一、项目概述

### 1.1 项目结构

```
管理平台设计/
├── backend/                    # Flask 后端服务
│   ├── app.py                 # 主应用入口
│   ├── requirements.txt       # Python 依赖列表
│   ├── instance/              # SQLite 数据库目录（.gitignore）
│   └── backups/               # 数据库备份目录（.gitignore）
├── frontend/                  # React 前端应用
│   ├── src/                   # 前端源码
│   ├── build/                 # 构建产物（服务器构建）
│   └── package.json           # 前端依赖配置
├── deploy/                    # 部署相关脚本
│   └── ngrok/                 # ngrok 内网穿透配置
└── DEPLOYMENT_GUIDE_DETAILED.md  # 本部署指南
```

### 1.2 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 后端框架 | Flask | 2.3.3 | Python REST API |
| 数据库 | SQLite | 内置 | 轻量级嵌入式数据库 |
| 前端框架 | React | 18.2.0 | 单页应用框架 |
| 样式框架 | Tailwind CSS | 3.3.3 | CSS 框架 |
| 图表库 | Recharts | 2.10.3 | 数据可视化 |
| MQTT 客户端 | paho-mqtt | 1.6.1 | 物联网消息通信 |
| 进程管理 | PM2 | 最新 | Node.js 进程管理 |

---

## 二、开发机配置

### 2.1 环境要求

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| Git | 2.0+ | 版本控制 |
| Node.js | 18.x LTS | 前端开发和构建 |
| Python | 3.9+ | 后端开发 |
| npm | 9.x+ | 前端包管理 |

### 2.2 配置步骤

#### 步骤 1：配置 Git 全局设置

```bash
# 配置用户名和邮箱
git config --global user.name "你的姓名"
git config --global user.email "你的邮箱@example.com"

# 配置换行符处理（避免跨平台问题）
git config --global core.autocrlf false
git config --global core.safecrlf true
```

#### 步骤 2：生成 SSH 密钥（用于 push 代码）

```bash
# 生成 SSH 密钥（一路回车即可，不需要设置密码）
ssh-keygen -t rsa -b 4096 -C "你的邮箱@example.com"

# 查看公钥内容
cat ~/.ssh/id_rsa.pub
```

**将公钥添加到 GitHub**：
1. 登录 GitHub → Settings → SSH and GPG keys
2. 点击 "New SSH key"
3. 粘贴公钥内容，设置标题（如 "开发机-XXX"）

#### 步骤 3：克隆仓库

```bash
# 使用 SSH 协议克隆
git clone git@github.com:yourname/yourrepo.git .

# 如果使用 HTTPS（不推荐，每次需要输入密码）
git clone https://github.com/yourname/yourrepo.git .
```

#### 步骤 4：安装依赖

```bash
# 安装后端依赖
cd backend
pip install -r requirements.txt

# 安装前端依赖
cd ../frontend
npm install
```

#### 步骤 5：本地开发

```bash
# 启动后端服务（开发模式）
cd backend
python app.py

# 启动前端开发服务器（另一个终端）
cd frontend
npm start
```

---

## 三、服务器配置（Windows）

### 3.1 环境要求

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| Git | 2.0+ | 拉取代码 |
| Node.js | 18.x LTS | 前端构建 |
| Python | 3.9+ | 运行后端 |
| npm | 9.x+ | 前端依赖安装 |
| PM2 | 最新 | 进程管理 |

### 3.2 配置步骤

#### 步骤 1：安装基础软件

1. **安装 Git**：从 https://git-scm.com/download/win 下载安装
2. **安装 Node.js**：从 https://nodejs.org/ 下载 LTS 版本
3. **安装 Python**：从 https://www.python.org/downloads/windows/ 下载 3.9+ 版本

#### 步骤 2：生成服务器 SSH 密钥（用于 pull 代码）

```powershell
# 以管理员身份打开 PowerShell
ssh-keygen -t rsa -b 4096 -C "server@yourdomain.com"

# 查看公钥内容
Get-Content ~/.ssh/id_rsa.pub
```

**将服务器公钥添加到 GitHub**：
1. 登录 GitHub → Settings → SSH and GPG keys
2. 点击 "New SSH key"
3. 粘贴公钥内容，设置标题（如 "服务器-XXX"）

#### 步骤 3：克隆仓库到服务器

```powershell
# 创建项目目录
mkdir C:\Projects
cd C:\Projects

# 克隆仓库（使用 SSH）
git clone git@github.com:yourname/yourrepo.git score-management

cd score-management
```

#### 步骤 4：安装依赖

```powershell
# 安装后端依赖
cd backend
pip install -r requirements.txt

# 安装前端依赖
cd ../frontend
npm install

# 安装 PM2（进程管理工具）
npm install -g pm2
```

#### 步骤 5：配置 PM2 管理后端服务

创建 `pm2.config.json` 文件在项目根目录：

```json
{
  "apps": [
    {
      "name": "score-backend",
      "script": "app.py",
      "interpreter": "python",
      "cwd": "./backend",
      "env": {
        "FLASK_ENV": "production",
        "PYTHONPATH": "./backend"
      },
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "256M",
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "error_file": "./logs/error.log",
      "out_file": "./logs/out.log",
      "merge_logs": true
    }
  ]
}
```

**创建日志目录并启动服务**：

```powershell
mkdir logs
pm2 start pm2.config.json

# 保存 PM2 配置（重启后自动恢复）
pm2 save
pm2 startup
```

#### 步骤 6：测试手动部署流程

```powershell
# 拉取最新代码
git pull origin main

# 构建前端
cd frontend
npm run build

# 重启后端服务
pm2 restart score-backend
```

---

## 四、自动部署配置

### 4.1 创建自动部署脚本

创建 `auto_deploy.ps1` 在项目根目录：

```powershell
<#
.SYNOPSIS
积分管理平台自动部署脚本

.DESCRIPTION
定时检查 Git 仓库更新，自动拉取代码、构建前端、重启后端服务

.NOTES
- 需要配置 SSH 密钥避免密码输入
- 需要提前安装 Node.js、Python、PM2
- 需要配置正确的项目路径
#>

# ========== 配置区域 ==========
$PROJECT_PATH = "C:\Projects\score-management"
$BRANCH = "main"
$LOG_FILE = "C:\Projects\deploy.log"
$ERROR_LOG_FILE = "C:\Projects\deploy_error.log"
$LOCK_FILE = "C:\Projects\deploy.lock"
$PM2_APP_NAME = "score-backend"
$WEBHOOK_URL = $null  # 可选：企业微信/钉钉告警 Webhook
# ========== 配置结束 ==========

# 确保日志目录存在
$logDir = Split-Path $LOG_FILE
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Write-Log {
    param(
        [string]$Message,
        [string]$LogFile = $LOG_FILE
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$timestamp] $Message"
}

function Send-Alert {
    param(
        [string]$Message
    )
    if ($WEBHOOK_URL) {
        try {
            $body = @{
                msgtype = "text"
                text = @{
                    content = "部署告警: $Message"
                }
            } | ConvertTo-Json
            Invoke-RestMethod -Uri $WEBHOOK_URL -Method Post -Body $body -ContentType "application/json"
        }
        catch {
            Write-Log "发送告警失败: $_" $ERROR_LOG_FILE
        }
    }
}

# 检查锁文件，防止并发执行
if (Test-Path $LOCK_FILE) {
    Write-Log "检测到正在运行的部署进程，退出"
    exit 0
}

# 创建锁文件
try {
    New-Item -Path $LOCK_FILE -ItemType File -Force | Out-Null
}
catch {
    Write-Log "创建锁文件失败: $_" $ERROR_LOG_FILE
    exit 1
}

# 确保脚本结束时删除锁文件
trap {
    if (Test-Path $LOCK_FILE) {
        Remove-Item $LOCK_FILE -Force -ErrorAction SilentlyContinue
    }
    Write-Log "部署异常终止: $_" $ERROR_LOG_FILE
    Send-Alert "部署异常终止: $_"
    exit 1
}

try {
    Write-Log "=== 开始自动部署 ==="
    
    # 切换到项目目录
    Set-Location $PROJECT_PATH -ErrorAction Stop
    
    # 获取远程和本地 commit hash
    Write-Log "获取远程 commit..."
    $remoteHash = git ls-remote origin $BRANCH | Select-Object -First 1 | ForEach-Object { $_.Split()[0] }
    
    Write-Log "获取本地 commit..."
    $localHash = git rev-parse HEAD
    
    Write-Log "远程 commit: $remoteHash"
    Write-Log "本地 commit: $localHash"
    
    # 检查是否有更新
    if ($remoteHash -eq $localHash) {
        Write-Log "无新代码，部署结束"
        Remove-Item $LOCK_FILE -Force
        exit 0
    }
    
    Write-Log "发现新代码，开始拉取..."
    
    # 拉取最新代码
    git pull origin $BRANCH
    if ($LASTEXITCODE -ne 0) {
        throw "git pull 失败，退出码: $LASTEXITCODE"
    }
    Write-Log "代码拉取成功"
    
    # 前端构建
    Write-Log "开始前端构建..."
    Set-Location "$PROJECT_PATH\frontend"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build 失败，退出码: $LASTEXITCODE"
    }
    Write-Log "前端构建成功"
    
    # 重启后端服务
    Write-Log "重启后端服务..."
    pm2 restart $PM2_APP_NAME
    if ($LASTEXITCODE -ne 0) {
        throw "pm2 restart 失败，退出码: $LASTEXITCODE"
    }
    Write-Log "后端服务重启成功"
    
    Write-Log "=== 部署完成 ==="
}
catch {
    Write-Log "部署失败: $_" $ERROR_LOG_FILE
    Send-Alert "部署失败: $_"
    throw
}
finally {
    # 清理锁文件
    if (Test-Path $LOCK_FILE) {
        Remove-Item $LOCK_FILE -Force -ErrorAction SilentlyContinue
    }
}
```

**设置脚本执行权限**：

```powershell
# 以管理员身份执行
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### 4.2 配置 Windows 任务计划

#### 步骤 1：打开任务计划程序

- 按下 Win + R，输入 `taskschd.msc`，回车

#### 步骤 2：创建基本任务

1. **名称**：积分管理平台自动部署
2. **触发器**：每天，设置开始时间为 00:00，选择 "每天重复任务"，间隔 5 分钟，持续时间 24 小时
3. **操作**：启动程序
   - 程序/脚本：`powershell.exe`
   - 添加参数：`-ExecutionPolicy Bypass -File "C:\Projects\score-management\auto_deploy.ps1"`
4. **条件**：取消勾选 "唤醒计算机运行此任务"
5. **设置**：勾选 "允许任务按需运行"、"如果任务失败，每 5 分钟重试最多 3 次"

#### 步骤 3：配置高级设置

1. 右键任务 → 属性
2. **安全选项**：勾选 "使用最高权限运行"
3. **触发器** → 编辑：确保重复间隔正确

### 4.3 测试自动部署

```powershell
# 手动执行一次脚本测试
.\auto_deploy.ps1

# 查看部署日志
Get-Content C:\Projects\deploy.log -Tail 20
```

---

## 五、.gitignore 配置

确保以下文件和目录不被 Git 追踪：

```gitignore
# 数据库文件
backend/instance/
*.db
*.db-journal

# 备份文件
backend/backups/

# 前端依赖和构建
frontend/node_modules/
frontend/.env
frontend/.env.local

# 日志文件
logs/
*.log

# ngrok 配置（包含敏感信息）
deploy/ngrok/ngrok.yml
deploy/ngrok/*.log

# PM2 配置（可选，如果在仓库中）
# pm2.config.json

# Python 缓存
__pycache__/
*.pyc
*.pyo

# Node.js 缓存
npm-debug.log
yarn-error.log

# Windows 临时文件
Thumbs.db
*.tmp
```

---

## 六、部署流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        开发机工作流程                               │
├─────────────────────────────────────────────────────────────────────┤
│  编写代码 → git add → git commit → git push origin main            │
│                                 ↓                                   │
│                    GitHub 仓库更新                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        服务器自动流程                               │
├─────────────────────────────────────────────────────────────────────┤
│  [任务计划] 每 5 分钟执行 auto_deploy.ps1                           │
│          ↓                                                         │
│  检查远程 commit 是否与本地一致                                      │
│          ↓                                                         │
│  ┌──────────────┐    是    ┌────────────┐                          │
│  │ 有新代码？   │────────→│ 退出等待   │                          │
│  └──────────────┘          └────────────┘                          │
│       │ 否                                                          │
│       ↓                                                            │
│  git pull origin main                                              │
│       ↓                                                            │
│  npm run build (frontend)                                          │
│       ↓                                                            │
│  pm2 restart score-backend                                         │
│       ↓                                                            │
│  部署完成，记录日志                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 七、常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `git pull` 要求输入密码 | 使用了 HTTPS 协议或 SSH 密钥未配置 | 切换到 SSH 协议，配置 SSH 密钥 |
| `npm install` 失败 | Node.js 版本不兼容或网络问题 | 安装 LTS 版本，检查网络代理 |
| PM2 无法启动 Python | 未指定 interpreter 或路径错误 | 在 pm2.config.json 中设置 `"interpreter": "python"` |
| 前端构建产物无法访问 | 构建路径错误或静态文件未复制 | 检查 Flask 静态目录配置 |
| 任务计划不执行 | 权限不足或路径错误 | 勾选 "使用最高权限运行"，使用绝对路径 |
| 脚本被阻止执行 | PowerShell 执行策略限制 | 执行 `Set-ExecutionPolicy RemoteSigned` |

---

## 八、维护与监控

### 8.1 查看日志

```powershell
# 查看部署日志
Get-Content C:\Projects\deploy.log -Tail 30

# 查看后端服务日志
pm2 logs score-backend

# 查看错误日志
Get-Content C:\Projects\deploy_error.log -Tail 20
```

### 8.2 PM2 常用命令

```powershell
# 查看进程状态
pm2 list

# 查看服务日志
pm2 logs score-backend

# 重启服务
pm2 restart score-backend

# 停止服务
pm2 stop score-backend

# 查看服务详情
pm2 show score-backend
```

### 8.3 手动更新

```powershell
# 手动触发部署
cd C:\Projects\score-management
.\auto_deploy.ps1

# 或分步执行
git pull origin main
cd frontend
npm run build
pm2 restart score-backend
```

---

## 九、安全注意事项

1. **SSH 密钥安全**：
   - 服务器私钥文件权限设置为 600（Windows 上确保只有管理员可访问）
   - 不要将私钥提交到 Git 仓库

2. **数据库安全**：
   - 定期备份数据库
   - 不要将数据库文件提交到 Git

3. **配置安全**：
   - 敏感配置（如密码、密钥）使用环境变量
   - ngrok 配置文件不要提交到 Git

4. **访问控制**：
   - 限制服务器访问权限
   - 定期更新系统和依赖包

---

## 十、版本历史

| 版本 | 日期 | 修改内容 |
|------|------|----------|
| v1.0 | 2026-05-26 | 初始版本，包含基础部署流程 |

---

**文档结束**

如有问题，请联系开发人员。
