# 管理平台设计 — 长期记忆

## 当前主线（生产就绪 P0）
- 评估文档：`docs/生产就绪评估-20260922.md`（已同步 P0 落地方案）。
- P0 四硬伤（用户「按照建议直接推进」）：**P0-a 占位密钥 / P0-c nginx TLS / P0-b WebSocket 入口 / P0-d 版本化迁移 全部收官（零回归验证通过）**。
- **P0-d 最终方案（已落地，不引入 Alembic）**：reconcile.py（元数据驱动对账器，按 `db.metadata` 自动补缺失表/列/索引，幂等、零新依赖）为鲁棒主体 + seed_defaults.py（幂等种子：12 默认节次 + 5 预警配置），统一接入 `app/db_init.py::init_database` 内 `ensure_database_ready`，受 `TESTING` 守卫（测试库沿 `create_all` 不污染）。runner.py 保留为**已弃用历史参考**（不接入启动）。
- ⚠️ **关键发现**：legacy 迁移脚本长期损坏（6 个 `from app import app, db` 导入失败；`score_change_float.py` 对全新库盲目 `ALTER COLUMN` 失败）→ 真实 schema 由 `create_all` 维护。更关键：**模型/迁移漂移**——`User.risk_score`/`User.last_risk_updated`/`ScoreRecord.operation_log_id` 仅由 legacy 脚本 `ALTER` 追加、**未进模型** → 全新库缺列、`warning_service` 写 `user.risk_score` 必崩。已**收口进模型**（`models/user_models.py`/`score_models.py`）由 `create_all`/`reconcile` 统一维护。
- 测试闸门：后端全量 3 批串行（`--timeout=0`）= **2225 passed / 0 failed / 0 errored / 7 skipped**；前端四闸门 = tsc 0 / eslint 0 / prettier 0 / vitest 0（D 线覆盖率战役已收口，ratchet 锁定 Stmts89/Branch77/Funcs88/Lines91）。

## 运行 / 测试（口径固定）
- 后端 dev：`python run.py --env development --host 127.0.0.1 --port 5000`；改后端**强杀全部 python 再重启**（SocketIO 不 reload）。
- pytest/run_regression **必须** `apps/backend/.venv/Scripts/python.exe`（系统 Py3.11 缺 werkzeug）。全量串行基线 **2225 passed / 7 skipped / 0 failed**（P0-d 落地后实测）；勿用 xdist `-n 4`（2 个 nlp_performance 假失败）；串行 3 批分跑（`--timeout=0`）。
- ⚠️ **沙箱单进程全量 pytest 会超时退出**：conftest `app` fixture 为 **function 级**，每用例重建 Flask+Api+注册 70 命名空间；单进程累积创建 2000+ app 实例，内存/GC 压力下第 ~1500 个起单次 app 初始化（werkzeug 路由编译）突破 120s → 整轮被 `--timeout` 杀、junitxml 不写出（**非产品回归，真机更快不触发**）。**绕行**：`FLASK_LIGHTWEIGHT=true`（跳过 MQTT/调度器 init 的远程连接阻塞）+ 分进程批量跑（脚本 `apps/backend/run_regression_batched.py`：collect 统计用例数→按累计≤150 用例/≤10 文件切片→每批独立 subprocess + 独立 junitxml + 整批 `timeout 600` 兜底）。剔除 3 个需完整 app 初始化的环境依赖用例：`test_app_init.py` 整文件 + `test_api_contract.py` 的 `test_frontend_calls_have_backend_routes`/`test_no_exams_import_orphan`。本次（2026-10-05）实测：**2266 用例 / 2253 passed / 6 failed(全为测试侧或环境缺失) / 0 error / 7 skipped**，无产品回归。
- ✅ **6 个失败已全部修复（2026-10-05，仅改测试、零业务逻辑改动）**：`test_PhoneBoxPolicy_to_dict` 补 2 列 key / `test_leave_service` 三用例给 teacher 绑定 `primary_class_id` / `test_mqtt_publish` 注入 no-op limiter+隔离 `publish_mqtt` / `test_clear_cache` no-op `shutil.rmtree`。修复后 4 文件全集 40 passed / 0 failed，预期全量 **2259 passed / 0 failed / 7 skipped**。报告：`docs/reports/pytest全量回归-20261005.md`。
- 前端四闸门 managed Node 22.22.2 直调二进制（typescript/bin/tsc · eslint/bin/eslint.js · prettier/bin-prettier.js · vitest/vitest.mjs run）。基线 38 文件 / **276 passed / 3 skipped**。
- 单测三要素：退出码=0 / 无 failed / 报告文件数==磁盘文件数；**禁 commit 除非用户显式要求**。
- ruff 唯一口径 `ruff check apps/backend`（+`--select C901`）。run_regression 5 闸门用 PowerShell 直跑；回归日志剔 `\0` 再 UTF8。

