# 发布流程指南

本文档定义了学生积分管理平台的版本发布流程、规范和操作步骤。

---

## 一、版本管理策略

### 1.1 语义化版本号

项目遵循 [语义化版本 (Semantic Versioning)](https://semver.org/lang/zh-CN/) 规范：

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └─ 兼容性 Bug 修复
  │     └─────── 兼容性功能新增
  └───────────── 不兼容的 API 变更
```

**示例**:
- `v1.0.0` - 首个正式版本
- `v1.1.0` - 新增功能（如：新增 NLP 解析功能）
- `v1.0.1` - Bug 修复（如：修复登录页面样式问题）
- `v2.0.0` - 重大变更（如：重构 API 结构）

### 1.2 版本标签规范

| 版本类型 | 标签格式 | 示例 | 说明 |
|----------|----------|------|------|
| 正式版本 | `vMAJOR.MINOR.PATCH` | `v1.0.0` | 生产环境发布 |
| 预发布版本 | `vMAJOR.MINOR.PATCH-alpha.N` | `v1.1.0-alpha.1` | 内部测试 |
| 候选版本 | `vMAJOR.MINOR.PATCH-rc.N` | `v1.1.0-rc.1` | 发布前验证 |

---

## 二、发布前检查清单

### 2.1 代码质量检查

```bash
# 后端检查
cd backend
flake8 . --max-line-length=120 --exclude=migrations,tests
pytest tests/ -v --cov=app --cov-fail-under=70

# 前端检查
cd frontend
npm run lint
npm test -- --watchAll=false --coverage
npm run build
```

**通过标准**:
- ✅ flake8: 0 错误
- ✅ pytest: 所有测试通过，覆盖率 ≥ 70%
- ✅ ESLint: 0 错误
- ✅ 前端测试: 所有测试通过
- ✅ 构建成功: 无编译错误

### 2.2 文档更新检查

| 文档 | 检查项 | 状态 |
|------|--------|------|
| `CHANGELOG.md` | 版本变更记录是否更新 | ☐ |
| `README.md` | 功能说明是否同步 | ☐ |
| `api-docs/` | API 文档是否更新 | ☐ |
| 数据库迁移 | 迁移脚本是否完整 | ☐ |

### 2.3 安全检查

```bash
# 依赖漏洞扫描
pip install safety
safety check -r backend/requirements.txt

# 代码安全扫描
pip install bandit
bandit -r backend/app -ll
```

**通过标准**:
- ✅ Safety: 无高危漏洞
- ✅ Bandit: 无高危问题

---

## 三、标准发布流程

### 3.1 创建发布分支

```bash
# 1. 确保在 main 分支
git checkout main
git pull origin main

# 2. 创建发布分支
git checkout -b release/v1.1.0

# 3. 更新版本号
# - 修改 package.json (前端)
# - 修改 backend/config.py (后端)
# - 更新 CHANGELOG.md
```

### 3.2 执行发布前检查

```bash
# 运行完整验证脚本
python run_validation.py

# 或手动执行各项检查
# （参见第二章发布前检查清单）
```

### 3.3 合并到主分支

```bash
# 1. 提交版本更新
git add .
git commit -m "chore: bump version to v1.1.0"

# 2. 切换到 main 分支并合并
git checkout main
git merge release/v1.1.0

# 3. 推送到远程
git push origin main
```

### 3.4 创建版本标签

```bash
# 创建带注释的标签
git tag -a v1.1.0 -m "Release v1.1.0

新增功能:
- NLP 自然语言解析
- AI 智能分析

修复:
- 登录页面样式问题

变更:
- 优化数据库查询性能"

# 推送标签到远程
git push origin v1.1.0
```

### 3.5 触发 CI/CD

推送标签后，GitHub Actions 将自动：
1. 运行后端测试
2. 运行前端测试和构建
3. 创建 GitHub Release
4. 生成 Release Notes

---

## 四、回滚流程

### 4.1 快速回滚到上一版本

```bash
# 查看标签列表
git tag -l

# 回退到上一版本
git checkout v1.0.0

# 部署上一版本
# （根据部署方式执行）
```

### 4.2 数据库回滚

如果发布包含数据库迁移：

```bash
# 查看迁移历史
flask db history

# 回滚到指定版本
flask db downgrade <revision_id>
```

### 4.3 紧急修复流程

```bash
# 1. 创建热修复分支
git checkout -b hotfix/v1.0.1 main

# 2. 修复问题并测试
# ...

# 3. 快速发布
git add .
git commit -m "fix: critical bug in login"
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin main --tags
```

---

## 五、发布类型与流程

### 5.1 常规发布（功能更新）

| 步骤 | 操作 | 耗时 |
|------|------|------|
| 1 | 创建 release 分支 | 5 分钟 |
| 2 | 执行完整测试 | 15 分钟 |
| 3 | 更新版本和文档 | 10 分钟 |
| 4 | 合并到 main 并打标签 | 5 分钟 |
| 5 | CI/CD 自动构建和发布 | 10 分钟 |
| **总计** | | **45 分钟** |

### 5.2 热修复发布（紧急 Bug）

| 步骤 | 操作 | 耗时 |
|------|------|------|
| 1 | 创建 hotfix 分支 | 2 分钟 |
| 2 | 修复并测试 | 15-60 分钟 |
| 3 | 合并并打标签 | 3 分钟 |
| 4 | CI/CD 自动构建 | 10 分钟 |
| **总计** | | **30-75 分钟** |

### 5.3 预发布（测试验证）

```bash
# 创建预发布标签
git tag -a v1.1.0-alpha.1 -m "Pre-release v1.1.0-alpha.1"
git push origin v1.1.0-alpha.1

# 预发布版本不会触发自动部署
# 需手动部署到测试环境验证
```

---

## 六、版本发布模板

### 6.1 CHANGELOG.md 模板

```markdown
## [1.1.0] - 2026-07-31

### 新增
- NLP 自然语言解析功能 (BERT + TextCNN)
- AI 智能分析仪表盘
- 实时数据大屏

### 修复
- 修复登录页面样式问题
- 修复用户列表分页错误

### 变更
- 优化数据库查询性能
- 重构 API 路由结构

### 移除
- 移除废弃的旧版通知接口

### 安全
- 强制 HTTPS 重定向
- 更新依赖版本修复漏洞
```

### 6.2 Git 标签消息模板

```
Release v1.1.0

新增功能:
- 功能 A
- 功能 B

修复:
- Bug A
- Bug B

变更:
- 变更 A

升级说明:
- 需要执行数据库迁移: flask db upgrade
- 需要更新环境变量: NEW_VAR=value
```

---

## 七、发布后验证

### 7.1 功能验证清单

| 功能模块 | 验证项 | 通过 |
|----------|--------|------|
| 用户管理 | 登录/登出 | ☐ |
| 用户管理 | 用户 CRUD | ☐ |
| 积分规则 | 规则 CRUD | ☐ |
| 数据统计 | 仪表盘加载 | ☐ |
| 设备管理 | MQTT 连接 | ☐ |
| 权限管理 | 权限检查 | ☐ |

### 7.2 性能验证

```bash
# API 响应时间
curl -w "@curl-format.txt" http://localhost:5000/api/users

# 数据库查询性能
sqlite> .timer on
sqlite> SELECT COUNT(*) FROM users;
```

**通过标准**:
- ✅ API 响应时间 < 500ms
- ✅ 数据库查询 < 100ms

---

## 八、常见问题

### Q1: 如何撤销已推送的标签？

```bash
# 删除本地标签
git tag -d v1.1.0

# 删除远程标签
git push origin :refs/tags/v1.1.0

# 重新创建标签
git tag -a v1.1.0 -m "Corrected release"
git push origin v1.1.0
```

### Q2: 发布后发现严重 Bug 怎么办？

1. 立即评估影响范围
2. 创建 hotfix 分支修复
3. 执行热修复发布流程
4. 发布后通知用户

### Q3: 如何回滚数据库迁移？

```bash
# 查看当前版本
flask db current

# 回滚一步
flask db downgrade

# 回滚到指定版本
flask db downgrade <revision>
```

---

## 九、附录

### A. 相关文档

- [CI/CD 配置指南](./CICD_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [开发规范](../DEVELOPMENT_GUIDELINES.md)

### B. 联系人

- 发布负责人: [项目负责人]
- 紧急联系: [联系方式]

---

**文档版本**: v1.0.0  
**最后更新**: 2026-07-31