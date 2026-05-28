# 学生积分管理平台

一个功能完善的学生积分管理系统，支持设备集成、数据分析、权限管理等功能。

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [环境要求](#-环境要求)
- [快速开始](#-快速开始)
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
git clone <repository-url>
cd 管理平台设计
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

**方式一：使用部署脚本（推荐，Windows）**

```bash
cd deploy
install_dependencies.bat
```

**方式二：手动安装**

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd ../frontend
npm install
```

### 4. 启动项目

**方式一：使用一键启动脚本（推荐，Windows）**

```bash
cd deploy
start.bat
```

**方式二：手动启动**

```bash
# 终端1 - 启动后端
cd backend
python app.py

# 终端2 - 启动前端
cd frontend
npm start
```

### 5. 访问系统

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端API | http://localhost:5000 |
| ngrok管理面板 | http://localhost:4040 |

### 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |

## 📁 项目结构

```
管理平台设计/
├── backend/                 # 后端代码
│   ├── models/             # 数据模型
│   ├── routes/             # API路由
│   ├── services/           # 业务服务
│   ├── utils/              # 工具函数
│   ├── instance/           # 数据库文件 (gitignore)
│   ├── backups/            # 备份文件 (gitignore)
│   ├── app.py              # 主应用入口
│   ├── requirements.txt    # Python依赖
│   ├── .env.example        # 环境变量模板
│   └── run.py              # 统一启动脚本
│
├── frontend/               # 前端代码
│   ├── public/             # 静态资源
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API服务
│   │   ├── utils/          # 工具函数
│   │   ├── context/        # React Context
│   │   ├── App.js          # 主应用
│   │   └── index.js        # 入口文件
│   ├── package.json        # Node依赖
│   └── .env.example        # 环境变量模板
│
├── deploy/                 # 部署相关
│   ├── start.bat           # 一键启动
│   ├── start_manual.bat    # 手动启动
│   ├── stop.bat            # 停止服务
│   ├── check_services.bat  # 服务状态检查
│   ├── install_dependencies.bat
│   ├── service_manager.py  # 服务管理器
│   ├── verify_deployment.bat
│   ├── ngrok/              # ngrok配置
│   ├── README.md           # 部署说明
│   ├── QUICK_REFERENCE.md  # 快速参考
│   └── DEPLOYMENT_GUIDE.md # 完整指南
│
├── docs/                   # 文档
├── mqtt-test-tool/         # MQTT测试工具
├── .gitignore              # Git忽略文件
└── README.md               # 本文件
```

## 💻 开发指南

### 后端开发

```bash
cd backend

# 开发模式启动
python app.py

# 生产模式启动
python run.py
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

详细部署说明请参考 [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)。

### 快速部署（Windows）

```bash
cd deploy

# 1. 安装依赖
install_dependencies.bat

# 2. 验证部署包
verify_deployment.bat

# 3. 启动服务
start.bat
```

## 📚 API文档

API文档正在开发中，将支持Swagger/OpenAPI规范。

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
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
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
