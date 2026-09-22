# 管理平台设计 — 长期记忆

## 当前主线（生产就绪 P0）
- 评估文档：`docs/生产就绪评估-20260922.md`（已同步 P0 落地方案）。
- P0 四硬伤（用户「按照建议直接推进」）：**P0-a 占位密钥 / P0-c nginx TLS / P0-b WebSocket 入口 / P0-d 版本化迁移 全部收官（零回归验证通过）**。
- **P0-d 最终方案（已落地，不引入 Alembic）**：reconcile.py（元数据驱动对账器，按 `db.metadata` 自动补缺失表/列/索引，幂等、零新依赖）为鲁棒主体 + seed_defaults.py（幂等种子：12 默认节次 + 5 预警配置），统一接入 `app/db_init.py::init_database` 内 `ensure_database_ready`，受 `TESTING` 守卫（测试库沿 `create_all` 不污染）。runner.py 保留为**已弃用历史参考**（不接入启动）。
- ⚠️ **关键发现**：legacy 迁移脚本长期损坏（6 个 `from app import app, db` 导入失败；`score_change_float.py` 对全新库盲目 `ALTER COLUMN` 失败）→ 真实 schema 由 `create_all` 维护。更关键：**模型/迁移漂移**——`User.risk_score`/`User.last_risk_updated`/`ScoreRecord.operation_log_id` 仅由 legacy 脚本 `ALTER` 追加、**未进模型** → 全新库缺列、`warning_service` 写 `user.risk_score` 必崩。已**收口进模型**（`models/user_models.py`/`score_models.py`）由 `create_all`/`reconcile` 统一维护。
- 测试闸门：后端全量 3 批串行（`--timeout=0`）= **2225 passed / 0 failed / 0 errored / 7 skipped**；前端四闸门 = tsc 0 / eslint 0(4 warnings) / prettier 0 / vitest 0。

## 运行 / 测试（口径固定）
- 后端 dev：`python run.py --env development --host 127.0.0.1 --port 5000`；改后端**强杀全部 python 再重启**（SocketIO 不 reload）。
- pytest/run_regression **必须** `apps/backend/.venv/Scripts/python.exe`（系统 Py3.11 缺 werkzeug）。全量串行基线 **2225 passed / 7 skipped / 0 failed**（P0-d 落地后实测）；勿用 xdist `-n 4`（2 个 nlp_performance 假失败）；串行 3 批分跑（`--timeout=0`）。
- 前端四闸门 managed Node 22.22.2 直调二进制（typescript/bin/tsc · eslint/bin/eslint.js · prettier/bin-prettier.js · vitest/vitest.mjs run）。基线 38 文件 / **276 passed / 3 skipped**。
- 单测三要素：退出码=0 / 无 failed / 报告文件数==磁盘文件数；**禁 commit 除非用户显式要求**。
- ruff 唯一口径 `ruff check apps/backend`（+`--select C901`）。run_regression 5 闸门用 PowerShell 直跑；回归日志剔 `\0` 再 UTF8。

## 已收官（勿再排期）
C901 收口(58→47) · safe_handle 收敛 18 处 · F17 路由服务化 · B3 to_dict · E1–E6 · NLP 四塔 · hooks barrel · 班主任工作台(12 子页+聚合 `/workbench`) · M9 分页 · T12 巨型页拆分(≥600 行=0) · 06 差异 17 项全量 · 06 收口轮三项(归档旧 MQTT 文档/补 #4 阶段3 UI/补阶段1 白名单开关)。历史细节见 `memory/2026-09-12.md` 等日志。

## 后端铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]`；**未跑回归=重构未完成**。
- RBAC：改后跑 `verify_rbac_consistency.py --check-only`（G2 68/DB 70/seed 66/teacher 30）；班级隔离 `_CLASS_SCOPE_PREFIXES` 12 词根；`db_session_scope` 写路径 `detach=False`。
- 枚举常量化**只收拢字面量**绝不做跨语义合并（`not_in_time` ≠ `not_in_time_window`）；收紧判据留兜底（`is_device_online or status=="online"`）。

## 前端规范
tsconfig 严格档；禁 `any`；Context value useMemo；src 全 LF；prettier 100/singleQuote/semi/jsxSingleQuote/lf；导入走 barrel；hook 复用优先；含 JSX 的 hook 必 `.tsx`。

## ESP32 / OTA 真实状态
- `device_type` 维度已闭合（`FirmwareVersion.device_type` + `get_latest_active_firmware(device_type)`）。
- F1 五阶段 A–C 已实装（`negotiate_all_devices` 逐设备协商 + `/ota/check` 按类型过滤 + `test_ota_type_isolation.py`）；仅剩 C2 doorlock .ino 硬件侧合理推迟。
- 硬件对接文档唯一入口 `docs/esp32/`（7 文件）；后端源码是唯一事实来源。

## 关键坑（沙箱环境必读）
- ⚠️ **EOL 守恒**：backend 多数 `.py` 为 CRLF，改写前**逐文件检测实际行尾**再按自身风格守恒（存在纯 LF 例外，禁断言 `crlf>0`）。
- ⚠️ **git-bash coreutils 损坏**（rm/ls/grep/find/tail/cd 均 command not found）。文件增删/行数统计/目录列举一律用 Python 脚本（`os`/`pathlib`）；pytest 用 `os.chdir` 包装。
- ⚠️ **`PYTEST_ADDOPTS=--timeout=300`**：长回归被 300s 杀 → 传 `--timeout=0`（勿 `-p no:timeout`）；全量多独立 pytest 进程分批 + `--junitxml` 聚合。
- ⚠️ **绝不直接改 `.git` 内部文件**：修 ref 走 git 命令；远程同步只信 `git ls-remote origin <branch>`，不信用 `git status -sb` ahead/behind（沙箱 tracking 假陈旧）。
- SQLite join User 双 join → ambiguous；conftest 动态 Namespace 须自带 `path`；同名类型多处定义（改前 grep 全仓定位真实源）。
