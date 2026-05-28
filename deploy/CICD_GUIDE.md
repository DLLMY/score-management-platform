# CI/CD 配置指南

## 📋 目录
- [概述](#概述)
- [CI 流水线配置](#ci-流水线配置)
- [CD 部署配置](#cd-部署配置)
- [GitHub 仓库设置](#github-仓库设置)
- [本地开发流程](#本地开发流程)
- [部署到生产环境](#部署到生产环境)
- [故障排查](#故障排查)

---

## 🚀 概述

本项目使用 GitHub Actions 实现完整的 CI/CD 流程：

| 流程 | 触发条件 | 说明 |
|------|----------|------|
| **CI** | push 到 main/develop、PR | 自动构建、测试 |
| **CD** | tag (v*)、手动触发 | 自动创建 Release、部署 |

---

## 🔧 CI 流水线配置

### 工作流文件
`.github/workflows/ci.yml`

### CI 包含的任务
1. **后端测试** (Python 3.10, 3.11)
   - 安装依赖
   - 运行 pytest 测试

2. **前端构建** (Node.js 18, 20)
   - 安装依赖
   - 生产构建
   - 上传构建产物

### 触发 CI 的方式
```bash
# 1. 推送代码到 main 分支
git push origin main

# 2. 创建 Pull Request
gh pr create --title "Feature" --body "Description"

# 3. 推送代码到 develop 分支
git push origin develop
```

---

## 📦 CD 部署配置

### 工作流文件
`.github/workflows/deploy.yml`

### CD 包含的任务
1. **创建 Release**
   - 自动生成 Release Notes
   - 打包发布版本

2. **部署到服务器** (可选)
   - Windows 服务器自动部署

### 触发 CD 的方式

#### 方式一: 创建 Tag (推荐)
```bash
# 1. 创建版本标签
git tag -a v1.0.0 -m "Release version 1.0.0"

# 2. 推送标签
git push origin v1.0.0
```

#### 方式二: 手动触发
1. 访问 GitHub 仓库的 Actions 页面
2. 选择 "CD - Deploy to Production"
3. 点击 "Run workflow"

---

## ⚙️ GitHub 仓库设置

### 1. 配置 Secrets (如需要)

进入仓库 → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | 说明 | 示例 |
|-------------|------|------|
| `SERVER_HOST` | 部署服务器地址 | `192.168.1.100` |
| `SERVER_USER` | 服务器用户名 | `admin` |
| `SERVER_PASSWORD` | 服务器密码 | `***` |

### 2. 启用 GitHub Pages (可选)

用于托管前端构建产物：
- Settings → Pages
- Source: Deploy from a branch
- Branch: gh-pages

---

## 💻 本地开发流程

### 分支策略
```
main        # 生产环境分支 (保护)
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
gh pr create --base develop --title "New Feature" --body "Description"

# 6. 合并后删除本地分支
git checkout develop
git branch -d feature/new-feature
```

### 发布版本流程

```bash
# 1. 切换到 main
git checkout main
git merge develop

# 2. 创建版本标签
git tag -a v1.1.0 -m "Release v1.1.0"

# 3. 推送
git push origin main --tags

# 4. 等待 CI/CD 自动部署
```

---

## 🌐 部署到生产环境

### 方式一: 使用部署脚本 (Windows)

```powershell
# 1. 进入部署目录
cd deploy

# 2. 运行生产部署脚本
.\deploy-production.ps1 -TargetPath "C:\production\class-manger-integral"

# 3. 启动服务
.\windows-service.ps1 -Action start
```

### 方式二: 手动部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装后端依赖
cd backend
pip install -r requirements.txt

# 3. 构建前端
cd ../frontend
npm ci
npm run build

# 4. 启动服务
cd ../backend
python app.py &
cd ../frontend
npm start &
```

### 服务管理 (Windows)

```powershell
# 查看状态
.\deploy\windows-service.ps1 -Action status

# 启动服务
.\deploy\windows-service.ps1 -Action start

# 停止服务
.\deploy\windows-service.ps1 -Action stop

# 重启服务
.\deploy\windows-service.ps1 -Action restart
```

---

## 🐛 故障排查

### CI 失败常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 依赖安装失败 | 网络问题或版本不兼容 | 检查 requirements.txt/package.json |
| 测试失败 | 代码变更导致测试不通过 | 修复测试或更新测试用例 |
| 前端构建失败 | 代码有语法错误 | 本地运行 npm run build 检查 |

### CD 部署失败常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 标签格式错误 | 标签名不是 v* 格式 | 使用 git tag -a v1.0.0 |
| 权限不足 | GitHub Token 权限不够 | 检查仓库权限设置 |

### 查看 CI/CD 日志

1. 访问 GitHub 仓库 Actions 页面
2. 选择对应的 workflow run
3. 点击 job 查看详细日志

---

## 📊 CI/CD 状态检查

在 README 中添加状态徽章 (可选):

```markdown
![CI](https://github.com/DLLMY/class-manger-integral/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/DLLMY/class-manger-integral/actions/workflows/deploy.yml/badge.svg)
```

---

## 🎯 最佳实践

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

### 发布流程清单

- [ ] 所有测试通过 ✅
- [ ] 代码已 Review ✅
- [ ] 更新版本号 ✅
- [ ] 更新 CHANGELOG ✅
- [ ] 创建 Tag ✅
- [ ] 触发部署 ✅
