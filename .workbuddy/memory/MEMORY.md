# 管理平台设计 — 长期记忆

> 详细 SOP 已下沉 `~/.workbuddy/skills/`：`backend-pytest-env-restore` / `black-batch-eol-safe` / `dirty-worktree-commit-split` / `frontend-dead-code-removal` / `frontend-import-barrel-unification` / `route-try-except-to-decorator` / `vitest-crash-triage`。本文只留**硬规则与判据**，过程细节看 `memory/YYYY-MM-DD.md`。

## 运行 / 测试
- 后端起：系统 Py3.11 `C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`，`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`。⚠️ 改后端须**强杀全部 python 再重启**（SocketIO 不 reload）。MQTT 改 `app/service_init.py::init_mqtt`。
- ⚠️ **pytest / run_regression 必须用 `apps/backend/.venv/Scripts/python.exe`**：系统 Py3.11 缺 werkzeug/flask_sqlalchemy → 假报 `url_quote ImportError`。正解 `PYTHON_BIN="<repo>/apps/backend/.venv/Scripts/python.exe" bash scripts/run_regression.sh`。判据：`test_` 改动数=0 时 import 错必是环境。基线 2026-09-05：**2066 passed / 7 skipped / 0 failed**。
- 前端闸门（managed Node 22.22.2；⚠️ 勿用 `node_modules/.bin/*`——bash 包装会被当 JS 执行）：`tsc --noEmit`→`typescript/bin/tsc`；`eslint src`→`eslint/bin/eslint.js`；`prettier --check`→**bin-prettier.js**；`vitest run`→`vitest/vitest.mjs`（**全量勿加 `--pool=forks`**）。
- ⚠️ **单测三要素（缺一不可）**：① 退出码=0；② 无 `Errors`/`failed`；③ **报告文件数 == 磁盘文件数**（`grep -oE 'src/[^ ]+\.test\.[a-z]+'` 与 `find src -name '*.test.*'` 做 `comm -13` 为空）。崩溃 worker 的文件会静默消失 → "全绿"假象。基线：38 文件 / **276 passed / 3 skipped**。
- ⚠️ 推送核实 `git ls-remote origin refs/heads/main`，勿信 `git status -sb`（远端 ref 仅存 packed-refs 且陈旧）。禁 commit 除非用户显式要求；push 走 `origin`。
- ⚠️ node 脚本勿用 `/tmp/...`（Git Bash 与 node 解析不一致 → MODULE_NOT_FOUND）；一律 `C:/Users/<u>/AppData/Local/Temp/...`。

## 前端类型 / 结构规范
- **`tsconfig.json` 全量严格（2026-09-11）：`"strict": true` + `"noImplicitOverride": true`**（原逐项 flag 已删）。新代码 `tsc --noEmit` 必须 0 错误；**禁新增 `any`**；可空/可选显式处理（仅「保持原运行时值不变」处用 `as`，禁 `!` 批量绕过）。
  - ⚠️ **容器签名铁律**：接收「任意组件」的参数写 `React.ComponentType`（默认泛型 `{}`），**禁写 `ComponentType<unknown>`** —— 泛型在 props **逆变位**，`unknown` 不能赋给页面 `{}`。**判据：只有显式标注 `React.FC` 的组件报错 ⇒ 根因在容器。**
  - ❌ **明确不推**（会改运行时语义）：`noUncheckedIndexedAccess`(133) / `exactOptionalPropertyTypes`(157) / `noPropertyAccessFromIndexSignature`(187)。`noUnusedLocals`(13)/`noUnusedParameters`(7) 与 eslint `no-unused-vars` 重叠 → 走 eslint 而非 tsc。
  - **每格先 `tsc --noEmit --<flag>` 单独量化再决定**（#112 实测代价 100% 在 `strictFunctionTypes`(18)，其余 5 格全 0）。
