# 管理平台设计 — 长期记忆

## 主线状态
- P0 收官（占位密钥/TLS/WS 入口/版本化迁移）；P0-d：`reconcile.py`（元数据驱动对账，幂等零依赖）+ `seed_defaults.py`（12 节次+5 预警）接入 `db_init.ensure_database_ready`（TESTING 守卫）。
- 模型/迁移漂移收口进模型（User.risk_score/last_risk_updated、ScoreRecord.operation_log_id），create_all/reconcile 统一维护。
- **性能与零回归战役 R7–R31+F1–F5 全收官**：读路径（R23–R26）、写路径（R28–R30）、Class F 二级 N+1（R31+F1–F5）。基线 2325→**2397/0/0/7**（P1 指标埋点补测后 passed 2389→2397，skipped=7 不变）全程零回归。
- **P1 可观测性看板收官**：`/metrics` 独立 registry 暴露 HTTP/进程级 + 7 业务指标（ota_updates/ota_negotiations/mqtt_connection_state/mqtt_messages/score_devices_online|total/redis_cache_ops），埋点走模块级延迟包装函数（循环依赖安全）+ helper try/except。看板 `grafana/dashboard.json`（18 面板，uid=score-backend-monitor）。**监控权威目录 `ops/infra/`**：alerting_rules.yml（6 HTTP/进程 + 3 业务告警 MQTTLinkDown/OTAFailureRateHigh/DevicesMostlyOffline）、一键栈 `docker-compose.monitoring.yml`（prom+alertmanager+grafana:3001，共享主 compose 默认网络）+ grafana provisioning 自动加载；旧重复目录 `prometheus/` 已删。校验门 `ops/infra/validate_monitoring.py`（替代沙箱缺失的 promtool，11 断言）。
- **Celery 任务 worker 环境修复（2026-10-21，未 commit）**：celery_app 无 ContextTask 基座 → `tasks/scheduled_tasks.py` 4/6 个 beat 任务在生产 worker 下崩溃/静默失败（缺 app_context + 调不存在的 `cache.set_stats` + `warmup_cache()` 漏传 app）。修复模式：模块级 `_resolve_flask_app()`（有环境上下文沿用 current_app，否则取 app 单例）+ 任务自包上下文；`set_stats`→`cache.set`（key 不变）；health_check MQTT 导入修正为 `services.mqtt_manager.mqtt_manager`。回归守卫 `tests/test_scheduled_tasks_worker_ctx.py`（无外层 app_context 直调任务模拟 worker）。**教训：测试用 `with app.app_context()` 包裹任务调用会掩盖生产缺陷**。

## 运行/测试口径（铁律）
- 后端 dev：`python run.py --env development --host 127.0.0.1 --port 5000`；改后端强杀 5000 端口持有者再重启（勿杀 celery beat）。
- 回归必须 `apps/backend/.venv/Scripts/python.exe`；沙箱单进程全量 pytest 超时 → `run_regression_batched.py`（FLASK_LIGHTWEIGHT=true，22 分块 ≤150 用例/≤10 文件，剔除 test_app_init+test_api_contract 两例）。重跑前确认无残留后台 pytest（XML 竞态）；**aggregate() 须下钻 testsuites→testsuite（pytest 9.x 直读根 tests=0 假零）**。
- **环境已对齐（2026-10-18）**：.venv 与 `requirements.lock.txt` 一致（57 包 / flask 3.1.3 / numpy 2.4.6 / pandas 3.0.6 / redis 8.1.0 等 7 破坏性 major），本地回归与 CI 同基。Dockerfile 仍用 requirements.txt（>= 宽松装最新）。**skipped 基线=7**（4 SQLite 并发环境 + auth/dashboard/nlp/ota 单例）；Redis 客户端全部 `protocol=2`（RESP2 回落兼容旧 Redis 服务，勿删）。
- 单测三要素：exit=0/无 failed/报告文件数==磁盘文件数；**禁 commit 除非用户显式要求**。
- ruff 唯一口径 `ruff check apps/backend`（+`--select C901`）；`run_validation.py` 语法门必过。

