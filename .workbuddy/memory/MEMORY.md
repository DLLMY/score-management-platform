# 管理平台设计 — 长期记忆

## 运行/测试
- 后端：系统 Py3.11 `C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`，`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`；改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。MQTT 改 `app/service_init.py::init_mqtt`。
- 前端：Vite dev proxy /api、/ws→5000；build `node node_modules/vite/bin/vite.js build --logLevel warn`；`tsc --noEmit`（managed Node 22.22.2 + 本地 `node_modules/typescript/bin/tsc`）；lint `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx`；单测 `node node_modules/vitest/vitest.mjs run [files]`。⚠️ 勿用 `node node_modules/.bin/eslint`/`.bin/vitest`（bash 脚本被当 JS）。
- ⚠️ **全量 vitest 勿加 `--pool=forks`**：`vitest.config.ts` 按 `process.env.CI ? 'forks' : 'threads'` 自动选池；Windows+中文路径下 forks 慢且放大内存。定向少量文件加 `--pool=forks` 无碍。
- ⚠️ **单测闸门三要素（缺一不可）**：① 退出码存在且为 0；② 无 `Errors`/`failed`；③ **报告文件数==磁盘文件数**（`sed 's/\x1b\[[0-9;]*m//g'` 剥 ANSI 后 grep `(✓|↓|×|❯) src/...test.*`，正则含 `jsx`、反斜杠 `s/\\/\//g` 归一），与 `find src -name '*.test.*'` 做 `comm -13` 差集为空）。崩溃 worker 所跑文件会静默从统计消失，造成"全绿"假象。
- ⚠️ **推送核实用 `git ls-remote`，别信本地 `git status -sb`**：`.git/refs/remotes/origin/main` 目录不存在，该 ref 仅存 packed-refs 且常陈旧。权威：`git ls-remote origin refs/heads/main` + `git rev-list --count <真值>..HEAD` 应为 0。诊断见 `~/.workbuddy/skills/vitest-crash-triage/SKILL.md`。
- pytest：系统3.11，`-p no:locust --timeout=600`；全量 `python -m pytest -p no:locust --timeout=600 -q`（pytest.ini testpaths=backend/tests，15-21min）。基线 2026-09-05 **2066 passed / 7 skipped / 0 failed**。
- 禁 git commit（除非用户显式要求）；push 走 `origin`（URL=`ssh://git@ssh.github.com:443/DLLMY/score-management-platform.git`）。

## 架构/重构铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **F17 防腐层（✅全收口 2026-08-30）**：回归闸门 `scripts/run_regression.sh`（仓库根，非 backend/scripts），5 步全绿。#629 收口含 rollback 守卫下沉 service。
- **B3 to_dict 战役（✅全收口 2026-09-06，五实体 +254/−170 全绿）**：`User/ScoreRecord/ScoreRule/Admin/ScoreRankRule` 模型层 `to_dict(fields=None)` + 路由内联序列化收敛到字段常量。残留均非 API 序列化（审计快照/MQTT 协议/引擎 DSL/预热缓存）。
- **提取/重构必跑回归**：后端 `bash scripts/run_regression.sh` + 被改模块补 pytest；前端 `tsc --noEmit`+`eslint`+`vitest run`（全量不加 `--pool`）。**未跑回归=重构未完成**。
- ⚠️ 新建后端工具前先 Glob 确认不存在（excel_utils/query_optimizer 曾误覆盖）。

## 分页 / top-N 规范（backend/utils/pagination.py）
- 翻页型 `get_pagination(default=20, max_per_page=200)`→`(page, per_page)`，上限 200、非法回退 default。M9 已收口 class_management 13 端点。
- top-N 型（排行榜/导出/最近）`get_limit(default=50, max_limit=200)`→恒 `1<=limit<=max_limit`，**不引入 page**。
- ⚠️ 排行榜 `/rank/student`、`/rank/class` 保持 limit 语义；任何喂 ORM `.limit()` 的 request 参数**必须钳制**（`grep -rnE "\.limit\(" app api services utils` 追溯来源）。导出上限 **10000**（接口文档默认）。

