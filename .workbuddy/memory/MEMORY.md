# 管理平台设计 — 长期记忆

## 运行/测试
- 后端：系统 Py3.11 `C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`，`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`；改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。MQTT 改 `app/service_init.py::init_mqtt`。
- 前端：Vite dev proxy /api、/ws→5000；build `node node_modules/vite/bin/vite.js build --logLevel warn`；`tsc --noEmit`；lint `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx`；单测 `node node_modules/vitest/vitest.mjs run [files]`。⚠️ 勿用 `node node_modules/.bin/eslint`/`.bin/vitest`（bash 脚本被当 JS）。
- ⚠️ **全量 vitest 勿加 `--pool=forks`**：`vitest.config.ts` 已按 `process.env.CI ? 'forks' : 'threads'` 自动选池；强制 forks 在 Windows+中文路径下 worker 启动慢（全量 >11min vs threads ~7m51s）且放大内存问题。定向跑少量文件加 `--pool=forks` 无碍。
- ⚠️ **单测闸门判定三要素（缺一不可）**：① 日志中**退出码行存在且为 0**；② `Errors 0 error`；③ **报告文件数 == 磁盘文件数**（`sed 's/\x1b\[[0-9;]*m//g'` 剥 ANSI 后 grep `(✓|↓|×|❯) src/...test.*` 得已报告集，与 `find src -name '*.test.*'` 做 `comm -13` 差集为空）。仅看 `passed` 数或 `grep FAIL` 会漏判——崩溃 worker 所跑文件会**静默从统计消失**，造成"全绿"假象（2026-09-02 因此误报过一次）。差集非空时，缺失文件即崩溃 worker 正在跑的文件，是定位真凶的最快手法。
- ⚠️ **核实是否真的推送用 `git ls-remote`，别信本地 `git status -sb`**：本机 `.git/refs/remotes/origin/main` 目录不存在，该 ref 只存在于 `.git/packed-refs` 且常陈旧；`git update-ref` / `git pack-refs --all` 报成功却不实际写入（`touch .git/_wtest` 可写，非权限），导致 `git status` 长期显示 `ahead N` 假象。权威核对：`git ls-remote origin refs/heads/main` 取远端真值 + `git rev-list --count <真值>..HEAD` 应为 0。诊断/定位手法见用户级技能 `~/.workbuddy/skills/vitest-crash-triage/SKILL.md`。
- pytest：系统3.11，`-p no:locust --timeout=600`；全量 `python -m pytest -p no:locust --timeout=600 -q`（pytest.ini testpaths=backend/tests，15-21min）。**基线（2026-09-04 起）2080 passed / 8 skipped / 0 failed**——9 个历史 failed 已清：① workbench 隔离 7 例=test 侧分页信封契约漂移（已 _items() 解包对齐）；② test_anomaly_types_thresholds 断言 5→3（对齐配置/description）；③ test_clear_cache 端点改逐目录容错（rmtree 失败不再 500，Windows 占用 .pyc 同受益）。

## 架构/重构铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **F17 防腐层（✅全收口，#629 剩余写路径 2026-08-30 真终态闭合）**：写入/事务路径内联 db.session → `services/*_service.py` 薄封装，路由保留 get_or_404/校验/缓存失效/副作用/响应构造、逐字节复刻；#629 收口含 rollback 守卫下沉 service（不得仅删）。回归闸门脚本在**仓库根 `scripts/run_regression.sh`**（非 backend/scripts），默认系统 Py3.11，5 步全绿。终态见 `docs/F17_路由服务化重构_终态汇总与收尾记忆.md`。
- **提取/重构必跑回归**：后端 `bash scripts/run_regression.sh` + 被改模块补 pytest；前端 `tsc --noEmit`+`eslint`+`vitest run`（全量不加 `--pool`，并按上文"三要素"判定）。**未跑回归=重构未完成**。
- ⚠️ pytest 路径坑：records/scores 域正确文件 `test_scores_routes.py`/`test_records_routes.py`（`test_score_record_service.py` 不存在，误跑静默 exit=4）。
- ⚠️ 新建后端工具前先 Glob 确认不存在（excel_utils/query_optimizer 曾误覆盖）。
- 禁一次性全改、禁 git commit。