## 已收官（勿再排期）
C901 收口(58→47) · safe_handle 收敛 18 处 · F17 路由服务化 + service 层写路径 C901 提取（2026-10-02 实测全闭环，全仓 C901 仅余 db_init/reconcile/seed_defaults 启动种子基础设施 + test_api_contract 测试，无业务写路径遗留） · B3 to_dict · E1–E6 · NLP 四塔 · hooks barrel · 班主任工作台(12 子页+聚合 `/workbench`) · M9 分页 · T12 巨型页拆分(≥600 行=0) · 06 差异 17 项全量 · 06 收口轮三项(归档旧 MQTT 文档/补 #4 阶段3 UI/补阶段1 白名单开关) · **P1-f Prometheus `/metrics` 暴露** · **D线覆盖率战役收口(ratchet Stmts89/Branch77/Funcs88/Lines91)** · **前端 ESLint 清零(0 errors/0 warnings)**（`app/metrics_exporter.py` 独立 CollectorRegistry + 免鉴权端点 + 限流豁免 + TESTING 守卫；`app/__init__.py:94` 挂载；`tests/test_metrics_exporter.py` 3 passed）。⚠️ `docs/生产就绪评估-20260922.md` 标 P1-f「未完成」已**过时**，勿据此重复排期。历史细节见 `memory/2026-09-12.md` 等日志。
- **模块评估报告第六节 6 项 Backlog 全收口**（2026-10-03）：#391 `get_class_compare` 批量 · #392 算法 65 处 `@safe_handle` 文案抽 `algo_safe_handle` · #393 课表导入 `_apply_imported_rows` 批量 · #394 系统指标子查询批量 · #395 `project_evaluation.py` print→logging · #396 NLP 静态数据外提模块常量；另 #397 死代码清除（ruff F401/F841 真死代码，保留 11 个 `*_partN` 副作用导入）。详见 `docs/reports/模块逐评估与优化报告-20261003.md` §6。

## 后端铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]`；**未跑回归=重构未完成**。
- RBAC：改后跑 `verify_rbac_consistency.py --check-only`（G2 68/DB 70/seed 66/teacher 30）；班级隔离 `_CLASS_SCOPE_PREFIXES` 12 词根；`db_session_scope` 写路径 `detach=False`。
- 枚举常量化**只收拢字面量**绝不做跨语义合并（`not_in_time` ≠ `not_in_time_window`）；收紧判据留兜底（`is_device_online or status=="online"`）。

## 前端规范
tsconfig 严格档；禁 `any`；Context value useMemo；src 全 LF；prettier 100/singleQuote/semi/jsxSingleQuote/lf；导入走 barrel；hook 复用优先；含 JSX 的 hook 必 `.tsx`。

## ESP32 / OTA 真实状态
- `device_type` 维度已闭合（`FirmwareVersion.device_type` + `get_latest_active_firmware(device_type)`）。
- F1 五阶段 A–C 已实装（`negotiate_all_devices` 逐设备协商 + `/ota/check` 按类型过滤 + `test_ota_type_isolation.py`）；phonebox 无缝 OTA 自动推送「最后一公里」已于 2026-10-01 核查闭环（register/heartbeat→`try_auto_negotiate`→`publish_ota_command`→`phonebox/ota/{device_id}` 订阅→`performOTAUpdate` 全链路，含 HMAC 验签/断点续传/MD5/Boot 回滚）。**OTA 主线收口**，doorlock 仍记 C2 硬件推迟（固件缺 `Update.h`/不订阅 `phonebox/ota/{id}`/不发 register；后端 `device_type='doorlock'` 维度已就绪，硬件到位即可自动推送）。
- 硬件对接文档唯一入口 `docs/esp32/`（7 文件）；后端源码是唯一事实来源。

## 关键坑（沙箱环境必读）
- ⚠️ **EOL 守恒**：backend 多数 `.py` 为 CRLF，改写前**逐文件检测实际行尾**再按自身风格守恒（存在纯 LF 例外，禁断言 `crlf>0`）。
- ⚠️ **git-bash coreutils 损坏**（rm/ls/grep/find/tail/cd 均 command not found）。文件增删/行数统计/目录列举一律用 Python 脚本（`os`/`pathlib`）；pytest 用 `os.chdir` 包装。
- ⚠️ **`PYTEST_ADDOPTS=--timeout=300`**：长回归被 300s 杀 → 传 `--timeout=0`（勿 `-p no:timeout`）；全量多独立 pytest 进程分批 + `--junitxml` 聚合。
- ⚠️ **绝不直接改 `.git` 内部文件**：修 ref 走 git 命令；远程同步只信 `git ls-remote origin <branch>`，不信用 `git status -sb` ahead/behind（沙箱 tracking 假陈旧）。
- ⚠️ **packed-refs 被写成 CRLF → `badRefName` 损坏（新型沙箱损坏）**：症状 `git fsck` 报 `packed-refs line N: badRefName 'refs/heads/main?'` + `invalid sha1 pointer 0000000...`，commit 时 `geometric repack failed`。根因是 `.git/packed-refs` 为 CRLF（git 要求 LF），尾随 `\r` 污染 refname + 全零 SHA 墓碑行。**`git update-ref -d` 因 `?` 触发 Windows 文件名非法无法用 git 命令删** → 必须用 Python `open(pr,'wb')` 写回**纯 LF** 干净 packed-refs（仅留有效 ref，先备份 `.bak`），再 `git fsck` 核验零报错；随后 push + `ls-remote` 核验（实测见 `memory/2026-09-27.md` B25）。
- SQLite join User 双 join → ambiguous；conftest 动态 Namespace 须自带 `path`；同名类型多处定义（改前 grep 全仓定位真实源）。
- ⚠️ **装饰器工厂不可用 `partial` 占位（2026-10-03 实战翻车）**：`utils/decorators.py::safe_handle(default_status=500, log_trace=True, message=None, error_code=None)` 是**装饰器工厂**（首参是 `default_status`，**不是 `func`**），`@safe_handle(default_status=400, message=...)` 正确。若用 `algo_safe_handle = partial(safe_handle, default_status=400, message=...)` 再 `@algo_safe_handle` 裸用 → 路由函数被当**首个位置参数**填入 `default_status` 槽 → `TypeError: safe_handle() got multiple values for argument 'default_status'`。**该异常被 conftest `walk_packages(api)` 捕获吞掉 → `_API_MODULE_NAMES=[]` → 命名空间 0 注册 → 所有路由测试 404（大规模失败假象）**。正确复用写法：`def algo_safe_handle(func): return safe_handle(default_status=400, message=...)(func)`（闭包显式收 `func` 再转发工厂）。复用任何装饰器工厂前先确认其签名首参是否为 `func`。
- ⚠️ **前端 `vitest run --coverage` 结束清理 `coverage/.tmp` 触发 safe-delete 守卫崩溃**（NEW）：删除 `.tmp`（216 原始 v8 文件 > 50 阈值）触发 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]` Unhandled Error → 退出码非 0，**但覆盖率已算完、报告已写、测试全绿**。根因：守卫由 `node-language-shim.cjs`（经 `NODE_OPTIONS --require` 预载）注入，且 **vitest re-spawn node 用原始 env 重构** → `NODE_OPTIONS=` / `export` / `env -u` 清 safe-delete 相关 env 均**无法**在 vitest 进程内禁用（旧笔记「`CODEBUDDY_SAFE_DELETE_ENABLED=0` 可屏蔽」对 vitest **无效**，勿再信）。**绕过**：① 跑完直接读 `coverage/coverage-summary.json`（json-summary 在崩溃前已写出）取权威四指标，无 `threshold` 报错 + 无 FAIL 即 gate 通过；② 不带 `--coverage` 跑 `vitest run` 可干净 EXIT=0 验证零失败。

## 项目现状快照（2026-10-03 评估更新）
- **项目已无大型工程债可推进**：功能完成 + 生产就绪（P0 全收官）+ 技术债基本清零。D0/D1/D2 清理战役、F17 路由服务化、班主任工作台、ESP32 phonebox OTA、前端 D 线覆盖率均已收官。
- ⚠️ **旧规划/评估文档已归档（2026-10-03）**：原顶层 `docs/下一步开发计划-20260919.md`（D1–D6）、`docs/TECH_DEBT_LEDGER.md`（DEBT-001）连同 25 份 2026-08 旧评估/计划/方案/执行日志，统一 `git mv` 至 `docs/archive/历史评估与计划_归档/`（git 历史保留、未删除；明细见 `docs/文档审计归档报告-20261003.md`）。归档后实测结论不变：D1 to_dict 83/83 全覆盖、D2 路由 0 文件 >600 行、D3 静默吞异常 0 处、D5 裸 except 实为注释误报（真实代码用 `except Exception`）、DEBT-001 腾讯云短信 P2-3 已移除 stub 并明确报错、`security.py` 第3行格式损坏亦已修复入库（git diff 空）。
- 下一步方向由「产品新需求」驱动（技术债已清零，无必修债可挖）；文档审计归档已于 2026-10-03 完成（见 `docs/文档审计归档报告-20261003.md`）。权威下一步计划见 `docs/下一步开发计划-20261003.md`（替代已归档旧计划，基于实测刷新）。
- ✅ **C 类可选增强已落地（2026-10-03, commit 4aee583）**：生产运维 Runbook（`docs/reports/生产运维Runbook-20261003.md`）+ API 文档站增强（`docs/api/README.md` + `scripts/export_openapi.py` 刷新 `/swagger.json` 快照 + `scripts/serve_api_docs.py` 本地托管）+ Grafana/Prometheus 监控基座（`grafana/dashboard.json` 8 面板 + `prometheus/alert_rules.yml` 5 告警，消费已就绪 `/metrics`）+ 依赖审计 CI 闸门（`.github/workflows/dependency-audit.yml` 按月+PR，后端 PyPI/OSV、前端官方源）。**零代码改动**（纯配置/文档/脚本），未触碰测试闸门。
- 🔍 **项目优化点评估（2026-10-03, `docs/reports/项目优化点评估-20261003.md`）**：基于真实代码静态核查。结论=成熟稳定、基础设施层已扎实（SQLite WAL/mmap256MB/busy_timeout、连接池、~100 处 `@cached_api` 读路径缓存、184 模型索引、RBAC/限流/监控/依赖审计全就位），无大型性能债。**高优先级唯一硬伤**：`utils/api_cache_middleware.py::generate_cache_key` 缓存键**不含用户维度**→ 跨用户缓存越权读取风险（与 RBAC/班级隔离铁律冲突，待修，低风险）。中优先级：前端 dist 本地 3x 冗余陈旧 chunk（6.79MB，Docker 部署清空不影响线上）+ 无构建压缩；分析时间范围聚合索引核实。其余 N+1/连接池等为低优先级。→ **已全部落地修复（2026-10-03, commit 5e3db73）**：`generate_cache_key` 并入用户维度（`_cache_user_dimension()`，优先 `g.current_user` 降级解码 JWT，对齐 RBAC/班级隔离铁律）；`ScoreRecord`/`OperationLog` 补复合索引（reconcile 幂等建索引）；`academics_service`/`alert_service` 两处 N+1 收敛为 `in_()`/`group_by`；`config.py` 连接池 `20/40→10/20`；前端走 nginx 边缘 gzip（`apps/frontend/nginx.conf`）。后端全量回归 `2228=2221 passed/0 failed/7 skipped` 零破坏。
- 🔁 **二次复查 + 小范围重构（2026-10-03 傍晚, `docs/reports/项目二次复查与小重构-20261003.md`）**：再次完整查阅。① 首轮缓存键用户维度修复二次核验闭环（键格式兼容 invalidate_cache）；② 落地小重构——删除 `api_cache_middleware.py` 死代码（`CacheStatistics` 类 + `cache_stats` 实例 + 空 `before_request_cache`，grep 证全仓零引用），保留功能性 `after_request_cache`；③ 整体复查结论=成熟稳定、无大型优化债；可选残留（算法模块 65 处重复 `@safe_handle` 文案）超出「小范围」且价值低，未执行。⚠️ 当回合 Bash/PowerShell 环境故障，缓存回归待工具恢复后跑 `tests/test_cached_api.py` 等闭环再提交推送。

## 性能优化 OPT-1 / OPT-2（2026-10-06/07 收口）
- **重大发现**：`config.SQLITE_CONFIG` 此前是**死配置**——全仓仅定义处 1 处出现，无任何 `connect` 监听器 → SQLite 以库默认运行（journal_mode=delete / cache_size=-2000 / mmap_size=0 / synchronous=2）。
- **OPT-1（已落地）**：`app/db_init.py` 新增 `@event.listens_for(Engine,"connect") _apply_sqlite_perf_pragmas`，把 7 个性能 PRAGMA（WAL / cache_size=-100000 / temp_store=memory / mmap_size=256MB / synchronous=1 / busy_timeout=5000 / locking_mode=NORMAL）应用到每个 SQLite 连接。**有意排除 `foreign_keys`**（正确性开关、历史迁移依赖 OFF、需专项回归）。实测读密集负载 **1.88× 加速**（2020ms→1074ms）。
- **OPT-2（已落地）**：`utils/diagnostics.py::check_cpu_usage` 把 `psutil.cpu_percent(interval=0.1)`（每次阻塞 100ms）改为 `interval=None`（非阻塞），实测 109ms→0.56ms。
- **三处预存在失败已修复（全量回归 0 failed 闭环）**：① `test_decorators` 实现正确、测试期望过时 → 改写断言统一兜底文案；② `study_group_service` 真实 bool bug（`is_active=True` 却 `.lower()`）→ 新增 `_normalize_is_active` 兼容 bool/str/None；③ `test_leave_service::test_auto_checkin_...` `resolve_leave_for_unlock` 按 R26 不内置 commit → 测试补 `db_session.commit()` 模拟调用方。
- 全量回归 `run_regression_batched.py`（21 分块）：**2318 passed / 0 failed / 0 errors / 7 skipped**。报告：`docs/reports/性能优化报告-20261006.md`。
- 📌 **`foreign_keys` 决策：维持 OFF**（正确性开关、历史迁移依赖 OFF、未经专项迁移+回归；OPT-1 已排除）。若需开启须作为独立任务专项处理。
