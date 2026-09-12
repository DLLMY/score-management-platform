# 管理平台设计 — 长期记忆

> SOP 已下沉 `~/.workbuddy/skills/`：backend-pytest-env-restore · black-batch-eol-safe · c901-cyclomatic-refactor · dirty-worktree-commit-split · frontend-dead-code-removal · frontend-import-barrel-unification · route-try-except-to-decorator · ts-noimplicitany-enable。细节看 `memory/YYYY-MM-DD.md`。

## 运行 / 测试（口径固定）
- 后端起：系统 Py3.11；`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`。改后端须**强杀全部 python 再重启**（SocketIO 不 reload）；MQTT 在 `app/service_init.py::init_mqtt`。
- ⚠️ pytest / run_regression **必须** `apps/backend/.venv/Scripts/python.exe`（系统 Py3.11 缺 werkzeug → 假 `url_quote ImportError`）。
- ⚠️ **全量 `pytest tests`（串行）基线（2026-09-12 更新）＝ 2084 passed / 7 skipped / 0 failed**。原 6 项预存在失败已于 `67f6fd3` 全修（`is_strong_password` 返 Match→`is not None`；`CachedQueries.invalidate_*` 迭代不可迭代对象→`list(cm.keys())`；`test_ota_failed_statuses_mapped`/`test_export_has_class_scope` 系 C901 抽取后滞后的源码文本断言→升级为对象级/helper 级断言）。**判回归：失败项必须为 0**（非空即须逐项定因）。
  - ⚠️ **C901 抽取后须复扫源码文本类测试**：`inspect.getsource(...)` 断言 `"字符串" in src` 会被搬家的 helper/类常量**静默破坏**，表现为全量多出「预存在失败」。判据：`git log -S "<字符串>" -- <src>` vs `git log -- <test>` 先后；正解=升级为对象级/helper 级断言（更强，防「表存在却未被用」）。详见 skill `c901-cyclomatic-refactor` §9。
  - 全量**勿用 `-n 4` xdist**（额外挂 2 个 nlp_performance 假失败）。串行 ~22min；PowerShell 10min 上限 → 按文件名均分 **3 批**（55/55/55）。
- 前端四闸门用 managed Node 22.22.2，**勿用 `node_modules/.bin/*`**：tsc→`typescript/bin/tsc`；eslint→`eslint/bin/eslint.js`；prettier→`prettier/bin-prettier.js`（⚠️ 不是 `node_modules/bin-prettier.js`，2026-09-12 实测 MODULE_NOT_FOUND）；vitest→`vitest/vitest.mjs`（全量勿加 `--pool=forks`）。基线 38 文件 / 276 passed / 3 skipped。
- ⚠️ 单测三要素：①退出码=0 ②无 `Errors`/`failed` ③**报告文件数==磁盘文件数**。
- ⚠️ push 后核实 `git ls-remote origin refs/heads/main`。**禁 commit 除非用户显式要求**（C901 收口批次已授权自动 push）。

## ruff 口径
- 唯一口径 = `ruff check apps/backend`（含 tests/scripts/tools/migrations）；C901 同口径加 `--select C901`。ruff 二进制 `C:/Users/53527/AppData/Local/Programs/Python/Python311/Scripts/ruff`。
- **当前基线（2026-09-12，#131 收口后）：默认 2259 / C901 46**。口径变了必须重测。
- ⚠️ run_regression.sh 被沙箱拦（`E_ACCESSDENIED`）→ 用 PowerShell 直跑 5 闸门（venv python）：RBAC `verify_rbac_consistency.py --check-only`(G2 68/DB 70/seed 66/teacher 30) / OpenAPI `--strict`(EXIT=2=后端未起跳过) / `pytest tests/test_api_envelope.py`(2) / 四路由 pytest(33) / `scripts/verify_indexes.py`([OK])。
- ⚠️ 回归日志含 null 字节 → 用 `[System.IO.File]::ReadAllBytes` 剔 `\0` 再 UTF8；结果文件用 `Out-File -Encoding utf8` 写。
- ruff 默认 `ll=88`（black 是 100）；black 只对 `--check` 已过的文件跑。