- ⚠️ `@types/react-dom` 是**显式 devDependency**（2026-09-11 补）：缺失时 `react-dom/client` 隐式 any（TS7016）。**改 `package.json` 后必须 `npm install` 同步 lockfile**（本仓 lock 曾与 package.json 脱节 → `npm ci` 失败）。
- **导入一律走 barrel**（见 skill）：hooks→`'.../hooks'`；components→`'.../components'`（**双层**：根聚合 9 子 barrel）。新增子目录**必须建 `index.ts` 并在根 barrel 聚合**；子 barrel 转发**必须按真实导出形式**，不可统一 `default as X`。
- ⚠️ **批量改 import 脚本铁律**：① 匹配须含**已有 barrel import**；② 替换段**只吃匹配语句本身**，禁 `raw[:a]+raw[b:]`（会吞中间 import → TS2304）；③ 先 dry-run；④ 动态 `import()` 单独扫。⚠️ **误删恢复**：**不用 `git checkout`**（丢未提交改动）→ **以 tsc 报错名（TS2304/TS2552）为权威** → 全仓导出索引回退。
- ⚠️ **`.map()` 回调返回对象字面量时上下文类型可能不生效** → 空数组属性推断 `any[]`（TS7018）且**多余属性查不出**；加显式返回类型标注可同时暴露两类问题。
- **Context 渲染铁律**：provider `value={{...}}` 内联对象每次渲染新建 → 消费者强制重渲染。新 context 必须 `useMemo` value；含函数先 `useCallback`（会新报 missing-dep，需补 deps）。
- **DataTable 虚拟化** `virtualThreshold` **默认 200** → 本地分页大列表已自动虚拟化，**无需**逐页传；受控（服务端分页）单页不虚拟化。
- 前端 `src` 全 LF；`.prettierrc` = 100 / singleQuote / semi / jsxSingleQuote / **endOfLine:"lf"** → prettier 零 EOL 翻转（批前仍须 `--list-different` 量化）。
- hook 复用优先（勿新造）：`useStableToast`/`useSubmitGuard`/`useForm`/`useListFetch`/`useListData`/`useWorkbenchClass`/`useDebouncedValue`/`useModal`/`usePermissions`。

## 后端架构铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **提取/重构必跑回归**：后端 `run_regression.sh` + 被改模块补 pytest；前端 tsc+eslint+vitest。**未跑回归 = 重构未完成**。
- ⚠️ 新建后端工具前先 Glob 确认不存在（excel_utils / query_optimizer 曾误覆盖）。
- ✅ 已收口（勿再排期）：F17 防腐层 · B3 `to_dict(fields=None)` 五实体 · E 系 E1–E6 · E4 broad-except 566→425 · NLP 四塔 P0–P1 · components/hooks barrel。
- 重构范式：**E6a**（`columns.tsx` 工厂 / `useXxxLogic.tsx` 薄装配 / `XxxView.tsx`）· **D2 视图拆分**（主渲染 >150 行 → 抽 View + 显式 props）。坑：hook 含 JSX 必须 `.tsx`；interface/const 搬 `types.ts` 要 `export`；早退分支与 columns 图标留在逻辑层；复合类型用 `ReturnType<typeof useXxx>`。
- **忠实度验证**：`git show HEAD:<file>` vs 新文件，**括号配平**抽取完整语句后 strip 缩进/空行/注释逐行 diff（按 `\n  );` 简易截断遇嵌套括号必错位 → 假 DIFF）。
- 派 subagent 前**必须先用脚本核对文件真实存在**（曾因臆测致 21/29 路径不存在白跑）。

## 分页 / top-N（`backend/utils/pagination.py`）
- 翻页型 `get_pagination(default=20, max_per_page=200)` → `(page, per_page)`；top-N 型（排行榜/导出/最近）`get_limit(default=50, max_limit=200)`，**恒不引入 page**。
- ⚠️ `/rank/student`、`/rank/class` 保持 limit 语义；任何喂 ORM `.limit()` 的 request 参数**必须钳制**。导出上限 **10000**。M9 已闭环（班级 13 端点 + `wol/devices` + `devices/online`）。

