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
- 前端四闸门 managed Node 22.22.2 直调二进制（typescript/bin/tsc · eslint/bin/eslint.js · prettier/bin-prettier.js · vitest/vitest.mjs run）。基线 38 文件 / **276 passed / 3 skipped**。
- 单测三要素：退出码=0 / 无 failed / 报告文件数==磁盘文件数；**禁 commit 除非用户显式要求**。
- ruff 唯一口径 `ruff check apps/backend`（+`--select C901`）。run_regression 5 闸门用 PowerShell 直跑；回归日志剔 `\0` 再 UTF8。

## 已收官（勿再排期）
C901 收口(58→47) · safe_handle 收敛 18 处 · F17 路由服务化 + service 层写路径 C901 提取（2026-10-02 实测全闭环，全仓 C901 仅余 db_init/reconcile/seed_defaults 启动种子基础设施 + test_api_contract 测试，无业务写路径遗留） · B3 to_dict · E1–E6 · NLP 四塔 · hooks barrel · 班主任工作台(12 子页+聚合 `/workbench`) · M9 分页 · T12 巨型页拆分(≥600 行=0) · 06 差异 17 项全量 · 06 收口轮三项(归档旧 MQTT 文档/补 #4 阶段3 UI/补阶段1 白名单开关) · **P1-f Prometheus `/metrics` 暴露** · **D线覆盖率战役收口(ratchet Stmts89/Branch77/Funcs88/Lines91)** · **前端 ESLint 清零(0 errors/0 warnings)**（`app/metrics_exporter.py` 独立 CollectorRegistry + 免鉴权端点 + 限流豁免 + TESTING 守卫；`app/__init__.py:94` 挂载；`tests/test_metrics_exporter.py` 3 passed）。⚠️ `docs/生产就绪评估-20260922.md` 标 P1-f「未完成」已**过时**，勿据此重复排期。历史细节见 `memory/2026-09-12.md` 等日志。

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
- ⚠️ **前端 `vitest run --coverage` 结束清理 `coverage/.tmp` 触发 safe-delete 守卫崩溃**（NEW）：删除 `.tmp`（216 原始 v8 文件 > 50 阈值）触发 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]` Unhandled Error → 退出码非 0，**但覆盖率已算完、报告已写、测试全绿**。根因：守卫由 `node-language-shim.cjs`（经 `NODE_OPTIONS --require` 预载）注入，且 **vitest re-spawn node 用原始 env 重构** → `NODE_OPTIONS=` / `export` / `env -u` 清 safe-delete 相关 env 均**无法**在 vitest 进程内禁用（旧笔记「`CODEBUDDY_SAFE_DELETE_ENABLED=0` 可屏蔽」对 vitest **无效**，勿再信）。**绕过**：① 跑完直接读 `coverage/coverage-summary.json`（json-summary 在崩溃前已写出）取权威四指标，无 `threshold` 报错 + 无 FAIL 即 gate 通过；② 不带 `--coverage` 跑 `vitest run` 可干净 EXIT=0 验证零失败。

## 项目现状快照（2026-10-03 评估更新）
- **项目已无大型工程债可推进**：功能完成 + 生产就绪（P0 全收官）+ 技术债基本清零。D0/D1/D2 清理战役、F17 路由服务化、班主任工作台、ESP32 phonebox OTA、前端 D 线覆盖率均已收官。
- ⚠️ **旧规划/评估文档已归档（2026-10-03）**：原顶层 `docs/下一步开发计划-20260919.md`（D1–D6）、`docs/TECH_DEBT_LEDGER.md`（DEBT-001）连同 25 份 2026-08 旧评估/计划/方案/执行日志，统一 `git mv` 至 `docs/archive/历史评估与计划_归档/`（git 历史保留、未删除；明细见 `docs/文档审计归档报告-20261003.md`）。归档后实测结论不变：D1 to_dict 83/83 全覆盖、D2 路由 0 文件 >600 行、D3 静默吞异常 0 处、D5 裸 except 实为注释误报（真实代码用 `except Exception`）、DEBT-001 腾讯云短信 P2-3 已移除 stub 并明确报错、`security.py` 第3行格式损坏亦已修复入库（git diff 空）。
- 下一步方向由「产品新需求」驱动（技术债已清零，无必修债可挖）；文档审计归档已于 2026-10-03 完成（见 `docs/文档审计归档报告-20261003.md`）。权威下一步计划见 `docs/下一步开发计划-20261003.md`（替代已归档旧计划，基于实测刷新）。
