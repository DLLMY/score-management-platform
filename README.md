# 学生积分管理平台

一个功能完善的学生积分管理系统，支持设备集成、数据分析、权限管理等能力，
覆盖**成绩录入、请假审批、积分规则、通知下发、设备管控（电话手表/晨读宝）、NLP 智能评分**全流程。

![CI](https://github.com/DLLMY/class-manger-integral/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/DLLMY/class-manger-integral/actions/workflows/deploy.yml/badge.svg)

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [环境要求](#-环境要求)
- [快速开始](#-快速开始)
- [默认账户](#-默认账户)
- [CI/CD 流水线](#-cicd-流水线)
- [项目结构](#-项目结构)
- [开发指南](#-开发指南)
- [测试与回归闸门](#-测试与回归闸门)
- [安全说明](#-安全说明)
- [文档索引](#-文档索引)

## ✨ 功能特性

### 核心功能
- 👥 用户管理 - 学生、教师、管理员账户管理（RBAC 68 条权限）
- 🎯 积分规则 - 灵活的加分/扣分规则配置
- 📊 数据统计 - 多维度数据分析和图表展示
- 📱 设备管理 - MQTT 设备集成、心跳监控、OTA 固件升级、一键开箱
- 🔐 权限管理 - 基于角色的访问控制（学生自助端与 Admin 体系完全隔离）
- 🧠 NLP 智能评分 - 语义解析/规则匹配/情感分析（BERT + 规则双引擎）

### 体验增强（M 系列专项）
- 📋 **批量审批 + 键盘流** - 批量通过/拒绝（逐条结果+一键重试）、常用拒绝理由模板、`J/K` 移动 `Y/N` 审批
- ✏️ **成绩录入键盘流** - `Tab/Enter` 跳格、`↑↓` 切学生、**粘贴批量填充**、越界即时红框、**真实进度条（可取消）**
- 💾 **草稿保护** - 成绩/考试/考勤/通知四类录入页中途刷新可恢复（自动暂存+恢复条）
- 🔔 **通知下发防误发** - 发送前在线设备预览名单 + 失败一键重发
- ⌨️ **全局快捷键** - `Esc` 关弹窗、`Shift+?` 快捷键帮助、`Ctrl+K` 搜索、未读通知同步标签页标题
- 🛡️ **错误文案友好** - 后端技术报错不再直吐用户（210→1 处清理 + 前端防御层）

### 工程能力
- ⚡ **性能**：冷启动 11s、首屏 gzip 190KB、缓存覆盖 20.7%、分页上限 100%、索引纳入部署闸门
- ✅ **质量**：OpenAPI 契约零漂移（464 端点）、五步回归闸门、CI 双 job、157 个后端测试文件

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript + Vite
- Tailwind CSS（统一 DataTable 组件库，56 页全站迁移）
- Recharts（图表）· Lucide（图标）· Vitest（单测 176 用例）

### 后端
- Flask 2.3 + Flask-RESTX（OpenAPI 契约）+ Flask-SocketIO（WebSocket 实时）
- SQLAlchemy（SQLite/MySQL/PostgreSQL）+ Redis 缓存（自动降级）
- PyJWT 双体系认证（Admin access / student 双类型，**HttpOnly Cookie 凭证**）
- paho-mqtt（设备双向通信）· APScheduler（定时任务）· Celery（后台任务，可选）
- torch（NLP，**懒加载**：不影响启动速度）

### 部署
- GitHub Actions（CI：后端五步回归 + 前端 vitest/build/lint；CD：Release）
- Windows 一键部署（`deploy/`：bat / PowerShell / Python 三套脚本）
- Waitress / Gunicorn / Docker Compose

## 📦 环境要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Python | **3.11**（推荐） | 需含 `torch` 等后端依赖；3.10+ 亦可 |
| Node.js | 18+（推荐 20/22） | 前端构建与运行 |
| Redis | 可选 | 缺失时自动降级内存缓存 |
| MQTT Broker | 可选 | 设备功能需要（默认支持 EMQX / 公共 broker） |

> ⚠️ **模型资产（NLP/算法功能运行必需）**：`backend/models/` 下的本地训练模型**不入库**（体积大，`.gitignore` 排除），`git clone` 后需从原环境拷贝，否则 `/api/nlp/*` 与算法分析接口不可用（不影响登录/积分/设备/班级等核心功能）：
> - `backend/models/bert/`（约 393MB，`pytorch_model.bin` 等）— BERT 语义分析
> - `backend/models/trained/`（约 169MB，`*.pkl`）— NLP 文本分类

## 🚀 快速开始

### 方式一：一键部署（Windows，推荐）

```bat
cd deploy
:: 方案 A：Python 版（推荐）
py one_click_deploy.py
:: 方案 B：PowerShell 版
powershell -ExecutionPolicy Bypass -File deploy.ps1
:: 方案 C：服务器模式（已有环境，后台运行）
start_server.bat
```

一键部署自动完成：环境检查 → 依赖安装 → 生成 `.env`（从 `backend/.env.example`，密钥随机）→
建库建表 → **创建核心索引** → 创建默认管理员 → 启动后端（生产模式）→ 启动前端 → 可选 ngrok 外网穿透。

### 方式二：分步部署（手动控制）

```bash
# 1. 后端配置与依赖
cd backend
cp .env.example .env          # 编辑密钥/端口/MQTT 等（可全部留默认）
pip install -r requirements.txt

# 2. 前端配置与构建
cd ../frontend
cp .env.example .env
npm install
npm run build                 # 生产静态包（供 start_server.bat / nginx 使用）

# 3. 初始化数据库与索引（首次）
cd ../backend
python -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all(); print('tables ok')"
python scripts/create_indexes.py --create    # 核心索引（幂等）
python scripts/verify_indexes.py             # 校验（缺失会退出码 1）

# 4. 启动（生产模式，无 reloader）
python run.py --env production --host 0.0.0.0 --port 5000
```

> 📖 完整部署流程（含故障排查/安全加固）见 [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)；
> 环境变量全量说明见 [deploy/ENV_CONFIG.md](deploy/ENV_CONFIG.md)。

### 本地开发模式

```bash
# 后端（开发模式，热重载）
cd backend && python run.py --env development --debug

# 前端（Vite dev server，代理 /api、/ws → 5000）
cd frontend && npm start
```

## 👤 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | **首次启动自动生成** |

- 首次启动后端时若库中无管理员，自动创建 `admin` 账户：
  密码取 `ADMIN_INIT_PASSWORD` 环境变量，未设置则随机生成并**打印在后端启动日志**（请及时登录修改）。
- 设置方式：在 `backend/.env` 中预设 `ADMIN_INIT_PASSWORD=your_password` 后再首次启动。
- 学生自助端：凭卡号 + 姓名双因子登录（`/student/login`）。

## 🔄 CI/CD 流水线

### CI（持续集成）— `.github/workflows/ci.yml`
- **触发**：push 到 `main` / `refactor/*` 分支，或 PR
- **后端 job**（Ubuntu + Python 3.11 + Redis）：安装依赖 → 建库建表 → 建索引 → **五步回归闸门**（RBAC 一致性 / OpenAPI 契约 464 / 契约信封 / 关键路由 / 索引校验）
- **前端 job**（Node 20）：`npm ci` → vitest 176 用例 → 生产构建 → eslint
- **要点**：不安装 torch（M10 懒加载后契约/路由测试无需；G5 走"跳过不阻塞"分支由契约测试兜底）

### CD（持续部署）— `.github/workflows/deploy.yml`
- **触发**：创建 `v*` Tag 或手动触发
- **动作**：自动创建 GitHub Release + 生成 Release Notes

### 发布新版本

```bash
git checkout main && git pull
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

> 部署分支策略（main/develop/feature）见 [deploy/BRANCH_STRATEGY.md](deploy/BRANCH_STRATEGY.md)。

## 📁 项目结构

```
class-manger-integral/
├── .github/workflows/        # ci.yml（回归） / deploy.yml（Release）
├── backend/                  # 后端（app 包工厂 + api 路由 + services 业务）
│   ├── app/                  # 应用工厂 create_app、服务初始化、DB 自举（建表+索引+默认管理员）
│   ├── api/                  # 路由层（按域：scores/academics/devices/nlp/...）
│   ├── services/             # 业务服务（防腐层，写路径事务封装）
│   ├── models/               # 数据模型 + 数据模型资产（BERT 等，不入库）
│   ├── utils/                # 横切：permission(593 处) / response / cache / security
│   ├── scripts/              # create_indexes.py（索引单一来源）/ verify_indexes.py（闸门）
│   ├── startup/              # 生产启动入口（startup.run.main）
│   ├── tests/                # 157 个测试文件 / 约 1979 用例
│   ├── config/               # 配置加载（.env）
│   ├── wsgi.py               # WSGI 入口（Waitress/Gunicorn）
│   ├── run.py                # 统一启动脚本（development/production）
│   └── .env.example          # 环境变量模板（配置唯一来源）
├── frontend/                 # React + TS + Vite
│   ├── src/
│   │   ├── components/       # DataTable 统一组件库 / ConfirmDialog / 布局
│   │   ├── pages/            # 56 个业务页面
│   │   ├── services/         # api.ts（cookie 凭证 + 缓存 + 错误防御）
│   │   ├── hooks/            # useAutoSave（草稿）/ useSubmitGuard / 键盘快捷键
│   │   └── tests/            # vitest 用例
│   └── .env.example
├── deploy/                   # 部署：一键部署 / 服务器模式 / 服务管理 / 文档
├── docs/                     # 启动指南 / MQTT 集成 / 重构评估
├── firmware/                 # ESP32 固件工程（设备端）
├── infra/                    # Dockerfile / mosquitto / pm2 配置
├── tools/                    # 独立工具（remote_notify 桌面通知客户端）
├── reports/                  # 历次项目评估报告
└── scripts/                  # run_regression.sh（五步回归闸门）
```

## 💻 开发指南

### 分支策略

```
main          # 生产分支（受保护，Tag 发布）
  └─ refactor/F17   # 主开发线（当前活跃）
       └─ feature/* / bugfix/*
```

### 本地开发

```bash
# 后端（开发模式，热重载）
cd backend && python run.py --env development --debug

# 前端（Vite dev server）
cd frontend && npm start

# 回归闸门（改动后必跑）
bash scripts/run_regression.sh
```

### 提交规范

参考 [Conventional Commits](https://www.conventionalcommits.org/)：`feat: / fix: / refactor: / docs: / chore: / perf:`。

### 工程约定（重要）

- **Python 必须用系统 3.11**（含 torch 依赖）；git-bash 内的 `python` 可能解析到 managed 3.13（缺依赖）导致后端/回归无法运行
- 新建表格一律用统一 `DataTable` 组件（禁手写原生 `<table>`）；确认弹窗用 `useConfirm`
- API 统一信封 `{success, code, data}`；create 端点历史双元组契约勿改
- 改后端响应 `message` 后必须跑 `verify_openapi_contract.py --strict`（G5 契约零漂移）
- 索引改动后必须跑 `verify_indexes.py`（单一来源 `create_indexes.py`）

## 🧪 测试与回归闸门

| 闸门 | 内容 | 命令 |
|------|------|------|
| G2 RBAC | 权限一致性 68 条 | `scripts/verify_rbac_consistency.py --check-only` |
| G5 OpenAPI | 契约 464 端点零漂移 | `scripts/verify_openapi_contract.py --strict` |
| 契约信封 | 0 个 5xx + shape 快照 | `pytest tests/test_api_envelope.py` |
| 关键路由 | 33 条核心业务路由 | 见 run_regression.sh |
| 索引 | 核心索引齐全 | `scripts/verify_indexes.py` |
| 前端 | vitest 176 + build + eslint | `cd frontend && npm test && npm run build` |

一键跑全量：`bash scripts/run_regression.sh`（五步闸门，CI 同款）。

## 🔒 安全说明

- **认证凭证**：JWT 全走 **HttpOnly Cookie**（`SameSite=Lax`，生产 HTTPS 自动 `Secure`）；
  localStorage 不存任何凭证；Authorization 头轨兼容保留（双轨共存）
- **安全响应头**：CSP + `X-Content-Type-Options` + `X-Frame-Options` + `Referrer-Policy`（中间件统一注入）
- **CSRF**：flask-wtf 启用 + token 注入；**限流**：登录/设备/通知等敏感端点按频控
- **输入安全**：SQL 全参数化（0 拼接）；上传类型/大小校验；SQL 注入/XSS 模式拦截
- **密钥管理**：`.env`（已 gitignore）承载全部密钥；`backend/.env.example` 提供模板，部署脚本自动生成随机密钥
- **生产部署**：建议 HTTPS（`SESSION_COOKIE_SECURE=true`）、修改默认密码、CORS 限定前端域名

## 📚 文档索引

| 文档 | 说明 |
|------|------|
| [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md) | 完整部署指南（含故障排查/安全加固） |
| [deploy/ENV_CONFIG.md](deploy/ENV_CONFIG.md) | 环境变量全量说明 |
| [deploy/QUICK_REFERENCE.md](deploy/QUICK_REFERENCE.md) | 部署快速参考 |
| [deploy/RELEASE_GUIDE.md](deploy/RELEASE_GUIDE.md) | 版本发布流程 |
| [deploy/BRANCH_STRATEGY.md](deploy/BRANCH_STRATEGY.md) | 分支策略 |
| [docs/STARTUP_GUIDE.md](docs/STARTUP_GUIDE.md) | 启动流程指南（开发/测试/生产） |
| [docs/MQTT_INTEGRATION.md](docs/MQTT_INTEGRATION.md) | MQTT 设备集成 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更日志 |
| [reports/](reports/) | 历次项目评估报告（第七~十一次） |

## 📄 许可证

本项目仅供学习和研究使用。

---

**祝使用愉快！** 🎉
