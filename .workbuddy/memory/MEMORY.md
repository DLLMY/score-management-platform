# 管理平台设计 — 长期记忆

> 详细 SOP 已下沉到 `~/.workbuddy/skills/`：`backend-pytest-env-restore` / `black-batch-eol-safe` / `dirty-worktree-commit-split` / `frontend-dead-code-removal` / `frontend-import-barrel-unification` / `route-try-except-to-decorator` / `vitest-crash-triage`。本文只留**硬规则与判据**，过程细节看当日 `memory/YYYY-MM-DD.md`。

## 运行 / 测试
- 后端启动：系统 Py3.11 `C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`，`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`。⚠️ 改后端须**强杀全部 python 再重启**（Flask-SocketIO 不 reload）。MQTT 改 `app/service_init.py::init_mqtt`。
- ⚠️ **后端 pytest / run_regression 必须用 `apps/backend/.venv/Scripts/python.exe`**：系统 Py3.11 缺 werkzeug/flask_sqlalchemy → 假报 `url_quote ImportError` 与 `No module named flask_sqlalchemy`（33 errors）。正解 `PYTHON_BIN="<repo>/apps/backend/.venv/Scripts/python.exe" bash scripts/run_regression.sh`。判据：`git status` 中 `test_` 改动数=0 时 pytest import 错必是环境而非回归。基线 2026-09-05：**2066 passed / 7 skipped / 0 failed**（15–21min）。
- 前端闸门（managed Node 22.22.2；⚠️ 勿用 `node_modules/.bin/*`——是 bash 包装会被当 JS 执行）：
  - `tsc --noEmit` → `node_modules/typescript/bin/tsc`
  - `eslint src --ext .ts,.tsx,.js,.jsx` → `node_modules/eslint/bin/eslint.js`
  - `prettier --check "src/**/*.{ts,tsx}"` → 入口是 **bin-prettier.js**
  - `vitest run` → `node_modules/vitest/vitest.mjs`；**全量勿加 `--pool=forks`**（config 按 CI 自动选池；Windows+中文路径 forks 慢且吃内存）
- ⚠️ **单测闸门三要素（缺一不可）**：① 退出码存在且为 0；② 无 `Errors`/`failed`；③ **报告文件数 == 磁盘文件数**（剥 ANSI 后 `grep -oE 'src/[^ ]+\.test\.[a-z]+'` 与 `find src -name '*.test.*'` 做 `comm -13` 差集为空）。崩溃 worker 所跑文件会静默从统计消失，造成"全绿"假象。基线：38 文件 / **276 passed / 3 skipped**。
- ⚠️ **推送核实用 `git ls-remote origin refs/heads/main`**，勿信本地 `git status -sb`（`.git/refs/remotes/origin/main` 目录不存在，该 ref 仅存 packed-refs 且常陈旧）。
- 禁 git commit 除非用户显式要求；push 走 `origin`（`ssh://git@ssh.github.com:443/DLLMY/score-management-platform.git`）。
- ⚠️ node `-e` / require 脚本勿用 `/tmp/...`（Git Bash 与 node 解析不一致，报 MODULE_NOT_FOUND）；一律写 `C:/Users/<u>/AppData/Local/Temp/...`。

