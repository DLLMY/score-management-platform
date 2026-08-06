# 启动配置文件及脚本清理计划

## ✅ 执行状态：已完成（2026-07-31）

## Context（背景）

项目在多次迭代开发和调试过程中，积累了大量临时调试脚本、重复的启动脚本和过时的配置文件。当前 `backend/scripts/` 目录有59个文件，其中40+为调试过程中创建的一次性脚本（check_*、test_*、scan_*、smoke_*等）；`deploy/` 目录存在引用不存在文件的破损脚本；`wsgi.py` 缺少 import 语句导致无法使用；存在重复的 `.env.example` 文件。这些冗余文件影响项目整洁度和可维护性，需要系统清理，同时确保保留的启动文件能正确支持开发、测试、生产三种环境。

## 当前有效启动流程（保留）

| 环境 | 后端启动命令 | 前端启动命令 |
|------|-------------|-------------|
| 开发 | `python run.py --env development` | `npm start` |
| 生产(Linux/Docker) | `gunicorn -c gunicorn_config.py wsgi:application` | `npm run build` + 静态托管 |
| 生产(Windows) | `waitress-serve wsgi:application` | `npm run build` + 静态托管 |
| Docker | `docker-compose up` | `docker-compose up` |

## 实施步骤

### 步骤1：创建备份
- 在项目根目录创建 `backup_scripts_20260731/` 目录
- 将所有待删除文件复制到备份目录，保持原始目录结构
- 生成备份清单文件 `backup_scripts_20260731/MANIFEST.md`

### 步骤2：删除 backend/scripts/ 中的临时调试脚本（40个文件）

**删除清单 - check_* 系列（11个）：**
check_actual_routes.py, check_all_routes.py, check_db_tables.py, check_duplicates.py, check_flask_routes.py, check_imports.py, check_init.py, check_init_detail.py, check_password.py, check_specific_routes.py, check_swagger.py

**删除清单 - test_* 系列（10个）：**
test_actual_paths.py, test_all_paths.py, test_backend.py, test_endpoints_direct.py, test_imports.py, test_notify_template_write.py, test_ports.py, test_routes_detail.py, test_slash.py, test_urls.py

**删除清单 - scan_* 系列（5个）：**
scan_backend_routes.py, scan_frontend_api.py, scan_frontend_api_v2.py, scan_routes_detail.py, scan_teacher_routes.py

**删除清单 - smoke* 系列（5个）：**
auto_smoke_test.py, comprehensive_smoke_test.py, final_smoke_test.py, full_smoke_test.py, smoke_test.py

**删除清单 - find/debug/quick 系列（4个）：**
find_missing_routes.py, find_routes.py, debug_init.py, compare_routes.py, quick_test.py, quick_service_check.py

**删除清单 - 旧版本测试脚本（4个）：**
joint_test.py（已被 joint_test_v2.py 取代）, full_health_check.py（已被 v2 取代）, comprehensive_test.py, integration_test.py

**保留的 scripts/ 文件（19个有用工具）：**
add_rules.py, backup_db.py, clear_login_locks.py, create_indexes.py, create_test_accounts.py, full_health_check_v2.py, init_admin.py, joint_test_v2.py, manage_admin.py, migrate_database.py, migrate_passwords.py, optimize_database.py, reset_admin_password.py, reset_passwords_bcrypt.py, run_bandit.py, run_performance_test.py, seed_test_data.py, update_db_schema.py, test_notify_template_write.py（如仍在用则保留）

### 步骤3：删除 deploy/ 中的过时/破损脚本（3个文件）

- `一键部署.bat` — 引用不存在的 deploy.ps1，已破损
- `start_laptop.bat` — 与 start_server.bat 几乎完全重复
- `start_ngrok.py` — ngrok 隧道工具，非标准启动流程
- `reset_admin_password.py` — 与 scripts/reset_admin_password.py 重复

**保留的 deploy/ 文件：**
start_server.bat, stop_all.bat, server_deploy.ps1, service_manager.py, 一键部署.py, 所有 .md 文档

### 步骤4：删除重复的配置文件（1个文件）

- `backend/config/.env.example` — 与 `backend/.env.example` 重复

### 步骤5：修复 wsgi.py（缺少 import 语句）

当前 wsgi.py 在 try 块中引用 `application` 但从未导入。修复方案：在 try 块内添加 `from app import create_app; application = create_app()`

### 步骤6：验证项目正常运行

1. 重启后端服务：`python run.py --env development`
2. 验证后端健康：登录测试 + API 响应检查
3. 前端服务已在运行，验证代理联通
4. 执行 `python scripts/joint_test_v2.py` 确认所有功能正常
5. 验证 wsgi.py 修复：`python -c "from wsgi import application; print(application)"`

### 步骤7：更新文档

更新 `README.md` 中的启动说明：
- 修正启动命令（统一为 `python run.py`）
- 移除对不存在的 start.bat、start_manual.bat 的引用
- 添加开发/测试/生产三种环境的启动说明
- 添加 scripts/ 目录保留脚本的说明

创建 `docs/STARTUP_GUIDE.md` 启动流程文档，包含：
- 环境要求（Python 3.10+, Node.js 16+）
- 开发环境启动步骤
- 测试环境配置
- 生产环境部署步骤（Gunicorn/Waitress/Docker）
- 常用维护脚本说明

## 风险评估

- **低风险**：删除的脚本均为独立调试工具，不被任何核心代码 import
- **中风险**：wsgi.py 修复需要验证不引入新的 import 循环
- **缓解措施**：完整备份 + 验证测试确保功能不受影响

## 验证标准

1. 后端服务正常启动并响应（登录 200）
2. 前端服务正常编译并代理后端
3. joint_test_v2.py 通过率 ≥ 97%
4. wsgi.py 可正常 import application
5. README 文档中的启动命令可正确执行
