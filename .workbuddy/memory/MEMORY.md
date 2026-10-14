# 管理平台设计 — 长期记忆

## 主线状态
- 生产就绪 P0（占位密钥 / TLS / WS 入口 / 版本化迁移）全收官，零回归。
- P0-d：reconcile.py（元数据驱动对账，按 db.metadata 自动补表/列/索引，幂等零依赖）+ seed_defaults.py（12 默认节次 + 5 预警，幂等）接入 `app/db_init.py::init_database` 的 `ensure_database_ready`，受 TESTING 守卫；runner.py 弃用。
- 模型/迁移漂移已收口进模型（User.risk_score / User.last_risk_updated / ScoreRecord.operation_log_id），由 create_all / reconcile 统一维护。
- 项目已无大型工程债；**零回归性能修复战役 R7–R23 全收官**（关系懒加载维度 + api 层 helper-delegated N+1 全扫闭环 + R23 请求级 flask.g 缓存（C1/C2）+ 操作日志条件聚合收口（C3/C4）），全量回归基线升至 **2325 passed / 0 failed / 0 errors / 7 skipped** 零回归（R23 新增 4 防护用例）。R23 提交 `edd84bf` 已 push 并经 `git ls-remote` 核验一致（R22=`8f69520`）。

## 运行 / 测试口径（铁律）
- 后端 dev：`python run.py --env development --host 127.0.0.1 --port 5000`；改后端**强杀 5000 端口持有者**再重启（SocketIO 不 reload，勿杀 celery beat）。
- 回归必须 `apps/backend/.venv/Scripts/python.exe`（系统 Py3.11 缺 werkzeug）。
- 沙箱单进程全量 pytest 超时退出（function 级 app fixture 累积 2000+ app 实例）→ 用 `run_regression_batched.py`（`FLASK_LIGHTWEIGHT=true` + 分进程 ≤150 用例 / ≤10 文件 / 整批 timeout 600，剔除 `test_app_init` 整文件 + `test_api_contract` 两用例）。**重跑前先确认无残留旧后台 pytest 进程（共享 XML 竞态）**，`chunk 019` 重 fixture 批次需延长超时。**`aggregate()` 须下钻 `<testsuites>→<testsuite>` 取 tests（pytest 9.x 根节点为 testsuites，直读根 tests 属性=0 假零）**。
- 单测三要素：exit=0 / 无 failed / 报告文件数==磁盘文件数；**禁 commit 除非用户显式要求**。
- ruff 唯一口径 `ruff check apps/backend`（+`--select C901`）；`run_validation.py` 语法门必过再提交。

## 后端铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]`；未跑回归=重构未完成。
- RBAC：`verify_rbac_consistency.py --check-only`（G2 68/DB 70/seed 66/teacher 30）；班级隔离 `_CLASS_SCOPE_PREFIXES` 12 词根；`db_session_scope` 写路径 `detach=False`。
- 枚举常量化只收拢字面量绝不做跨语义合并；收紧判据留兜底（`is_device_online or status=="online"`）。

## 前端规范
tsconfig 严格档；禁 `any`；Context value useMemo；src 全 LF；prettier 100/singleQuote/semi/jsxSingleQuote/lf；导入走 barrel；含 JSX 的 hook 必 `.tsx`。四闸门用 managed Node 22.22.2 直调二进制（tsc/eslint/prettier/vitest）。

## ESP32 / OTA
- `device_type` 维度闭合（`FirmwareVersion.device_type` + `get_latest_active_firmware(device_type)`）；phonebox 无缝 OTA 全链路闭环（register/heartbeat→try_auto_negotiate→publish_ota_command→phonebox/ota/{id} 订阅→performOTAUpdate，含 HMAC 验签/断点续传/MD5/Boot 回滚）。doorlock 记 C2 硬件推迟（固件缺 Update.h，后端维度已就绪）。
- 硬件对接文档唯一入口 `docs/esp32/`（7 文件）；后端源码是唯一事实来源。

## 关键坑（沙箱必读）
- **EOL 守恒**：backend 多数 `.py` 为 CRLF，改写前逐文件检测实际行尾再守恒（存在纯 LF 例外，禁断言 crlf>0）。
- **git-bash coreutils 损坏**（rm/ls/grep/find/tail/cd 均 command not found）→ 文件增删/行数/列举一律用 Python 脚本；pytest 用 `os.chdir` 包装。
- `PYTEST_ADDOPTS=--timeout=300`：长回归传 `--timeout=0`；多独立 pytest 进程分批 + `--junitxml` 聚合。
- 绝不直接改 `.git` 内部文件；远程同步只信 `git ls-remote origin <branch>`，不信用 `git status -sb` ahead/behind。
- **packed-refs CRLF→badRefName 损坏**：`.git/packed-refs` 被写成 CRLF → `git fsck` 报 `badRefName` + 全零 SHA 墓碑行、commit 时 `geometric repack failed`。`git update-ref -d` 因 `?` 触发 Windows 文件名非法无法用 → 必须用 Python `open(pr,'wb')` 写回**纯 LF** 干净 packed-refs（先备份 `.bak`），再 `git fsck` 核验 + push + `ls-remote` 核验。
- **装饰器工厂不可用 `partial` 占位**：`safe_handle(default_status=500,...)` 首参是 `default_status` 非 `func`；复用须 `def f(func): return safe_handle(...)(func)`，否则路由函数被填入 default_status 槽 → TypeError → 被 conftest `walk_packages(api)` 吞掉 → 命名空间 0 注册 → 全部路由测试 404 假象。
- **前端 `vitest --coverage` 清理 `coverage/.tmp` 触发 safe-delete 守卫崩溃**（退出码非0但覆盖率已算完、测试全绿）：读 `coverage/coverage-summary.json` 取四指标即可；或不带 `--coverage` 跑 `vitest run` 干净 EXIT=0。