## RBAC / 双 JWT / db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`（G2 68 / DB 70 / seed 66 / teacher 30）；teacher 含 `notification.send`、无 `score.manage`；`/api/roles` 已下线。
- ✅ **班级归属隔离已内置 `requires_permission`**（`utils/permission.py:212` → `_check_class_scope`）：对 `_CLASS_SCOPE_PREFIXES` 12 词根（committee/duty/seating/parent/homework/attendance/study_group/mental_health/activity/culture/study_guide/comment）自动 `ensure_class_access`/`ensure_student_access` → 403。**新增班级模块必须加词根**。`ALL_CLASSES=0` 哨兵放行（判 `if not class_id`）。冒烟 `tests/test_workbench_isolation_smoke.py`。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径须 `detach=False`**，否则 DetachedInstanceError。
- 前端：菜单 == 路由守卫 == 后端域权限三方一致；前端只 gate `view` 级。

## 关键坑
- MQTT 双连接（控制 QoS1 / 遥测 QoS0）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)` → `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` **不切** `.env.development`；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"` 否则 404。
- sandbox torch 段错误：主线程先 `import services.nlp_ml_service` 预热再 import app。
- ⚠️ **EOL 铁律**（见 skill `black-batch-eol-safe`）：backend 大量 `.py` 为 CRLF，**禁 Edit 直改**（整文件转 LF → 噪音 diff）；须 python 二进制读改写。**判据 = 字节计数**（`b.count(b"\r\n")`），勿信 `grep -c $'\r'`；**逐文件判**。
- ⚠️ **ruff 用默认 ll=88**（仅 black 是 100）→ 折行类自动修受门控；**black 仅对 `--check` 已过的文件跑**（否则重排无关行）。
- ⚠️ **`%` → f-string 批量转换须双守卫**：① AST 全扫「非 f 字符串含 `{identifier` 占位」；② 内容级测试断言。

## 业务模块
- **NLP**（✅ 2026-08-29）：链路 `api/nlp/nlp_routes.py::_get_parser()` → `services/nlp_enhanced_service.get_nlp_parser()`；torch 懒加载。G5 OpenAPI 469 零漂移。
- **班主任工作台**（✅ 全闭环 2026-09-11）：`useWorkbenchClass`（store + `useSyncExternalStore`，12 子页共享班级）；评语 `TeacherComment` → `/api/teacher-comments`。4 硬要求：字段命名统一 / 权限体系 / **字段·权限·业务变更须用户审核** / 优化交互。聚合首页已落地（`/workbench` → `WorkbenchOverview`；`ENTRIES` 13 + `GLOBAL_ENTRIES` 4）。**无待办。**

## ⚠️ 审计文档引用铁律（2026-09-11）
- 引用 `docs/` 历史审计文档前**必须实测复核**——生成日期 ≠ 当前状态（曾因采信 08-29 文档 + grep **行号**而错报）。
- **grep 权限词根必须带 `-A3` 并核对所属路由**，前端 `requiredPermission` ↔ 后端 `@requires_permission("X")` 逐路由比对。
- **判「某属性无消费者」须按类型归属逐一核对**（`grep "\.rule_id"` 命中 8 处分属 `Suggestion`/`MatchedRule`/误加者）。
- `班主任工作台优化方案-待审核.md` / `班主任页拆分方案-铁律③待审.md` / `M9分页复核-缺口清单.md` 已加顶部状态横幅（勿再按待办引用）。

## 工具链避坑
- ⚠️ **Edit 对同一文件多次编辑放同一并行批次会静默丢写**（报 success 未落盘）→ **同文件多次编辑必须串行 + 回读核验**。
- ⚠️ **`&&` 链断会致假绿**（前段 exit≠0 跳过后段仍读到旧值）→ 校验段用 `;` 并复核原始输出。
- A 轨列表钩子迁移（细节见 `memory/2026-09-05.md`）：服务端分页 → `useListFetch`；全量下拉 → `useListData`（`data` 恒数组）。已迁 13 页。
