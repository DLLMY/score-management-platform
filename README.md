# 学生积分管理平台

一个功能完善的学生积分管理系统，支持设备集成、数据分析、权限管理等功能。

![CI](https://github.com/DLLMY/class-manger-integral/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/DLLMY/class-manger-integral/actions/workflows/deploy.yml/badge.svg)

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [环境要求](#-环境要求)
- [快速开始](#-快速开始)
- [CI/CD 流水线](#-cicd-流水线)
- [项目结构](#-项目结构)
- [开发指南](#-开发指南)
- [部署说明](#-部署说明)
- [贡献指南](#-贡献指南)

## ✨ 功能特性

### 核心功能
- 👥 用户管理 - 学生、教师、管理员账户管理
- 🎯 积分规则 - 灵活的加分/扣分规则配置
- 📊 数据统计 - 多维度数据分析和图表展示
- 📱 设备管理 - MQTT设备集成和状态监控
- 🔐 权限管理 - 基于角色的访问控制

### 高级功能
- 📈 实时大屏 - 数据概览大屏展示
- 🔔 通知系统 - 积分变动、审批通知
- 📋 审批流程 - 特殊积分调整审批
- 📝 操作日志 - 完整的用户操作审计
- 💾 数据备份 - 自动数据库备份
- 🌐 内网穿透 - ngrok集成支持远程访问

## 🛠️ 技术栈

### 前端
- React 18.2.0
- React Router 6.3.0
- Tailwind CSS 3.3.3
- Recharts 2.10.3 (图表库)
- Lucide React 1.16.0 (图标库)

### 后端
- Flask 2.3.3
- Flask-SQLAlchemy 3.0.5
- Flask-CORS 4.0.0
- Flask-Compress 1.14 (压缩)
- Flask-Limiter 3.3.1 (限流)
- APScheduler 3.10.4 (定时任务)
- Redis 5.0.1 (缓存)
- paho-mqtt 1.6.1 (MQTT客户端)
- Waitress 2.1.2 (WSGI服务器)

### CI/CD
- GitHub Actions - 自动化流水线
- GitHub Releases - 版本管理
- Windows PowerShell - 部署脚本

### 数据库
- SQLite (开发环境)
- 支持MySQL/PostgreSQL (生产环境)

## 📦 环境要求

| 软件 | 版本要求 |
|------|----------|
| Python | 3.10+ |
| Node.js | 16+ |
| npm | 8+ |

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/DLLMY/class-manger-integral.git
cd class-manger-integral
```

### 2. 配置环境变量

```bash
# 后端配置
cd backend
cp .env.example .env
# 编辑 .env 文件，填入你的配置

# 前端配置
cd ../frontend
cp .env.example .env
# 编辑 .env 文件，填入你的配置
```

### 3. 安装依赖

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd ../frontend
npm install
```

### 4. 启动项目

**后端**（终端 1）：

```bash
cd backend
python run.py --env development
# 调试模式：python run.py --env development --debug
```

**前端**（终端 2）：

```bash
cd frontend
npm start
```

> 📖 完整的启动流程（开发/测试/生产）请参考 [docs/STARTUP_GUIDE.md](docs/STARTUP_GUIDE.md)

### ⚠️ 模型资产（NLP/算法功能运行必需）

`backend/models/` 下的本地训练模型**不入库**（体积大，已通过 `.gitignore` 排除），
`git clone` 后需从原环境单独拷贝到 `backend/models/` 下，否则 NLP 与算法分析接口会加载失败：

| 目录 | 内容 | 用途 |
|------|------|------|
| `backend/models/bert/` | BERT 模型（约 393MB，含 `pytorch_model.bin` 等） | NLP 语义分析 |
| `backend/models/trained/` | 训练好的模型（约 169MB，`*.pkl`） | NLP 文本分类 |

> 缺失模型不影响登录、积分、设备、班级等核心功能；但 `/api/nlp/*` 与算法分析相关接口不可用。

### 5. 访问系统

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端API | http://localhost:5000 |
| API文档 | http://localhost:5000/api/docs/ |
| ngrok管理面板 | http://localhost:4040 |

### 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | 123456 |

## 🔄 CI/CD 流水线

### 概述
本项目使用 GitHub Actions 实现完整的 CI/CD 流程，自动测试、构建和部署。

### CI (持续集成)

**触发条件**
- Push 到 `main` 或 `develop` 分支
- 提交 Pull Request

**执行任务**
- 后端测试 (Python 3.10, 3.11)
- 前端构建 (Node.js 18, 20)

**查看 CI 状态**
- 访问 GitHub Actions 页面
- 或查看 README 顶部的徽章

### CD (持续部署)

**触发条件**
- 创建并推送 Tag (格式: `v*`)
- 手动触发 Workflow

**执行任务**
- 自动创建 GitHub Release
- 生成 Release Notes
- (可选) 部署到生产服务器

### 发布新版本

```bash
# 1. 确保在 main 分支
git checkout main

# 2. 创建版本标签
git tag -a v1.0.0 -m "Release version 1.0.0"

# 3. 推送标签，触发 CD
git push origin v1.0.0
```

### 详细文档
完整的 CI/CD 配置和使用说明请参考 [deploy/CICD_GUIDE.md](deploy/CICD_GUIDE.md)。

## 📁 项目结构

```
class-manger-integral/
├── .github/
│   └── workflows/          # GitHub Actions 工作流
│       ├── ci.yml         # CI 流水线
│       └── deploy.yml     # CD 流水线
│
├── backend/                 # 后端代码
│   ├── models/             # 数据模型
│   ├── routes/             # API路由
│   ├── services/           # 业务服务
│   ├── utils/              # 工具函数
│   ├── scripts/            # 数据库脚本
│   ├── tests/              # 测试用例
│   ├── instance/           # 数据库文件 (gitignore)
│   ├── backups/            # 备份文件 (gitignore)
│   ├── app.py              # 应用工厂（create_app）
│   ├── run.py              # 统一启动脚本（开发/生产）
│   ├── wsgi.py             # WSGI 入口（Waitress/Gunicorn）
│   ├── requirements.txt    # Python依赖
│   └── .env.example        # 环境变量模板
│
├── frontend/               # 前端代码
│   ├── public/             # 静态资源
│   ├── src/
│   │   ├── components/     # 组件
│   │   │   ├── charts/    # 图表组件
│   │   │   └── __tests__/ # 组件测试
│   │   ├── pages/          # 页面
│   │   ├── services/       # API服务
│   │   │   └── __tests__/ # 服务测试
│   │   ├── utils/          # 工具函数
│   │   ├── context/        # React Context
│   │   ├── App.js          # 主应用
│   │   └── index.js        # 入口文件
│   ├── package.json        # Node依赖
│   └── .env.example        # 环境变量模板
│
├── deploy/                 # 部署相关
│   ├── start_server.bat    # 服务器模式启动（生产环境）
│   ├── stop_all.bat        # 停止所有服务
│   ├── server_deploy.ps1   # PowerShell 部署脚本
│   ├── service_manager.py  # 服务管理器
│   ├── 一键部署.py          # Python 一键部署脚本
│   ├── ngrok/              # ngrok配置
│   ├── redis/              # Redis 配置
│   ├── README.md           # 部署说明
│   ├── QUICK_REFERENCE.md  # 快速参考
│   ├── DEPLOYMENT_GUIDE.md # 完整指南
│   ├── ENV_CONFIG.md       # 环境变量配置
│   ├── CONFIG_GUIDE.md     # 配置指南
│   ├── RELEASE_GUIDE.md    # 发布流程指南
│   └── BRANCH_STRATEGY.md  # 分支策略指南
│
├── docs/                   # 文档
├── mqtt-test-tool/         # MQTT测试工具
├── CHANGELOG.md            # 版本变更日志
├── .gitignore              # Git忽略文件
└── README.md               # 本文件
```

## 💻 开发指南

### 分支策略

```
main        # 生产环境分支 (受保护)
  └─ develop # 开发分支
       └─ feature/* # 功能分支
       └─ bugfix/*  # 修复分支
```

### 标准开发流程

```bash
# 1. 拉取最新代码
git checkout main
git pull origin main

# 2. 创建功能分支
git checkout -b feature/new-feature

# 3. 开发并提交
git add .
git commit -m "feat: add new feature"

# 4. 推送到远程
git push origin feature/new-feature

# 5. 创建 Pull Request
# 访问 GitHub 创建 PR
```

### Commit Message 规范

参考 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

### 后端开发

```bash
cd backend

# 开发模式启动
python run.py --env development

# 生产模式启动（Waitress）
waitress-serve --host=0.0.0.0 --port=5000 wsgi:application

# 运行测试
python -m pytest tests/ -v

# 前后端联合测试
python scripts/joint_test_v2.py
```

### 前端开发

```bash
cd frontend

# 开发模式启动
npm start

# 构建生产版本
npm run build

# 运行测试
npm test
```

### 代码规范

- 前端：遵循 ESLint 规范
- 后端：遵循 PEP 8 规范
- 提交信息：使用清晰的 commit message

## 🚀 部署说明

### 快速部署（Windows 服务器模式）

```bash
cd deploy

# 启动服务（后台运行，生产模式）
start_server.bat

# 停止所有服务
stop_all.bat
```

### 生产环境部署

**方式一：Waitress（Windows 推荐）**

```bash
cd backend
pip install waitress
waitress-serve --host=0.0.0.0 --port=5000 wsgi:application
```

**方式二：Gunicorn（Linux/Docker）**

```bash
cd backend
pip install gunicorn
gunicorn --config gunicorn_config.py wsgi:application
```

**方式三：Docker Compose**

```bash
docker-compose up -d
```

详细部署说明请参考:
- [docs/STARTUP_GUIDE.md](docs/STARTUP_GUIDE.md) - 启动流程指南
- [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md) - 完整部署指南
- [deploy/ENV_CONFIG.md](deploy/ENV_CONFIG.md) - 环境变量配置

## 📚 API文档

启动后端后访问: http://localhost:5000/api/docs/

主要API端点：
- `/api/users` - 用户管理
- `/api/rules` - 积分规则
- `/api/records` - 积分记录
- `/api/devices` - 设备管理
- `/api/analysis` - 数据分析
- `/api/mqtt` - MQTT集成

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 🔒 安全说明

- 🔐 所有敏感信息存储在环境变量中
- 📝 `.env` 文件已加入 `.gitignore`
- 🔄 生产部署前请修改所有默认密码
- 🛡️ 建议使用 HTTPS 加密传输

## 📄 许可证

本项目仅供学习和研究使用。

## 👥 团队

- 项目维护：[维护者姓名]
- 贡献者：[贡献者列表]

## 📞 联系方式

如有问题，请提交 Issue 或联系开发团队。

---

**祝使用愉快！** 🎉