## C901「机械收口」进展与类别
- 已收口 #119(2)+#120(1)+#121(2)+#122(2)+#123(1)+#124(1)+#125(1)+#126(2) ＝ 12 个函数，C901 **58 → 46**。剩余 **46 项**全属写路径/DB 事务、NLP 语义、安全 RBAC、测试脚本工具——**动前须用户逐项拍板**（宁跳不强推）。
- ✅ 可安全收口类别①：**注册/初始化型函数**（如 `init_scheduler` c=11→2）。手法＝保留嵌套 def 与注册语句原样，闭包体逐字搬到模块级 helper（捕获变量改显式参数）。同类候选 `init_cache_warmup`、`_try_auto_start_redis`(14)、`start_celery.main`(12)。harness：闭包内 `from x import y` 须 `sys.modules` 注入假模块；`exec` 出的函数 `__globals__` 绑定 exec 字典，stub 须写回同一 dict。
- ✅ 可安全收口类别②：**纯序列化/导出构建型函数**（如 `export_routes.ExportErrors.post` c=12→0）。手法＝抽模块级 helper，函数内 `from openpyxl import...` 仍以形参传入（不改启动期 import 行为）。
- ⚠️ 差分 harness 三坑（#124 实测，已沉淀 skill）：① 注入 `datetime` 须注入**类** `datetime.datetime` 而非模块；② 同文件多 `def post` 须按函数体 marker 定位，勿取 `next(def post)`；③ `column_dimensions` 用 `defaultdict` 复现按需建 Dimension，否则宽度对比被 KeyError 绕过。**harness 必先自检真实路径被走到**。

## 后端铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **未跑回归 = 重构未完成**。新建工具前先 Glob 确认不存在。
- ✅ 已收口勿再排期：F17 防腐层 · B3 `to_dict(fields=None)` · E 系 E1–E6 · E4 broad-except 566→425 · NLP 四塔 P0–P1 · components/hooks barrel。
- `api/` 裸 `except Exception` 收敛 `@safe_handle`：已收 **18 处**（#128 `fe965a3` 7；#129 `03ea4b3` 4 并加 `error_code=None` 尾置默认参透传；#130 `f9dbb7d` 6 处 export GET，**用户批准 pre 含 DB 类的 message 契约差异**；#131 `mqtt_routes.MQTTConnect.post` 1）。**✅ 该线已正式收官（2026-09-12）**：二阶 AST 扫描 13 项候选逐项分类后**仅 1 项可收敛**，12 项硬拒 —— 裸 dict 兜底 5（`remote_notify_routes` 返回非信封字典）、handler 带 `data=` 2（`import_export_routes.ImportRules/ImportCategories`，`if data:` 取值敏感）、pre 含副作用 1（`firmware_routes` 的 `ensure_upload_folder()` 建目录）、pre 含 DB＋f-string 泄漏 2、非整方法体 try 1（`notify_template_routes.TemplateUse.post`：try 只包尾部 publish+落库、pre 含 `query.get_or_404`，收敛会令 status 500↔400 与 message 双漂移）、pre 含 DB＋HTTPException 1。手法全在 skill `route-try-except-to-decorator`（判据要点：handler 复现性必须查「是否返回信封」与 `data=` 参数；pre 含副作用调用一律硬拒；`APIResponse.error` 默认 **400** 而 `safe_handle` 默认 **500**，对齐须显式传；`ast.unparse` 输出单引号，断言勿用双引号整串）。
- 前端重构范式 E6a/D2：hook 含 JSX 必 `.tsx`；搬 `types.ts` 的 interface/const 要 `export`；复合类型 `ReturnType<typeof useXxx>`。派 subagent 前先脚本核对文件真实存在。

## 前端类型规范
- tsconfig 严格档全收口：`strict`+`noImplicitOverride`+`noUnusedLocals`+`noUnusedParameters`；**禁新增 `any`**；仅「保持原运行时值」用 `as`，禁 `!` 批量绕过。
- 容器接收「任意组件」写 `React.ComponentType`，**禁 `ComponentType<unknown>`**。未用公共方法/回调形参**加 `_` 前缀勿删**。不推：`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`noPropertyAccessFromIndexSignature`。
- **导入一律走 barrel**（hook/components 双层）；新增子目录必须建 `index.ts` 并在根 barrel 聚合。
- Context provider `value` 必须 `useMemo`（含函数先 `useCallback`）。前端 `src` 全 LF；prettier 100/singleQuote/semi/jsxSingleQuote/`endOfLine:"lf"`。
- hook 复用优先：`useStableToast`/`useSubmitGuard`/`useForm`/`useListFetch`/`useListData`/`useWorkbenchClass`/`useDebouncedValue`/`useModal`/`usePermissions`。A 轨：服务端分页→`useListFetch`；全量下拉→`useListData`。

## T12 巨型页拆分（2026-09-12 立档，待用户审阅后开工）
- 方案：`docs/T12-巨型页拆分方案-20260912.md`。判据＝**单文件行数**（**不是**目录总行数）；`pages/` 下 >600 行共 24 个，其中 ≥850 行 9 个（P0）。
- **既有范式（第一轮已完成，勿重复劳动）**：`pages/Xxx.tsx` 装配层（hook→View props 装配）+ `pages/xxx/` 实现目录。`App.tsx` 用 `createLazyComponent(() => import('./pages/Xxx'))` → **入口壳路径不可改**。
- 三种拆法：**A** 展示组件按 Panel 切（最低风险，先做 —— `analysis/AnalysisSections.tsx` 已含 9 个自包含 Panel，拆后原文件退化为 re-export 兼容层，入口壳零改动）；**B** 巨型 View 按区块切；**C** god hook 按域切（风险最高，最后做）。
- 批次：T12-1 `analysis`+`opsCenter` → T12-2 `scoreAnalysis` → T12-3 `ClassManagement.tsx`（**未拆的 691 行单文件**）→ T12-4 `courseSchedule`+`subjectManagement` → T12-5 `permissionManagement` → … → T12-7 起 god hook。
- 不拆：<600 行单文件页（10 个）、`services/api.ts`(6436)/`types/index.ts`(1612)（属全局基础设施，独立立项）。

## 分页 / top-N（`utils/pagination.py`）
- 翻页 `get_pagination(default=20,max_per_page=200)`；top-N `get_limit(default=50,max_limit=200)`，**恒不引入 page**。`/rank/student`、`/rank/class` 保持 limit；ORM `.limit()` 参数须钳制；导出上限 10000。M9 已闭环。

## RBAC / db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`（G2 68/DB 70/seed 66/teacher 30）；teacher 含 `notification.send`、无 `score.manage`；`/api/roles` 已下线。
- 班级隔离内置 `requires_permission`：`_CLASS_SCOPE_PREFIXES` 12 词根自动 `ensure_class_access`/`ensure_student_access`→403。**新增班级模块必须加词根**。`ALL_CLASSES=0` 哨兵放行。冒烟 `tests/test_workbench_isolation_smoke.py`。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径须 `detach=False`**，否则 DetachedInstanceError。前端：菜单==路由守卫==后端域权限三方一致，只 gate `view` 级。

