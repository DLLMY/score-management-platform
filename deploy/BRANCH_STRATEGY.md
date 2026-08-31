# Git 分支策略指南

本文档定义了学生积分管理平台的 Git 分支策略、命名规范和工作流程。

---

## 一、分支策略概述

项目采用 **简化的 Git Flow** 分支策略，适用于小型团队和快速迭代场景。

### 1.1 分支结构图

```
main (生产分支)
  │
  └─ develop (开发主分支)
       │
       ├─ feature/* (功能分支)
       │    ├─ feature/user-management
       │    └─ feature/nlp-integration
       │
       ├─ bugfix/* (修复分支)
       │    └─ bugfix/login-style
       │
       └─ refactor/* (重构分支)
            └─ refactor/api-routes
       
main
  │
  └─ hotfix/* (热修复分支)
       └─ hotfix/security-patch
```

---

## 二、分支类型与用途

| 分支类型 | 命名规范 | 用途 | 生命周期 |
|----------|----------|------|----------|
| `main` | - | 生产环境代码，始终保持可部署状态 | 永久 |
| `develop` | - | 开发主分支，集成各功能分支 | 永久 |
| `feature/*` | `feature/<功能名>` | 新功能开发 | 临时 |
| `bugfix/*` | `bugfix/<问题描述>` | Bug 修复 | 临时 |
| `refactor/*` | `refactor/<重构描述>` | 代码重构 | 临时 |
| `release/*` | `release/v<版本号>` | 发布准备 | 临时 |
| `hotfix/*` | `hotfix/<问题描述>` | 生产环境紧急修复 | 临时 |

---

## 三、分支命名规范

### 3.1 功能分支 (feature)

```bash
# 格式: feature/<功能模块>-<具体功能>
feature/user-management-add-role
feature/nlp-bert-integration
feature/dashboard-real-time
```

### 3.2 修复分支 (bugfix)

```bash
# 格式: bugfix/<问题描述>
bugfix/login-page-style
bugfix/api-pagination-error
bugfix/export-encoding-issue
```

### 3.3 热修复分支 (hotfix)

```bash
# 格式: hotfix/<问题描述>
hotfix/security-xss-fix
hotfix/database-connection-leak
```

### 3.4 发布分支 (release)

```bash
# 格式: release/v<版本号>
release/v1.1.0
release/v2.0.0
```

---

## 四、标准工作流程

### 4.1 新功能开发流程

```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 2. 开发功能（多次提交）
git add .
git commit -m "feat: implement feature part 1"
git commit -m "feat: implement feature part 2"

# 3. 推送到远程
git push origin feature/new-feature

# 4. 创建 Pull Request
# (在 GitHub 上创建 PR: feature/new-feature -> develop)

# 5. 代码审查通过后合并
# (通过 GitHub 合并 PR)

# 6. 删除功能分支
git checkout develop
git pull origin develop
git branch -d feature/new-feature
git push origin --delete feature/new-feature
```

### 4.2 Bug 修复流程

```bash
# 1. 从 develop 创建修复分支
git checkout develop
git pull origin develop
git checkout -b bugfix/bug-description

# 2. 修复 Bug
git add .
git commit -m "fix: resolve bug description"

# 3. 推送并创建 PR
git push origin bugfix/bug-description

# 4. 合并后删除
git checkout develop
git pull origin develop
git branch -d bugfix/bug-description
```

### 4.3 发布流程

```bash
# 1. 从 develop 创建发布分支
git checkout develop
git pull origin develop
git checkout -b release/v1.1.0

# 2. 发布准备（更新版本号、文档等）
git add .
git commit -m "chore: prepare release v1.1.0"

# 3. 合并到 main
git checkout main
git merge release/v1.1.0

# 4. 打标签
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin main --tags

# 5. 合并回 develop
git checkout develop
git merge release/v1.1.0
git push origin develop

# 6. 删除发布分支
git branch -d release/v1.1.0
```

### 4.4 热修复流程

```bash
# 1. 从 main 创建热修复分支
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. 修复问题
git add .
git commit -m "fix: critical bug fix"

# 3. 合并到 main 并打标签
git checkout main
git merge hotfix/critical-bug
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin main --tags

# 4. 合并回 develop
git checkout develop
git merge hotfix/critical-bug
git push origin develop

# 5. 删除热修复分支
git branch -d hotfix/critical-bug
```

---

## 五、分支保护规则

### 5.1 main 分支保护

| 规则 | 说明 |
|------|------|
| 禁止直接推送 | 只能通过 PR 合并 |
| 需要 PR 审查 | 至少 1 人审查通过 |
| 需要 CI 通过 | 所有测试必须通过 |
| 禁止强制推送 | 防止历史被覆盖 |