## 前端类型 / 结构规范
- **`tsconfig.json`：`strict:false` + `noImplicitAny:true`（2026-09-11 #109 开启）**。新代码必须类型干净（`tsc --noEmit` 必须 0 错误）；**禁新增 `any`**。
- ⚠️ `@types/react-dom`（`^18.3.7`）是**显式 devDependency**（2026-09-11 补）：缺失时 `react-dom/client` 隐式 any（TS7016），过去仅因 `noImplicitAny:false` 而静默。**改 `package.json` 依赖后必须跑 `npm install` 同步 `package-lock.json`**（本仓 lockfile 曾长期与 package.json 脱节：残留 `web-vitals`/`eslint-config-react-app` → `npm ci` 会失败）。
- **导入一律走 barrel**：hooks → `'.../hooks'`（`index.ts` 必须覆盖全部 hook 模块**及其类型**）；components → `'.../components'`（**双层 barrel**：根从 9 个子 barrel 聚合 ui/data-display/feedback/form/layout/image/lazy/special/workbench）。**新增子目录必须建 `index.ts` 并在根 barrel 同步聚合**；依赖重的子目录（charts/recharts）保留独立子入口。子 barrel 转发**必须按文件真实导出形式**（default vs 命名），不可统一写 `default as X`。
- ⚠️ **批量改 import 脚本铁律**：① 匹配条件须同时含**已有 barrel import**；② 替换段**只吃匹配语句本身**，绝不能用 `raw[:a]+raw[b:]` 跨越删除（会吃掉中间所有其他 import → tsc 爆 TS2304）；③ 先 dry-run；④ 动态 `import()` 用 `grep "from '"` 查不到，须单独扫 `import\(`。
- ⚠️ **脚本误删代码恢复 SOP**：**不以 `git checkout` 救**（丢其它未提交改动）→ **以 tsc 报错名（TS2304/TS2552）为权威判据**（HEAD 导入集差集因 HEAD 早于重构会大量误报）→ 全仓导出索引回退 + HEAD import 映射优先 → 修完四项横向体检（路径可解析 / 副作用 import 未丢 / 正文引用逐条核实）。
- ⚠️ **`.map()` 回调返回对象字面量时上下文类型可能不生效** → 空数组属性被推断 `any[]`（TS7018）且**多余属性查不出来**；加显式返回类型标注（`(s): T => ({...})`）可同时暴露这两类问题。
- **Context 渲染铁律**：provider `value={{...}}` 内联对象每次渲染新建 → 全部消费者强制重渲染。新增 context 必须 `useMemo` value；含函数须先 `useCallback` 稳定化。⚠️ 对 useCallback 化函数，exhaustive-deps 会新报 missing-dep，需补 deps。
- **DataTable 内置虚拟化** `virtualThreshold` **默认值就是 200** → 本地分页大列表已自动虚拟化，**无需**逐页显式传；受控（服务端分页）单页小数据不虚拟化。
- 前端 `src` 385 文件**全 LF**；`.prettierrc` = printWidth 100 / singleQuote / semi / jsxSingleQuote / **endOfLine:"lf"** → prettier 零 EOL 翻转，可直接批量（批前仍须 `--list-different` 量化 + 全 diff「去空白后比对」鉴定纯格式）。
- hook 复用优先（勿新造）：`useStableToast` / `useSubmitGuard` / `useForm` / `useListFetch` / `useListData` / `useWorkbenchClass` / `useDebouncedValue` / `useModal` / `usePermissions`。

## 后端架构铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **提取 / 重构必跑回归**：后端 `run_regression.sh` + 被改模块补 pytest；前端 tsc + eslint + vitest。**未跑回归 = 重构未完成**。
- ⚠️ 新建后端工具前先 Glob 确认不存在（excel_utils / query_optimizer 曾误覆盖）。
- ✅ 已收口（勿再排期）：F17 防腐层（2026-08-30）· B3 `to_dict(fields=None)` 五实体（`User/ScoreRecord/ScoreRule/Admin/ScoreRankRule`，2026-09-06）· E 系债项 E1–E6 · E4 broad-except 566→425（余者皆合理 fail-safe/re-raise）· NLP 四塔 P0–P1 · components/hooks barrel（#105/#106）。
- 重构范式：**E6a**（`columns.tsx` 工厂 / `useXxxLogic.tsx` 薄装配 / `XxxView.tsx`）· **D2 视图层拆分**（主渲染 >150 行 → 抽 View + 显式 props；已有 XxxView → 直接抽 hook）。坑：hook 含 JSX 必须 `.tsx`；同文件 interface/const 搬 `types.ts` 要加 `export`；早退分支与 columns 用到的图标导入留在逻辑层；复合类型用 `ReturnType<typeof useXxx>` 别手造签名。
- **忠实度验证标准动作**：`git show HEAD:<file>` vs 新文件，**括号配平**抽取完整语句后 strip 缩进/空行/注释逐行 diff（按 `\n  );` 简易截断遇嵌套括号必错位 → 大量假 DIFF）。
- 派 subagent 前**必须先用脚本核对文件真实存在**（曾因文件名臆测致 21/29 路径不存在白跑）。