## 后端/前端铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]`；未跑回归=重构未完成。
- RBAC：`verify_rbac_consistency.py --check-only`（G2 68/DB 70/seed 66/teacher 30）；班级隔离 `_CLASS_SCOPE_PREFIXES` 12 词根；写路径 `db_session_scope(detach=False)`；枚举常量化只收拢字面量不跨语义合并、收紧判据留兜底。
- 前端：tsconfig 严格档；禁 `any`；src 全 LF；prettier 100/singleQuote/semi/jsxSingleQuote/lf；导入走 barrel；含 JSX 的 hook 必 `.tsx`；四闸门用 managed Node 22.22.2。

## ESP32 / OTA
- device_type 维度闭合（FirmwareVersion.device_type + get_latest_active_firmware(device_type)）；phonebox 无缝 OTA 全链路闭环（HMAC/断点续传/MD5/Boot 回滚）；doorlock C2 硬件推迟（固件缺 Update.h）。硬件文档唯一入口 `docs/esp32/`。
- **R9 遗留**：切回 EMQX Cloud 缺凭据，后端仍连 hivemq；待用户发主机+用户名+密码后「管理端改配置重启+设备端同步切」。

## 关键坑（沙箱必读）
- **Write 工具在 Windows 落盘即 CRLF**：行尾转换必须「文本模式读（universal newlines）+ `newline=` 参数写回」；**禁正则折叠连续换行**（`re.sub(rb'(?:\r\n|\r|\n)+', b'\n')` 会把空行一并吞掉，已两次损坏文件）；写后二进制核验 `crlf/lone_cr/空行对数` 三指标。
- **`.venv/Scripts/python.exe` 是转发 shim**：真实执行在系统 Python311 子进程（进程树呈 venv python 近零 CPU 空等、系统 python 承重）；与用户记忆「pytest 用系统 Python 3.11」一致。排查进程时勿把 shim+真实进程误判为双跑/XML 竞态——曾据 PPID 误报，CPU 时间可证单线。
- **测试会话内 `from app import app` 解析到真实 app 单例**（instance/score_management.db，TESTING=False），不是 conftest fixture 的内存库——`_build_test_app()` 是裸 Flask 不走 create_app，不会更新 `sys.modules['app'].app`。任务/服务内裸用单例会在测试中连真实库（已实证）：要么优先沿用 current_app（有环境上下文时），要么测试用 sys.modules 桩/属性重定向把单例换成测试 app。
- **EOL 守恒**：backend 多数 .py 为 CRLF，改写前逐文件检测实际行尾（有纯 LF 例外，禁断言 crlf>0）。
- git-bash coreutils 损坏（rm/ls/grep/find/tail/cd 均 not found）→ 文件增删/列举一律用 Python 脚本。长回归传 `--timeout=0`（PYTEST_ADDOPTS 默认 300）；多 pytest 进程分批 + `--junitxml` 聚合。
- 绝不直接改 `.git` 内部文件；远程同步只信 `git ls-remote origin <branch>`。
- **packed-refs CRLF→badRefName 损坏**：Python `open(pr,'wb')` 写回纯 LF 干净 packed-refs（先备份 .bak），fsck+push+ls-remote 核验。
- **装饰器工厂不可用 partial 占位**：`safe_handle(default_status=500,...)` 首参非 func；复用须 `def f(func): return safe_handle(...)(func)`，否则路由被 conftest walk_packages 吞掉→命名空间 0 注册→路由测试 404 假象。
- **vitest --coverage 清理 coverage/.tmp 触发 safe-delete 守卫崩溃**：读 `coverage/coverage-summary.json` 取四指标，或不带 --coverage 跑 `vitest run`。
- **Read 显示与磁盘真相可能有偏差**（CRLF 文件）——锚点替换前必须二进制核验。
- 模型关系 `lazy="selectin"`：IN 预取行时 ORM 自动附带 user IN 查询（非缺陷）；断言证「与 N 无关」而非硬等于小值。
- mock 单测桩 `Model.query` 双查序列时查询合并会误判——仅被 mock 覆盖且收益 ≤1 查宁可不做。
- 索引双处定义：模型层 `__table_args__`/`index=True`（create_all+reconcile 覆盖新库）+ `scripts/create_indexes.py::get_all_indexes()`（启动自举覆盖现有库）；增索引须同步两处并 EOL 守恒。
- **@celery_app.task 装饰后任务名绑定 Task 实例，直调即走 Task.__call__**（2026-10-22 实证）：给 celery_app 设 ContextTask 基座时，__call__ 必须先查 has_app_context() 快路径（有上下文直接 self.run），否则「测试 app 上下文内直调任务实例」的既有用例会经基座导入 app 单例误连真实库（archive 用例单跑连 instance/score_management.db 读不到测试播种数据即此因）；语义与 tasks.scheduled_tasks._resolve_flask_app 一致。另：EagerResult.successful 是方法非属性（须 successful() 调用）；测试注册探针任务后须 celery_app.tasks.pop(name) 防污染全局 registry。

