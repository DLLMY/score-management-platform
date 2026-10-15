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
  - **R24 提交 `1cd686f`**（10 文件 +529/−93）已 push 并经 `git ls-remote` 核验一致；提交前另修净 3 处 R24 import 新增 lint（alert/nlp_rule/security 重复导入+分组、test UP009，零行为变更，29 用例复跑通过）。**教训**：mock 单测桩 `Model.query` 双查序列时，任何查询合并都会误判——仅被 mock 覆盖且收益 ≤1 查的合并应最低优先级甚至不做。


## R25 读路径优化（簇 D 计数合并 + 簇 N+1 关系复用，用户确认全部 5 处）
- **簇 D（同表多 COUNT → 单条条件聚合，R24 模板）**：`notify_history_routes` 6 COUNT→1；`admin_notifications_routes` unread+total 2→1（if/else 各一组）。cached_api 路由用唯一 `?v=` 穿透缓存后计数。
- **簇 N+1（循环 get_by_id → 复用 selectin 关系）**：`exam_import_query_service` / `course_schedule_service` / `subject_service` 三处列表端点。**关键洞察**：这些模型的关系本就是 `lazy="selectin"`（R7 时代），加载父对象时 SQLAlchemy 已自动批量预取；原始 `get_by_id` 是与 selectin **冗余**的 N+1。最优解=**直接用关系**（`score.student/exam/admin/subject_rel`、`schedule.class_info/subject`、`link.class_info/teacher`），零额外查询。曾误用"批量 IN 查询"反而与 selectin 重复（debug 见每组查询 2× 计数）——**教训：消除列表 N+1 前，先查目标模型关系是否已 selectin，避免重复造轮子**。
- 省查询：exam 每行 3 个 get_by_id、schedule/subject 每行 2 个 get_by_id 全消除（收益随页/列表大小缩放；exam 默认页 20 行省 ~60 查）。
- 测试 `tests/test_r25_aggregation.py`（10 用例全绿）：SQL 计数 harness（notify/admin 目标表 SELECT==1；exam/schedule/subject ==4/2/2=selectin 批量数，证明 get_by_id 已消除）+ 契约 key + 数值正确性。
- ruff 6 文件全净（含修净 course_schedule 既存 I001、exam import 收缩为 `Score` only）。EOL 守恒：notify/admin_notif=CRLF，exam/course_schedule/subject/test=LF。
- 全量回归 **2350/0/0/7 零回归**（22 分块 hung=0，独立聚合复核一致；2340+10）。**R25 提交 `3d7aa8e`** 已 push 并经 `git ls-remote` 核验一致；R25 报告 `docs/reports/深度评估与优化报告-20261014-25.md`。


## R26 读路径优化（device_query 假经济 → DB 条件聚合，用户确认 2 处）
- **新类「假经济优化」**：早前把多次 COUNT 改成 `Device.query.all()` 取全表 + Python len/sum 计数，转移整表行却只为数几个值；DB 条件聚合（1 查询只回传计数）严格更优。R24/R25 Class D 模式可收割此类。
- device_query_service.get_device_stats_view：total/error/online → 1 条条件聚合；get_device_advanced_stats_view：+avg_signal(func.avg)+signal_distribution(case 互斥分档)+Alert 2 计数 → 条件聚合。
- **dashboard online 排除**：Device.is_online=@property→is_device_online（per-device heartbeat_timeout + OTA 保护窗 + status），语义复杂，不冒险下推。
- 测试 test_r26_aggregation.py（4 用例）：新旧均 1 条目标表 SELECT，语句计数无法区分，改用「SQL 形状（含 count/avg）+ 数值」证明。全量回归 **2354/0/0/7 零回归**（22 分块 hung=0；2350+4）。**R26 提交 `c7ad36c`** 已 push 并经 `git ls-remote` 核验一致；R26 报告 `docs/reports/深度评估与优化报告-20261015-26.md`。

## R27 评估结论（读路径优化已做透，2026-10-15）
- R23–R26 四轮把低风险/零契约/可批处理的读路径优化收干净：条件聚合（簇 D）、循环 get_by_id→selectin 关系（簇 N+1）、请求级 flask.g 缓存、取全表再计数假经济纠正。基线 2325→2354 全程零回归。
- **剩余候选**：① Class F 二级 N+1——score_predict/risk_predict/rule_recommendation/attribution/engagement/prediction 的"取全部用户→循环 per-user 预测"，批处理需重构预测算法（高复杂）；② 写路径 N+1——device_service 批量加组（**R28 已试点**）、heartbeat_service 超时处理、nlp_rule_service 匹配更新。用户已确认暂存读路径优化，未来会话不必重复扫描此片地面。

## R28 写路径 N+1 试点（device_service 批量加组，2026-10-15）
- **改写**：`services/device_service.py::add_devices_to_group` 循环内逐台 2 查（2N+1）→ 两次批量 `.in_()` 预取（existing_set/found_set）+ `planned_add` 集合复刻 autoflush 语义，查询数恒为 4（与 N 无关）。纯 LF，EOL 守恒（441→492 行）。
- **配套测试**：`tests/test_r28_device_group_nplus1.py`（4 用例，纯 LF）：HTTP 路径目标表 SELECT 恒为 3（harness 表 `{device,device_group_mappings}`，注意 `Device.__tablename__=="device"` 单数）+ 3 语义用例（断言真实映射行数，因 `DeviceGroup` 无 `device_count` 列、原末尾赋值是死代码）。
- **回归**：2358/0/0/7 零回归（task oF6bRE，22 分块 hung=0）。**已通过但未 commit**（铁律，待 AskUserQuestion 确认）。
- **关键洞察**：写路径 N+1 与读路径不同——需精确复刻 autoflush/事务可见性语义；`planned_add` 集合是零行为差异的关键。写路径批处理风险高，按"试点→评估→批量"节奏推进，不硬凑。