## 分页 / top-N 规范（`backend/utils/pagination.py`）
- 翻页型 `get_pagination(default=20, max_per_page=200)` → `(page, per_page)`，上限 200、非法回退 default。
- top-N 型（排行榜 / 导出 / 最近）`get_limit(default=50, max_limit=200)`，**恒不引入 page**。
- ⚠️ 排行榜 `/rank/student`、`/rank/class` 保持 limit 语义；任何喂 ORM `.limit()` 的 request 参数**必须钳制**。导出上限 **10000**。
- M9 已全闭环：班级管理 13 端点 + `wol/devices`（`wol_routes.py:345`）+ `devices/online`（`devices_routes.py:405`）均带 `get_pagination` + 切片。

## RBAC / 双 JWT / db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`（G2 68 / DB 70 / seed 66 / teacher 30）；teacher 含 `notification.send`、无 `score.manage`；`/api/roles` 已下线。Admin = access + `requires_permission`；学生 = student + `requires_student`。
- ✅ **班级归属隔离已内置在 `requires_permission`**（`utils/permission.py:212` → `_check_class_scope`）：对 `_CLASS_SCOPE_PREFIXES` 12 个词根（committee / duty / seating / parent / homework / attendance / study_group / mental_health / activity / culture / study_guide / comment）自动 `ensure_class_access` / `ensure_student_access` → 越权 403。**新增班级管理模块必须把词根加入该列表**，否则隔离失效。`ALL_CLASSES=0` 哨兵须放行（判 `if not class_id`，非 `is None`）。冒烟 `tests/test_workbench_isolation_smoke.py`（12 passed）。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径须 `detach=False`**，否则 DetachedInstanceError 500。
- 前端：菜单 == 路由守卫 == 后端域权限三方一致；前端只 gate `view` 级，写权限由后端 enforce。

## 关键坑
- MQTT 双连接（控制 QoS1 / 遥测 QoS0）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)` → `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` **不切** `.env.development`；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"`（连字符）否则 404。
- sandbox torch 段错误：主线程先 `import services.nlp_ml_service` 预热再 import app；pytest 输出被日志淹没须 grep 结果行。
- ⚠️ **CRLF 文件禁用 Edit 直改**：backend 大量 `.py` 为 CRLF，Edit 会把整文件规范成 LF → 全文件噪音 diff（已发生 2 次）。改 CRLF 文件须 python 二进制读改写。**EOL 判据 = 字节计数**（`io.open(p,'rb')` 的 `b.count(b"\r\n")`），勿信 `grep -c $'\r'`（Git Bash 假阳性）；部分 backend `.py` 实为 LF，**逐文件判**。
- ⚠️ **ruff 无 `[tool.ruff]` 配置** → 用默认 line-length 88（仅 `[tool.black] line-length=100`）。SIM102/UP032 等折行类自动修受 ll 门控：折叠后单行 >ll 即拒修，需全量折叠时用 `--line-length 1000` 再折回。
- ⚠️ **black 保留文件原 EOL**（实测 CRLF 309→309），但**非 black-clean 文件会被顺带重排无关行** → 只对 `black --check` 通过的文件跑 black。
- ⚠️ **`%` → f-string 批量转换须双守卫**：① AST 全扫「非 f 字符串含 `{identifier` 占位」（曾漏 `f` 前缀致输出字面量）；② 内容级测试断言（勿只验结构）。