## 优化战役模式速查（详细过程见各日日志）
- **R23–R26 读路径**：条件聚合（func.count+func.sum(case) 合并多 COUNT/时间窗）；循环 get_by_id→selectin 关系（先查关系是否已 selectin）；请求级 flask.g 缓存；假经济（取全表再计数）纠正为 DB 聚合。
- **R28–R30 写路径**：循环前 `.in_()`/`group_by` 预取 + 内存集合判定，精确复刻 autoflush/事务语义（planned_add 集合是零行为差异关键）。
- **R31+F1–F5 Class F**：瞬态类属性缓存（`_bulk_*`）——批量入口循环前 IN 预取（按主键分组）+ 单生函数顶部命中即返 + try/finally 清理；入口间 save-restore（`_prev_bulk`）防嵌套覆盖；不改公开签名保 mock 零破坏；SQL 计数 harness 证与 N 无关 + 数值等价；F4 窗口基准时间须取自缓存 ref（否则 datetime.now() 微秒差致键不命中）。
- 提交（均 push+ls-remote 核验）：R23=`edd84bf` R24=`1cd686f` R25=`3d7aa8e` R26=`c7ad36c` R28=`c0ee179` R29+R30=`a1fd352` R31=`af12c4a` F1–F5=`1107699`。

## 服务层 god-class 拆分战役（复用 NLP mixin 模式）
- **模式**：god-class → `services/<domain>/` 子包（域 mixin + 主文件薄组合层）；`__module__` 不变；消费方 `from services.X import ...` 零变更；AST 守恒断言（方法集+装饰器计数一致）。
- **`_shared.py` 叶模块破环**：枚举/前向函数/被 patch 符号集中于此（单源）；mixin 经 `_shared.X` 属性级访问穿透 patch（勿用 `from _shared import X` 快照，patch 无法覆盖）。
- **已收官批次**：① MQTTManager `c88129f`；② NLPMLTrainingService+NLPRuleManagementService+MQTTMessageService `db2ecf5`；③ AcademicsService（2026-10-25，主文件 1003→38 行，8 mixin，零回归 2408/0/0/7）。
- **一次性脚本**（仓库根，禁提交）：`split_mqtt_manager.py` / `split_nlp_ml_service.py` / `split_nlp_rule_service.py` / `split_mqtt_message_service.py` / `split_academics_service.py`；`.pre-split.bak` 已 gitignore。
- **剩余候选**（需先 classmethod 化/模块函数化，硬编码类名 self 引用阻断 mixin 拆分）：RiskPredictService(1156) / RuleRecommendationService / ExportService / CompositeScoreService / AnalysisService。

## 前端页面架构约定（2026-10-19 评估确认）
- **「装配层单文件 + 域目录」是刻意架构，非烂尾**：45/45 双形态页面全部为 `pages/Xxx.tsx`（装配层/路由入口，import 域 View+Logic）+ `pages/xxx/`（域实现：View/Logic/Hooks/components/types）。命名约定统一：目录 camelCase + 文件 PascalCase。
- **0 孤儿目录、0 歧义实现**：生产代码 pages import 全部带显式文件名（0 个目录路径）；测试代码经整合后同样 0 残留。
- **Win FS 大小写不敏感陷阱**：`from '../../pages/StudentPortal'`（Pascal）在 Win 上同时匹配 `StudentPortal.tsx`（文件优先）与 `studentPortal/`（目录）——测试曾大量使用此歧义写法，整合时已全部改为显式 `'../<Pascal>'`；新代码禁止目录路径 import pages。
- 厚装配层（如 AttendanceManage 512 行）是既定形态，非债项；如需拆分按 R 系列优化战役另行评估。
