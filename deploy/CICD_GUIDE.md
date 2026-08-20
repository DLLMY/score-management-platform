# CI/CD 流水线说明

本文档说明项目的 GitHub Actions 流水线：`.github/workflows/ci.yml`（CI 回归）与 `.github/workflows/deploy.yml`（CD 发布）。

## 📋 目录

- [CI 回归（ci.yml）](#-ci-回归ciyml)
- [CD 发布（deploy.yml）](#-cd-发布deployyml)
- [发布流程](#-发布流程)

---

## 🔬 CI 回归（ci.yml）

**触发条件**：push 到 `main` / `master` / `refactor/**` 分支，或任何 Pull Request。

双 job 并行运行：

### Job 1：后端回归（backend）

- **环境**：`ubuntu-latest` + Python 3.11，并启动 Redis 服务（端口 6379）
- **步骤**：
  1. 安装后端依赖（`pip install -r backend/requirements.txt`）
  2. 初始化数据库与索引（闸门前置）：导入 app 建表 + `python scripts/create_indexes.py --create`（幂等）
  3. 运行回归基线 `bash scripts/run_regression.sh`（五步闸门）：
     - G2 RBAC 权限回归
     - G5 OpenAPI 契约零漂移
     - 后端契约测试
     - 关键路由回归
     - 索引闸门（`verify_indexes.py` 全绿）

### Job 2：前端（frontend）

- **环境**：`ubuntu-latest` + Node.js 22
- **步骤**：
  1. `npm ci` 安装依赖
  2. 单测：`npm test`（vitest）
  3. 生产构建：`npm run build`
  4. Lint：`npm run lint`

> 任一 job 失败即 CI 红，作为合并闸门阻止合入。

---

## 🚀 CD 发布（deploy.yml）

**触发条件**：push 匹配 `v*` 的 Git Tag，或手动 `workflow_dispatch`。

### Build Artifacts（构建产物）

- **环境**：`ubuntu-latest`（Python 3.11 + Node.js 20）
- **步骤**：
  1. 安装后端依赖
  2. 构建前端（`npm run build`）
  3. 使用 `softprops/action-gh-release` 创建 **GitHub Release**（自动生成 Release Notes）

### Deploy to Windows Server（暂禁用）

- `deploy-windows` job 当前通过 `if: ${{ false }}` **禁用**，等待配置正式服务器后再启用。
- 启用后将执行：检出代码 → 安装后端依赖 → 构建前端 → 部署到 Windows 服务器。

---

## 📤 发布流程

发布新版本只需打一个 `v*` Tag 并推送：

```bash
# 1. 打 Tag（示例：v1.5.0）
git tag v1.5.0

# 2. 推送 Tag
git push origin v1.5.0
```

推送后 GitHub Actions 会自动：

1. 触发 `deploy.yml` → 构建前端产物
2. 创建 GitHub Release（版本号 = Tag 名，如 `v1.5.0`）
3. Release Notes 自动附上该 Tag 的提交信息

> 💡 也可以进入 GitHub 仓库 → **Actions** → **Deploy to Production** → **Run workflow** 手动触发。

---

## 📞 相关文档

- 完整部署步骤见 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- 环境变量配置见 [ENV_CONFIG.md](ENV_CONFIG.md)
- 仓库根目录 `README.md` 也包含流水线徽章与状态说明