## 业务模块
- **NLP**（✅ P0–P1 全修 2026-08-29）：活跃链路 `api/nlp/nlp_routes.py::_get_parser()` → `services/nlp_enhanced_service.get_nlp_parser()`；`services/nlp_service.py`(FastNLPParser) 仅预热。torch 懒加载（首次 `ml_predict` 才 import）。G5 OpenAPI 路径数 469 零漂移。
- **班主任工作台**（✅ P0/P1/P2 + 三页拆分 **全部闭环**，2026-09-11 实测复核）：`useWorkbenchClass`（store + `useSyncExternalStore`，12 子页共享当前班级、sessionStorage 持久）；评语模型 TeacherComment → `/api/teacher-comments` 权限 `comment.view/edit`。4 条硬要求：字段命名统一 / 权限体系 / **字段调整·权限变更·业务逻辑不确定性须经用户审核** / 优化交互与展示。遗留可选项：12 项条目无聚合首页/概览页（指标卡下钻 C-1/C-2 已落地）。

## ⚠️ 审计文档引用铁律（2026-09-11 教训）
- **引用 `docs/` 下任何历史审计 / 待审文档前，必须先做一次实测复核**——文档生成日期 ≠ 当前状态。曾直接采信 `docs/班主任工作台优化方案-待审核.md`(08-29) + `grep class.view` 的**行号**（未核对行号所属路由），错误输出"P0 权限词根未修 / P1 越权未修"，实际两者早已闭环。
- **grep 权限词根必须带上下文（`-A3` 看 `path=`）**，并把前端 `requiredPermission` 与后端 `@requires_permission("X")` 逐路由对齐比对；只看"某文件出现过 X"完全不可作判据。
- 已给 `班主任工作台优化方案-待审核.md` / `班主任页拆分方案-铁律③待审.md` / `M9分页复核-缺口清单.md` 加顶部状态横幅（已闭环，勿再按待办引用）。

## 工具链避坑（2026-09-11 #109 新增）
- ⚠️ **Edit 工具对同一文件的多次编辑若放在同一并行批次里会静默丢写**（工具报 success 但未落盘；本次 5 处丢失）。→ **同文件多次编辑必须串行**，改完**必须回读核验**（`sed -n 'a,bp'`）。

## A 轨列表钩子迁移 SOP（2026-09-05 固化）
- 选型：服务端**分页**列表 → `useListFetch`（`{items,total,loading,error,refetch,mutate,setItems,setTotal}`）；**全量下拉/选项** → `useListData`（`{data,loading,error,refetch}`，data 恒数组）。
- 底层 `useOptimizedFetch` 有 `enabled`（默认 true）：false 时挂载/deps 变化不自驱请求（并中止在途），手动 refetch 仍可触发——用于模态/切 tab 按需加载；两 hook 均透传。
- 标准迁移六步：① 取证 ② 删手工态 ③ params 声明式注入 ④ 乐观更新 → mutate ⑤ handler 包装 `useCallback` 返回 `Promise<void>` ⑥ 渲染全量映射。
- 适配判定：✅ 纯 reload / 乐观增删 / 伪命令式；❌ **真命令式**（如 `fetchClasses(page,keyword,skipCache,perPage)` 绕后端缓存，需 hook 扩展 skipCache 透传）。
- 踩坑：`fetchJson` 失败返回 null 不抛 → fetcher 内转抛使 error 态可见；列表与表单共享 isLoading 要拆两层；迁移后必跑**全量** vitest。
- 已迁 13 页：FrontendTelemetry / FirmwareManagement / ActivityManage / HomeworkCheck / ParentContact / Notifications / Approvals / RuleList / SemesterReport(useListData) / WakeOnLan / StudentPortal / NLPManagement / RemoteNotify（后 3 处用 `enabled` 按需加载）。