## 关键坑
- MQTT 双连接（控制 QoS1/遥测 QoS0）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)` → `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` **不切** `.env.development`；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"` 否则 404。
- sandbox torch 段错误：主线程先 `import services.nlp_ml_service` 预热再 import app。
- ⚠️ **EOL 铁律**：backend 大量 `.py` 为 CRLF，**禁 Edit 直改**，须 python 二进制读改写。判据 `b.count(b"\r\n")` 字节计数，逐文件判（`phonebox_policy.py` 纯 LF）。

## 工具链避坑（通用）
- ⚠️ **Edit 同文件多次编辑放同一并行批次会静默丢写** → 串行+回读核验，或带「命中==1」断言的 python 脚本。
- ⚠️ **`&&` 链断致假绿** → 校验段用 `;` 并 `echo "EXIT=$?"`。
- ⚠️ **快照 diff 前先证确定性**：含 `list(set(...))` 先自证「同码两次不同」再 pin `PYTHONHASHSEED=0`；`datetime.now()` 正则抹平。
- ⚠️ **harness 必须先自检**（断言必然成立的期望值），否则所有用例退化 diff 仍「一致」。
- ✅ C901 抽取细则（二进制保行尾、按行号切片、dedent 公式、I001、RUF059、class 中间禁插顶层 def、差分法等）**全在 skill `c901-cyclomatic-refactor`**，别凭记忆。

## 审计文档引用铁律
- 引用 `docs/` 历史审计文档前**必须实测复核**。**grep 权限词根带 `-A3`**，前端 `requiredPermission` ↔ 后端 `@requires_permission` 逐路由比对。判「属性无消费者」须按类型归属逐一核对。

## 业务模块
- **NLP**：`api/nlp/nlp_routes.py::_get_parser()` → `services/nlp_enhanced_service.get_nlp_parser()`；torch 懒加载。G5 OpenAPI 469 零漂移。
- **班主任工作台**（✅ 全闭环 2026-09-11）：`useWorkbenchClass`（store+`useSyncExternalStore`，12 子页共享班级）；评语 `TeacherComment` → `/api/teacher-comments`。聚合首页 `/workbench`→`WorkbenchOverview`。无待办。
- **OTA/手机箱**：`services/ota_negotiation_service.py`（协商+自动推送+灰度+静默时段+HMAC 签名）；`api/devices/firmware_routes.py`；固件 `apps/firmware/esp32/phonebox/phonebox.ino` 三子模块（类型上报/订阅/验签）已实装。⚠️ **唯一真实缺口 = 多设备类型隔离**：`FirmwareVersion` 无 `device_type` 维度、`negotiate()`/`/ota/check` 取全局最新 active → doorlock 接入会被误推 phonebox 固件。方案见 `docs/特性任务优化方案-20260912.md`（F1 五阶段：模型/协商/路由/固件/前端）。
- ⚠️ **过时文档清单（引用前必复核，勿当待办）**：`docs/下一步开发计划-20260824.md` 的 T7/T8/T10/T11 实测已闭环；`docs/班主任工作台优化方案-待审核.md` 的 P3 A 批（P3-2/3/4/5/6/7）实测已闭环（仅 P3-1 PageHeader 抽取、P3-8 总览卡补全未做）。