## 分页 / top-N 数量参数规范（backend/utils/pagination.py）
- **翻页型列表**用 `get_pagination(default=20, max_per_page=200)` → `(page, per_page)`，page 下限 1、per_page 上限 200、非法输入回退 default。M9 已收口 class_management 13 端点等。
- **top-N 型**（排行榜 / 导出 / 最近列表，语义是"取前 N 条"不适合翻页）用 `get_limit(default=50, max_limit=200)` → 恒满足 `1 <= limit <= max_limit`，**不引入 page 语义**（2026-09-02 新增）。
- ⚠️ **排行榜 `/rank/student`、`/rank/class` 保持 limit 语义不变**，不要套分页信封——榜单语义就是取前 N 名，翻页无业务意义；其 `min(limit,200)` 钳制本已存在。
- ⚠️ 任何从 request 取值喂给 ORM `.limit()` 的参数**必须钳制**，否则 `?limit=999999999` 即全表加载（2026-09-02 修 export_routes 与 admin_notifications_routes 两处无界入口）。排查手法：`grep -rnE "\.limit\(" app api services utils`（排除 backups/refactor_F17），逐个追变量来源。
- 导出端点 `export_routes` 上限取 **10000**（= 默认值，与接口文档"默认10000"一致，零契约漂移）；业务若需导出超 1 万条须走用户审核调整。上限值属业务决策，改动前须确认。

## RBAC/双JWT/db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`(G2 68/DB70/seed66/teacher30)；teacher 含 notification.send 无 score.manage；`/api/roles` 已下线。Admin=access+requires_permission；学生=student+requires_student。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径必须 detach=False**（Flask teardown 清），否则 DetachedInstanceError 500。

## 关键坑
- MQTT 双连接（控制 QoS1 score/#+phonebox/query/unlock/#/ota/#/points/#；遥测 QoS0 phonebox/#）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)`→重复 JOIN `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` 不切 .env.development；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"`（连字符）否则 404。
- sandbox torch 段错误：验证主线程先 `import services.nlp_ml_service` 预热再 import app；pytest 输出被日志淹没须 grep 结果行。
- 不主动 git commit；push 走 `origin`（2026-09-04 实测当前仅此一个 remote，URL=`ssh://git@ssh.github.com:443/DLLMY/score-management-platform.git`；历史记忆中的 `origin-ssh` 名已不存在）。核实推送一律 `git ls-remote origin refs/heads/main` 取远端真值，勿信本地 `git status` ahead。

## NLP 模块（✅P0–P1全修 2026-08-29）
- P0-1 /model/evaluate 去伪造0.85；P0-2 ml_based 死分支已禁；P0-3 优化器误引 NLPMLService→NLPMLTrainingService 已修。P1-1 路由52法加 `@safe_handle()`；P1-2 评分并发防重 ProcessedMessage；P1-3 前端信封统一 unwrapEnvelope/parseEnvelopeSafe；P1-4 测试挖出 create_rule 未设 is_active / `_usage_to_dict` 读错列 两缺陷并修。
- #929 analyzer 单例污染（测试加 reset_metrics fixture，未改生产）；#930 FastNLPParser 复句拆分（**快路径潜伏态，仅预热不可达**）；#931 deep_semantic_match 接入真实 BERT（候选内相对归一，降级归零与 np.zeros 逐字节一致）。
- **T7 torch 懒加载**：`nlp_enhanced_service` 删顶层 torch import，`_get_ml_service()` 首次 ml_predict 才加载。
- **活跃链路**=`api/nlp/nlp_routes.py::_get_parser()`→`services/nlp_enhanced_service.get_nlp_parser()`；`services/nlp_service.py`(FastNLPParser) 仅预热。沙箱无 BERT/TFIDF 端到端验证受限；G5 当前 **469 paths** 零漂移。

## 班主任工作台（✅2026-08-21）
- `useWorkbenchClass`（store+useSyncExternalStore，12子页共享当前班级 sessionStorage 持久）；后端班级隔离 join User.class_info_id；评语模型 TeacherComment 路由 /api/teacher-comments 权限 comment.view/edit。
- ⚠️ **CRLF 文件禁用 Edit 直改**：backend 大量 .py 为 CRLF，Edit 工具会把整文件规范成 LF → 全文件噪音 diff（已发生 2 次：system_routes/scheduled_tasks）。改 CRLF 文件须先用 python 二进制读改写（继承 \r\n），或用脚本注入时按源主行尾换行。改完 `git diff --stat` 若出现"行数≈全删全加"即翻 EOL，立即恢复。
