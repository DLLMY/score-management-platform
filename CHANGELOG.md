# Changelog

所有重要的项目变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
项目版本遵循 [语义化版本 (Semantic Versioning)](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### 新增
- CI/CD 自动化流程配置
- GitHub Actions 工作流
- 部署脚本和文档

### 变更
- 切换到亮色主题
- 优化前端组件性能
- 重构后端路由结构

---

## [1.0.0] - 2026-05-29

### 新增
- ✅ 完整的班级积分管理系统
- ✅ 用户管理 (学生/教师/管理员)
- ✅ 积分规则配置
- ✅ 数据可视化仪表盘
- ✅ MQTT 设备集成
- ✅ 权限管理系统
- ✅ 通知系统
- ✅ 审批流程
- ✅ 操作日志
- ✅ 自动数据库备份
- ✅ 移动端适配
- ✅ 亮色主题

### 技术栈
- **后端**: Flask, SQLAlchemy, Redis, MQTT
- **前端**: React, Tailwind CSS, Recharts
- **数据库**: SQLite (开发), MySQL (生产)

---

## 版本说明

### 语义化版本号
```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └─ Bug 修复
  │     └─────── 新增功能
  └───────────── 不兼容的变更
```

### 发布类型
- `MAJOR`: 大版本，包含破坏性变更
- `MINOR`: 小版本，新增功能，向后兼容
- `PATCH`: 补丁版本，只修复 Bug