## RBAC/双JWT/db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`(G2 68/DB70/seed66/teacher30)；teacher 含 notification.send 无 score.manage；`/api/roles` 已下线。Admin=access+requires_permission；学生=student+requires_student。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径须 detach=False**，否则 DetachedInstanceError 500。

## 关键坑
- MQTT 双连接（控制 QoS1 / 遥测 QoS0）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)`→重复 JOIN `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` 不切 .env.development；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"`（连字符）否则 404。
- sandbox torch 段错误：验证主线程先 `import services.nlp_ml_service` 预热再 import app；pytest 输出被日志淹没须 grep 结果行。
- ⚠️ **CRLF 文件禁用 Edit 直改**：backend 大量 .py 为 CRLF，Edit 工具会把整文件规范成 LF → 全文件噪音 diff（已发生 2 次）。改 CRLF 文件须用 python 二进制读改写（继承 \r\n）；改完 `git diff --stat` 若行数≈全删全加即翻 EOL，立即恢复。bytes 正则 `re.M` 下 `.*$` 会吃掉行尾 CR → 锚含 `\r` 时 `rstrip(b'\r')`。

## NLP 模块（✅P0–P1全修 2026-08-29）
- P0-1 去伪造0.85；P0-2 ml_based 死分支禁；P0-3 优化器误引已修。P1-1 路由52法加 `@safe_handle()`；P1-2 并发防重 ProcessedMessage；P1-3 前端信封统一；P1-4 测试挖出 create_rule/usage 缺陷已修。
- T7 torch 懒加载：删顶层 torch import，首次 ml_predict 才加载。
- 活跃链路 `api/nlp/nlp_routes.py::_get_parser()`→`services/nlp_enhanced_service.get_nlp_parser()`；`services/nlp_service.py`(FastNLPParser) 仅预热。G5 当前 469 paths 零漂移。

## 班主任工作台（✅2026-08-21）
- `useWorkbenchClass`（store+useSyncExternalStore，12子页共享当前班级 sessionStorage 持久）；评语模型 TeacherComment 路由 /api/teacher-comments 权限 comment.view/edit。
- 4 条硬要求：字段命名统一 / 权限体系 / 字段调整权限变更业务逻辑不确定性须用户审核 / 优化交互与展示。指标卡下钻已落地（C-1/C-2），其余交互增强待拍板。

## A 轨列表钩子迁移 SOP（2026-09-05 固化）
- 选型：服务端**分页**列表→`useListFetch`（`{items,total,loading,error,refetch,mutate,setItems,setTotal}`）；**全量下拉/选项**→`useListData`（`{data,loading,error,refetch}`，data 恒数组）。
- 底层 `useOptimizedFetch` 已加 `enabled`（默认 true）：false 时挂载/deps 变化不自驱请求（并中止在途），手动 refetch 仍可触发——用于模态/切 tab 按需加载。`useListFetch`/`useListData` 均透传 enabled。
- 标准迁移六步：① 取证 ② 删手工态 ③ params 声明式注入 ④ 乐观更新→mutate ⑤ handler 包装 `const loadX = useCallback(async()=>{ await list.refetch(); },[list])` 返回 Promise<void> ⑥ 渲染全量映射。
- 适配判定：✅ 纯 reload / 乐观增删 / 伪命令式；❌ **真命令式**（如 ClassManagement 的 `fetchClasses(page,keyword,skipCache,perPage)` 参数式+skipCache 绕后端缓存，需 hook 扩展 skipCache 透传，不在本专项强推）。
- 踩坑：`fetchJson` 失败返回 null 不抛→fetcher 内转抛使 error 态可见；列表与表单共享 isLoading 要拆两层；迁移后必跑全量 vitest（271 passed 基线）而非仅 tsc/eslint。
- 已迁 13 页：FrontendTelemetry / FirmwareManagement / ActivityManage / HomeworkCheck / ParentContact / Notifications / Approvals / RuleList / SemesterReport(useListData) / WakeOnLan / **StudentPortal(notifications)** / **NLPManagement(corrections)** / **RemoteNotify(history)**（后 3 处用 enabled 按需加载，2026-09-06）。