### 5.2 develop 分支保护

| 规则 | 说明 |
|------|------|
| 禁止直接推送 | 只能通过 PR 合并 |
| 需要 CI 通过 | 所有测试必须通过 |

---

## 六、Pull Request 规范

### 6.1 PR 标题格式

```
<type>(<scope>): <subject>

示例:
feat(user): add role management feature
fix(api): resolve pagination error
refactor(auth): optimize login flow
docs(readme): update installation guide
```

### 6.2 PR 描述模板

```markdown
## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 文档 (docs)
- [ ] 其他

## 变更说明
简要描述本次变更的内容和原因。

## 影响范围
- [ ] 前端
- [ ] 后端
- [ ] 数据库
- [ ] 配置文件

## 测试情况
描述已执行的测试和结果。

## 相关 Issue
Closes #<issue_number>
```

### 6.3 PR 审查要点

| 审查项 | 检查内容 |
|--------|----------|
| 代码质量 | 是否遵循规范、是否有冗余代码 |
| 功能正确性 | 是否实现预期功能、边界情况处理 |
| 测试覆盖 | 是否有足够的单元测试 |
| 文档更新 | 是否更新相关文档 |
| 安全性 | 是否存在安全风险 |

---

## 七、提交信息规范

### 7.1 Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 7.2 类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(user): add role management` |
| `fix` | Bug 修复 | `fix(api): resolve pagination error` |
| `refactor` | 重构 | `refactor(auth): optimize login flow` |
| `docs` | 文档更新 | `docs(readme): update guide` |
| `style` | 代码格式 | `style: fix indentation` |
| `test` | 测试相关 | `test(user): add unit tests` |
| `chore` | 构建/工具 | `chore: update dependencies` |
| `perf` | 性能优化 | `perf(db): optimize query` |

### 7.3 提交示例

```bash
# 好的提交
git commit -m "feat(user): add role-based permission control"
git commit -m "fix(api): resolve user list pagination issue"
git commit -m "docs(readme): update installation requirements"

# 不好的提交
git commit -m "fix bug"
git commit -m "update"
git commit -m "changes"
```

---

## 八、分支管理最佳实践

### 8.1 保持分支整洁

```bash
# 在合并前变基（保持线性历史）
git checkout feature/new-feature
git rebase develop

# 或使用 merge（保留完整历史）
git checkout feature/new-feature
git merge develop
```

### 8.2 定期清理分支

```bash
# 列出已合并的分支
git branch --merged develop

# 删除本地已合并分支
git branch --merged develop | grep -v "^\*\|develop\|main" | xargs git branch -d

# 删除远程已合并分支
git push origin --delete feature/completed-feature
```

### 8.3 避免常见错误

| 错误 | 正确做法 |
|------|----------|
| 直接推送到 main | 使用 PR 合并 |
| 功能分支过大 | 拆分为多个小分支 |
| 长期不合并 develop | 定期同步 develop 到功能分支 |
| 提交信息模糊 | 使用规范的提交信息 |

---

## 九、特殊情况处理

### 9.1 合并冲突解决

```bash
# 1. 拉取最新代码
git checkout develop
git pull origin develop

# 2. 切换到功能分支并合并
git checkout feature/new-feature
git merge develop

# 3. 解决冲突
# (手动编辑冲突文件)

# 4. 标记已解决
git add <resolved-file>
git commit -m "merge: resolve conflicts with develop"

# 5. 推送
git push origin feature/new-feature
```

### 9.2 撤销错误提交

```bash
# 撤销最近一次提交（保留更改）
git reset --soft HEAD~1

# 撤销最近一次提交（丢弃更改）
git reset --hard HEAD~1

# 撤销已推送的提交（创建新提交）
git revert <commit-hash>
```

---

## 十、附录

### A. 常用命令速查

```bash
# 分支操作
git branch -a                    # 列出所有分支
git checkout -b <branch>         # 创建并切换分支
git branch -d <branch>           # 删除本地分支
git push origin --delete <branch># 删除远程分支

# 合并操作
git merge <branch>               # 合并分支
git rebase <branch>              # 变基

# 标签操作
git tag -a v1.0.0 -m "message"   # 创建标签
git push origin --tags           # 推送所有标签
git push origin v1.0.0           # 推送单个标签
git tag -d v1.0.0                # 删除本地标签
```

### B. 相关文档

- [发布流程指南](./RELEASE_GUIDE.md)
- [CI/CD 指南](../docs/CI-CD指南.md)
- [开发规范](../DEVELOPMENT_GUIDELINES.md)

---

**文档版本**: v1.0.0  
**最后更新**: 2026-07-31