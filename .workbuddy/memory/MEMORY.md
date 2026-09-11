# 管理平台设计 — 长期记忆

## 运行/测试
- 后端：系统 Py3.11 `C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`，`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`；改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。MQTT 改 `app/service_init.py::init_mqtt`。
- 前端：Vite dev proxy /api、/ws→5000；build `node node_modules/vite/bin/vite.js build --logLevel warn`；`tsc --noEmit`（managed Node 22.22.2 + 本地 `node_modules/typescript/bin/tsc`）；lint `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx`；单测 `node node_modules/vitest/vitest.mjs run [files]`。⚠️ 勿用 `node node_modules/.bin/eslint`/`.bin/vitest`（bash 脚本被当 JS）。
- 前端格式化：`node node_modules/prettier/bin-prettier.js --write "src/**/*.{ts,tsx}"`（入口是 **bin-prettier.js**，非不存在的 bin/prettier.cjs）。`.prettierrc` = printWidth100/singleQuote/semi/jsxSingleQuote/**endOfLine:"lf"**。**前端 src 385 文件全 LF** → prettier 零 EOL 翻转（与后端 CRLF 相反），可直接批量。**批前必跑 `--list-different` 量化 + 全 diff「去空白后比对」鉴定是否纯格式**，改后复扫 EOL。
- ⚠️ node `-e` 脚本 require 勿用 `/tmp/...`（Git Bash 与 node 解析不一致，报 MODULE_NOT_FOUND）；一律写 `C:/Users/<u>/AppData/Local/Temp/...`。
- **前端 hooks 资产（2026-09-10 评估，28 模块）**：复用率 ~71%。高复用 useStableToast44/useSubmitGuard28/useForm19/useListFetch18/useWorkbenchClass16/useDebouncedValue13/useModal13/useListData11/usePermissions11。**8 个零消费者死文件**（仅 index.ts 再导出）：useAdvancedSearch/useDeviceDetection/useOptimisticUpdate/usePWA/usePerformance/usePreload/useRouteChangeAbort/useSplitState。**部分死导出**：useShallowCompare 9 导出仅 `deepEqual` 有用；useDebouncedValue 6 导出仅 `useDebouncedValue`/`useThrottledCallback` 有用。（评估用 token 级扫描，勿用单行 `import.*name` 正则——会漏多行 import。）
- 📌 **hooks 导入规范（2026-09-11 #105 确立）**：统一从 `'.../hooks'` **barrel** 导入；`hooks/index.ts` 必须覆盖**全部 hook 模块及其类型**（已 37 行覆盖 20 模块）。**新增 hook 必须同步在 index.ts 导出**（含类型——`useForm` 的 `FormErrors`/`UseFormResult` 曾漏，致 6 处被迫直接路径）。⚠️ 改走 barrel 后 `vi.mock('.../hooks/useXxx')` **仍生效**（vitest mock 是模块级替换，barrel 的 re-export 也走该模块）——PermissionGuard.test 10 tests 实测通过；**不要**改成 mock 整个 barrel（只提供部分导出会让其余导出变 undefined）。⚠️ 静态 import 一律可从 `from '.../hooks'` 查；**动态 `import('.../hooks/useXxx')` 必须单独 grep `import\(`**，否则漏改。hooks 目录内已无 `export default`（10 处零消费者 default 已清）。
- 📌 **components 导入规范（2026-09-11 #106 确立）**：components 现为**双层 barrel**（根 `components/index.ts` 统一从 9 个子 barrel 聚合：ui/data-display/feedback/form/layout/image/lazy/special/workbench），消费者一律 `from '.../components'`。**新增子目录必须建 `index.ts` 并在根 barrel 同步聚合**；**依赖重的子目录保留独立子入口**（charts 依赖 recharts，不进根 barrel）。已删死组件 6 个（data-display/SearchInput、feedback/NetworkStatus、special/GlobalStateComponents.d.ts、skeletons/ 整目录）。⚠️ **根 barrel 改写前必做导出符号集比对**（HEAD 81 → 93 零丢失）。⚠️ **子 barrel 转发必须按文件真实导出形式**：`EmptyState.tsx` 默认导出 EmptyState、命名导出 SearchEmptyState/ErrorState，不可图省事统一写 `default as X`（曾把 SearchEmptyState 错指成 EmptyState）。
- ⚠️ **批量改 import 脚本铁律（#105/#106 两次踩坑）**：① 匹配条件必须同时含**已有 barrel import**（否则生成同源多行 import）；② 替换段必须**只吃匹配语句本身**，绝不能用 `raw[:first.start()] + raw[last.end():]` 跨越删除（会吃掉中间所有其他 import → tsc 爆 TS2304）；③ **必须先 dry-run 预览**；④ 动态 `import()` 用 `grep "from '"` 查不到，须单独扫 `import\(`。
- ⚠️ **脚本误删代码的恢复 SOP**：**不以 `git checkout` 救**（丢其它未提交改动）→ **以 tsc 报错名（TS2304/TS2552）为权威判据**（HEAD 导入集差集因 HEAD 早于重构会大量误报）→ 全仓导出索引回退 + HEAD 版本 import 映射优先 → 桶归一化 → 修完横向体检（import 路径可解析、副作用 `import 'x'` 未丢、「正文引用但导入消失」逐条核实）。详细见 `~/.workbuddy/skills/frontend-import-barrel-unification/SKILL.md`。
- **Context 渲染铁律**：provider `value={{...}}` 内联对象每次渲染新建 → 全部消费者强制重渲染。本项目已修 ConfirmDialog(35 消费者!)/GlobalStateComponents(3)/ToastContext。新增 context 必须 `useMemo` value；若 value 含函数须先 `useCallback` 稳定化（否则 memo 无效）。⚠️ exhaustive-deps 对 useCallback 化函数会新报 missing-dep，需补入 deps（判定是否本次引入用 `git show HEAD:<f>` 单独 lint）。
- **DataTable 已内置虚拟化** `virtualThreshold`（**默认值就是 200**，`useVirtual = threshold>0 && !isControlled && dataSource.length>=threshold`）。→ 本地分页大列表已**自动**虚拟化，**无需**逐页显式开启；服务端分页（受控）单页 20 行无需虚拟化。ScoreRecords 显式传 `virtualThreshold={200}` 与默认等价（冗余）。`sortedSource`/`pagedData` 已 useMemo 且 `[...dataSource]` 不改变异。
- ⚠️ **全量 vitest 勿加 `--pool=forks`**：`vitest.config.ts` 按 `process.env.CI ? 'forks' : 'threads'` 自动选池；Windows+中文路径下 forks 慢且放大内存。定向少量文件加 `--pool=forks` 无碍。
- ⚠️ **单测闸门三要素（缺一不可）**：① 退出码存在且为 0；② 无 `Errors`/`failed`；③ **报告文件数==磁盘文件数**（`sed 's/\x1b\[[0-9;]*m//g'` 剥 ANSI 后 grep `(✓|↓|×|❯) src/...test.*`，正则含 `jsx`、反斜杠 `s/\\/\//g` 归一），与 `find src -name '*.test.*'` 做 `comm -13` 差集为空）。崩溃 worker 所跑文件会静默从统计消失，造成"全绿"假象。
- ⚠️ **推送核实用 `git ls-remote`，别信本地 `git status -sb`**：`.git/refs/remotes/origin/main` 目录不存在，该 ref 仅存 packed-refs 且常陈旧。权威：`git ls-remote origin refs/heads/main` + `git rev-list --count <真值>..HEAD` 应为 0。诊断见 `~/.workbuddy/skills/vitest-crash-triage/SKILL.md`。
- pytest：系统3.11，`-p no:locust --timeout=600`；全量 `python -m pytest -p no:locust --timeout=600 -q`（pytest.ini testpaths=backend/tests，15-21min）。基线 2026-09-05 **2066 passed / 7 skipped / 0 failed**。
- 禁 git commit（除非用户显式要求）；push 走 `origin`（URL=`ssh://git@ssh.github.com:443/DLLMY/score-management-platform.git`）。
- ⚠️ **跑 `scripts/run_regression.sh` 必须覆盖解释器**：脚本默认系统 Py3.11（缺 werkzeug/flask_sqlalchemy）→ 会假报 `ImportError: cannot import name 'url_quote' from 'werkzeug.urls'` + `No module named 'flask_sqlalchemy'`（33 errors）。正解：`PYTHON_BIN="<repo>/apps/backend/.venv/Scripts/python.exe" bash scripts/run_regression.sh` → REG_EXIT=0。判据：`git status` 中 `test_` 改动数=0 时，pytest import 错必是环境而非回归。
- 后端 **E4 broad-except 长尾清零（2026-09-10 收口）**：生产 79 文件改动（全 py_compile 绿 + run_regression REG_EXIT=0），566→425 残余（余者皆已合理 fail-safe/re-raise/响应可观察）。派 subagent 前**必须先用脚本核对文件真实存在**（曾因文件名臆测致 21/29 路径不存在白跑）。

## 架构/重构铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **F17 防腐层（✅全收口 2026-08-30）**：回归闸门 `scripts/run_regression.sh`（仓库根，非 backend/scripts），5 步全绿。#629 收口含 rollback 守卫下沉 service。
- **B3 to_dict 战役（✅全收口 2026-09-06，五实体 +254/−170 全绿）**：`User/ScoreRecord/ScoreRule/Admin/ScoreRankRule` 模型层 `to_dict(fields=None)` + 路由内联序列化收敛到字段常量。残留均非 API 序列化（审计快照/MQTT 协议/引擎 DSL/预热缓存）。
- **提取/重构必跑回归**：后端 `bash scripts/run_regression.sh` + 被改模块补 pytest；前端 `tsc --noEmit`+`eslint`+`vitest run`（全量不加 `--pool`）。**未跑回归=重构未完成**。
- **E6a 前端瘦身三范式（✅全收口 2026-09-10，10 页）**：① `columns` 抽取→同目录 `columns.tsx` 工厂（纯 `[]` deps 直返数组；含 handler/state 则收参数对象，调用方仍 `useMemo` 包裹）；② 全量逻辑→`useXxxLogic.tsx` hook（主文件退化为 18–153 行薄装配）；③ 视图层→`XxxView.tsx`。**抽 hook 风险判据 = deps 接口是否已显式化**（`XxxDeps`/`XxxViewProps` 已完整则属纯搬运，零契约风险）。三个坑：**(a) hook 含 JSX 必须 `.tsx`**（否则 `TS1005 '>' expected`）；**(b) 接口 `extends Omit<ViewDeps,'xxxColumns'>` 会连带排除不在 ViewDeps 中的壳层专用字段**（activeTab/loadError/searchInput），须返回 `ViewProps & {壳层字段}` 或让主文件平铺解构；**(c) View 若从主文件导入类型（如 `UserListState`）须改指 hook**。
- **忠实度验证标准动作（搬运类重构必做）**：`git show HEAD:<file>` vs 新文件，**括号配平**抽取完整语句后 strip 缩进/空行/注释逐行 diff。⚠️ 按 `\n  );` 简易截断遇嵌套括号必错位→大量假 DIFF，必须用配平。
- **D2 视图层拆分（✅2026-09-10，8 页：ScoreRecords/FirmwareManagement/UserDetail/Notifications/TeacherComments/WorkbenchOverview/RuleList + SubjectManagement 跳过）**：针对「无子目录、hooks 密度中等（8–10 useState）、体量主要来自 JSX」的页面。**形态判据（先看主渲染段行数）**：主渲染 >150 行 → 抽 `XxxView.tsx` + 显式 props；主渲染 <60 行且已有 `XxxView` 子组件 → 直接抽 `useXxxLogic`（props 已显式化，零契约风险，如 RuleList 37 props 直接复用 `RuleViewProps`）。**props 枚举必用脚本**（渲染段标识符 ∩ 逻辑段已声明名，务必覆盖 `const {a,b}=` 与 `const [a,b]=` 两种解构，漏后者会少算 state）。五个坑：**(a) 切片末尾常多带一个 `}`**（原组件 `function X(){...}` 结尾），新 View 用箭头函数需 `};` → 生成后必查结尾 `}\n};`；**(b) 同文件 interface/const 搬 types.ts 必须加 `export`**（含 `defaultForm`、`COMMENT_TYPES` 这类非类型常量）；**(c) 早退分支 `if (isLoading/error) return <X/>` 属逻辑层留在主文件**，其图标导入也要留；**(d) columns 若留逻辑层，其 JSX 图标/Badge/formatXxx 导入要留在主文件**（View 与逻辑层各需一份，靠 eslint 收敛）；**(e) 复合类型别手造签名**，用 `ReturnType<typeof useListFetch<T>>`、`UseFormResult<T>['setFormData']`、`ReturnType<typeof useWorkbenchClass>[0]`；renderStat 这类**位置参数**函数别写成对象入参。含内联子组件时忠实度须「子组件段 + 主渲染段」分别比对，且主渲染段要去掉新增的 `return (` 行。
- ⚠️ 新建后端工具前先 Glob 确认不存在（excel_utils/query_optimizer 曾误覆盖）。

## 分页 / top-N 规范（backend/utils/pagination.py）
- 翻页型 `get_pagination(default=20, max_per_page=200)`→`(page, per_page)`，上限 200、非法回退 default。M9 已收口 class_management 13 端点。
- top-N 型（排行榜/导出/最近）`get_limit(default=50, max_limit=200)`→恒 `1<=limit<=max_limit`，**不引入 page**。
- ⚠️ 排行榜 `/rank/student`、`/rank/class` 保持 limit 语义；任何喂 ORM `.limit()` 的 request 参数**必须钳制**（`grep -rnE "\.limit\(" app api services utils` 追溯来源）。导出上限 **10000**（接口文档默认）。

## RBAC/双JWT/db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`(G2 68/DB70/seed66/teacher30)；teacher 含 notification.send 无 score.manage；`/api/roles` 已下线。Admin=access+requires_permission；学生=student+requires_student。
- ✅ **班级归属隔离已内置在 `requires_permission`（2026-09-11 核实）**：`utils/permission.py:212` 调 `_check_class_scope(permission)`，对 `_CLASS_SCOPE_PREFIXES` 12 个词根（committee/duty/seating/parent/homework/attendance/study_group/mental_health/activity/culture/study_guide/comment）自动 `ensure_class_access`/`ensure_student_access` → 越权 403。**class_management 全部路由无需逐个挂装饰器**；新增班级管理模块**必须把词根加入 `_CLASS_SCOPE_PREFIXES`**，否则隔离失效。`ALL_CLASSES=0` 哨兵必须放行（`ensure_class_access` 用 `if not class_id` 而非 `is None`）。冒烟：`tests/test_workbench_isolation_smoke.py`（12 passed）。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径须 detach=False**，否则 DetachedInstanceError 500。

## ⚠️ 审计文档引用铁律（2026-09-11 教训）
- **引用 `docs/` 下任何历史审计/待审文档前，必须先做一次实测复核**——文档生成日期 ≠ 当前状态。本次曾直接采信 `docs/班主任工作台优化方案-待审核.md`(08-29) + `grep class.view` 的**行号**（未核对行号所属路由），错误输出"P0 权限词根仍未修 / P1 越权仍未修"，实际两者早已闭环。
- **grep 权限词根必须带上下文**（`-A3` 看 `path=`），并把前端 `requiredPermission` 与后端 `@requires_permission("X")` 逐路由对齐比对；只看"某文件出现过 class.view"完全不可作判据。
- 已给 `班主任工作台优化方案-待审核.md` / `班主任页拆分方案-铁律③待审.md` / `M9分页复核-缺口清单.md` 加顶部状态横幅（已闭环）。

## 关键坑
- MQTT 双连接（控制 QoS1 / 遥测 QoS0）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)`→重复 JOIN `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` 不切 .env.development；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"`（连字符）否则 404。
- sandbox torch 段错误：验证主线程先 `import services.nlp_ml_service` 预热再 import app；pytest 输出被日志淹没须 grep 结果行。
- ⚠️ **CRLF 文件禁用 Edit 直改**：backend 大量 .py 为 CRLF，Edit 工具会把整文件规范成 LF → 全文件噪音 diff（已发生 2 次）。改 CRLF 文件须用 python 二进制读改写（继承 \r\n）；改完 `git diff --stat` 若行数≈全删全加即翻 EOL，立即恢复。bytes 正则 `re.M` 下 `.*$` 会吃掉行尾 CR → 锚含 `\r` 时 `rstrip(b'\r')`。
- ⚠️ **EOL 判据正解＝字节计数，勿信 `grep -c $'\r'`**：Git Bash 下 `grep -c $'\r'` 会假阳性匹配所有行（曾把纯 LF 的 firmware_routes.py 报成 CRLF=743=总行数）。正解：`io.open(p,'rb')` 后 `b.count(b"\r\n")` / `b.count(b"\n")-crlf` 判型，并与 `git show HEAD:<file>` 字节对比。**部分 backend .py 实为 LF**（firmware_routes / nlp_enhanced_service 等），务必逐文件判，勿一刀切。
- ⚠️ **ruff 无 `[tool.ruff]` 配置**（仅 `[tool.black] line-length=100`）→ ruff 用**默认 ll=88**。SIM102/UP032 等「折行类」自动修受 `line-length` 门控：折叠后单行 >ll 即拒绝修（`--diff` 只见部分，曾 5/33）。需全量折叠用 `--line-length 1000` 再折行回 ≤100。
- ⚠️ **black 保留文件原 EOL**（实测 CRLF 309→309），但**非 black-clean 文件会被顺带重排无关行** → 只对 black-clean 文件跑 black（`black --check` 先探）。本次 19 文件仅 13 个 clean。
- ⚠️ **`%`→f-string 批量转换须双守卫**：①AST 全扫「非 f 字符串含 `{identifier` 占位」（曾漏 `f` 前缀致输出字面量：`services/report_summary_service.py:139`，回归闸门未含该用例而漏网）；②内容级测试断言（勿只验结构）。

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