## 索引双处定义架构（R7–R10 已大量增改，必读）
- ① 模型层 `__table_args__` / `index=True` / `db.Index`：经 `db.create_all()` + `migrations/reconcile.py` 覆盖**新建/测试库**。
- ② `scripts/create_indexes.py::get_all_indexes()` 清单：经启动自举（`app/db_init.py`）与 verify 闸门覆盖**现有库**。
- 两处漂移（同一索引仅一处有）会导致测试库或现有库缺索引——每次增索引须同步两处并 EOL 守恒。

## 性能优化已落地（OPT-1/2 + R7–R10）
- OPT-1：`app/db_init.py` 性能 PRAGMA（WAL / cache_size=-100000 / temp_store=memory / mmap_size=256MB / synchronous=1 / busy_timeout=5000 / locking_mode=NORMAL），读密集 1.88x。**foreign_keys 维持 OFF**（正确性开关，历史迁移依赖 OFF，需专项迁移+回归才开）。
- OPT-2：`diagnostics.check_cpu_usage` 改 `interval=None` 非阻塞（109ms→0.56ms）。
- R7 列级 FULL-SCAN / R8 filter+order+limit 复合（score_models 4 复合）/ R9 MQTT 连接泄漏（mqtt_manager.py client_id 进程内稳定 + 旧客户端 `_dispose_client` 回收）/ R10 order_by 单列排序完备性（12 模型 + 18 清单索引，TEMP B-TREE 28→8）：全量 2325/0/0/7 零回归（R23 收官，+4 防护用例）。

## R9 遗留（待用户凭据）
- 切回 EMQX Cloud 已确认方向，但缺 EMQX 主机+用户名+密码；后端 broker 仍连 hivemq（`mqtt_config` 唯一行指向 broker.hivemq.com，设备端亦连 hivemq）。待用户发凭据后执行「管理端改配置重启 + 设备端同步切」（见 2026-10-08.md §13）。

## R23/R24 条件聚合收口战役（读路径零契约优化）
- **模式**：`func.count()` + `func.sum(case((cond,val),else_=0))` 将多 COUNT / 嵌套时间窗聚合合并为单条 DB 查询；R24 复用 R23 的 SQL 计数 harness（`tests/test_operation_log_routes.py` / `test_permission_utils.py`::_count_table_selects）证明合并真实发生，再加契约 key 断言 + 数值正确性。
- **R23 已收官**：commit `edd84bf`（9 文件 +357/−34，msg "R23: 请求级 flask.g 缓存 + 操作日志条件聚合收口（零回归 2325/0/0/7）"），远程 `git ls-remote` 核验一致。
- **R24（用户确认全部 7 处；composite 一处已回退，实际落地 6 处）**：纯只读 COUNT/聚合合并 →
  - analysis_service.get_dashboard_summary：月/周/日嵌套窗(3→1) + 双 User 计数(3→2) = 省 3 查。
  - nlp_rule_service.get_rule_statistics：规则(3→1) + 用量(2→1) + 匹配(2→1) = 省 4 查。
  - alert_service.get_alert_stats：总/未读/今日(3→1) + severity group_by 保留 = 省 2 查。
  - security_service.get_audit_stats：total/last_24h/last_7d(3→1) = 省 2 查。
  - dashboard_service.get_dashboard_data：今日/近7日/近7日正向(3→1) + category_stats 保留 = 省 2 查。
  - score_record_service.get_score_statistics：总数+加减汇总(2→1，消除 IN 子查询) = 省 1 查（today_count 因口径忽略 start/end_dt 保留独立查询）。
  - **R24-7 composite_score_service.get_student_composite_score 已回退**：合并取分+排名为相关子查询后破坏既有 mock 单测 `test_composite_score_service::test_get_student_composite_score`（该测试桩的是原始 `query.filter_by().first()`+`query.filter().count()` 双查序列，合并后 mock 不命中→返回 None）。逻辑对真实库正确，但与 mock 强耦合且仅省 1 查，按「破坏既存测试宁可回退」铁律 `git checkout HEAD` 字节级还原。
  - 合计省约 13 查；配套 `tests/test_r24_aggregation.py`（删除 composite 类后 **15 用例**全绿）+ ruff C901 0 新增 + 全量回归 **2340/0/0/7 零回归**（22 分块 hung=0，独立聚合复核一致）。**EOL 守恒**：analysis/alert/dashboard=CRLF，nlp_rule/security/score_record=LF；composite_score_service.py 已还原 HEAD。**双处索引**：本次仅改查询形态，未新增索引，无需同步。
