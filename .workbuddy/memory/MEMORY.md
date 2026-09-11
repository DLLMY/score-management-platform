# 管理平台设计 — 长期记忆

> SOP 已下沉 `~/.workbuddy/skills/`：backend-pytest-env-restore · black-batch-eol-safe · c901-cyclomatic-refactor · dirty-worktree-commit-split · frontend-dead-code-removal · frontend-import-barrel-unification · route-try-except-to-decorator · ts-noimplicitany-enable。本文只留**硬规则与判据**，细节看 `memory/YYYY-MM-DD.md`。

## 运行 / 测试（口径固定，勿再重推）
- 后端起：系统 Py3.11；`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`。改后端须**强杀全部 python 再重启**（SocketIO 不 reload）；MQTT 在 `app/service_init.py::init_mqtt`。
- ⚠️ pytest / run_regression **必须** `apps/backend/.venv/Scripts/python.exe`（系统 Py3.11 缺 werkzeug → 假 `url_quote ImportError`）。判据：`test_` 改动=0 却 import 错 ⇒ 环境问题。
- ⚠️ **全量 `pytest tests`（串行）实测基线（2026-09-12）＝ 2078 passed / 7 skipped / 6 failed，且 6 failed 全为预存在**（用 `git stash push -- apps/backend` 回退后跑同一文件、结果逐字相同，双向实证）：`test_security_core`+`test_security_utils`::`test_is_strong_password`、`test_regression_20260817`::`test_ota_failed_statuses_mapped`+`test_export_has_class_scope`、`test_query_optimizer`::`test_invalidate_user_cache`+`test_invalidate_all_cache`。**判回归：只要失败集合 ⊆ 这 6 个即零回归**；多出任何一项才算引入问题。
  - ⚠️ 全量**勿用 `-n 4` xdist**：会额外挂 2 个 `test_nlp_performance`（warmup 计时/成功率阈值，并行干扰）假失败，表现为 8 failed / 2076 passed。串行约 **22 分钟**；PowerShell 工具单次上限 10 分钟 → 要么分批跑，要么先跑受影响子集再用这 6 项清单比对。
  - ✅ **实测可行的分批法**：`Get-ChildItem tests -Filter "test_*.py" | Sort-Object Name` 后按数量均分 **3 组**（实测 165 个文件 → 55/55/55，各组 4m48s / 6m54s / 5m04s，均 <10 分钟上限），三批求和与串行基数一致（2078 passed / 7 skipped / 6 failed）。分批后**失败集合仍须 ⊆ 上述 6 项清单**。
- 前端四闸门用 managed Node 22.22.2，**勿用 `node_modules/.bin/*`**（bash 包装被当 JS 跑）：tsc→`typescript/bin/tsc`；eslint→`eslint/bin/eslint.js`；prettier→`bin-prettier.js`；vitest→`vitest/vitest.mjs`（全量**勿加** `--pool=forks`）。基线 38 文件 / **276 passed / 3 skipped**。
- ⚠️ 单测三要素：①退出码=0 ②无 `Errors`/`failed` ③**报告文件数==磁盘文件数**（崩溃 worker 的文件会静默消失）。
- ⚠️ push 后核实 `git ls-remote origin refs/heads/main`（`git status -sb` 的远端 ref 会陈旧）。**禁 commit 除非用户显式要求**。

## ruff 口径（2026-09-11 重新校准）
- 唯一口径 = `ruff check apps/backend`（**含 tests/scripts/tools/migrations**）；C901 同口径加 `--select C901`。
- **当前基线（2026-09-12 #119/#120/#121/#122 + #123 init_scheduler 收口后）：默认 2258 / C901 50**。旧记录 2261/67、2259/66、2258/60、2258/58、2258/57、2258/56、2258/55、2258/53、2258/51 均已作废；**口径变了必须重测**，勿沿用旧值。
- ⚠️ **run_regression.sh 被沙箱拦**（报 `Bash/CallMsi/E_ACCESSDENIED`，REG_EXIT=1 但无任何闸门输出）时的兜底：用 PowerShell 直跑其 5 道内部闸门（venv python）——RBAC `verify_rbac_consistency.py --check-only` / OpenAPI `--strict`（EXIT=2=后端未起跳过）/ `pytest tests/test_api_envelope.py`（2 passed）/ 四路由 pytest（33 passed）/ `scripts/verify_indexes.py`（[OK]）。基准：契约 2 + 关键路由 33 + 索引 OK。
- ⚠️ 回归日志常含 null 字节（Read/Grep 判为二进制）→ 用 `[System.IO.File]::ReadAllBytes` 剔除 `\0` 再 UTF8 解码；**结果文件用 `Out-File -Encoding utf8` 或 `WriteAllText`+无 BOM UTF8 写**，否则 Read 报 binary。
- ⚠️ #120（21+ 桶）19 项经全量扫描审定：**仅 `_validate_course_import_item`(22) 为纯校验可机械收口**；其余 18 项全属写路径/DB 事务（users_routes.post 45/25、execute_subject_import 37、import_devices 31、subject_routes.post 23、resolve_relations 22、execute_scoring 21）、NLP 语义（parse 36/extract_behavior 29/parse_without_correction 28/extract_name 26/deep_semantic_match 24/determine_intent 22）、安全（security.validate 35、configure_rate_limits 26）、测试/工具/脚本（tests.run_tests 27、collect_security_metrics 24、verify_rbac.run_check 22）——**按宁跳不强推纪律整体跳过，均待用户单独拍板**。
- ⚠️ **C901「机械收口」进展（2026-09-12）**：#119(2)+#120(1)+#121(2)+#122(2)+#123(1) ＝ 8 个函数，C901 **58 → 50**。剩余 **50 项**多数属写路径/DB 事务、NLP 语义、安全 RBAC、测试脚本工具——**动前须用户逐项拍板**。
  - ✅ **新确认的可安全收口类别：注册/初始化型函数**（`init_scheduler` 已验证 c=11→2）。特征：函数体主要是「定义若干闭包 + 注册/调度」，闭包内是 try/except + if/else 的业务体。手法＝**保留嵌套 def 与注册语句原样，把闭包体逐字搬到模块级 helper（捕获变量改显式参数）**。同类候选：`init_cache_warmup`、`_try_auto_start_redis`(14)、`start_celery.main`(12)。
  - ⚠️ 这类函数的 harness 关键：闭包体常用**函数内 `from x import y`** → 必须 `sys.modules` 注入假模块（含父包）；且 **`exec` 出的函数 `__globals__` 绑定 exec 时的字典**，stub 必须写回同一 dict（复制成新 dict 再注入 → NameError）。
- ruff 用默认 `ll=88`（仅 black 是 100）；**black 只对 `--check` 已过的文件跑**。

## 后端铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **未跑回归 = 重构未完成**。新建工具前先 Glob 确认不存在。
- ✅ 已收口勿再排期：F17 防腐层 · B3 `to_dict(fields=None)` · E 系 E1–E6 · E4 broad-except 566→425 · NLP 四塔 P0–P1 · components/hooks barrel。
- 前端重构范式 **E6a**/`D2`：hook 含 JSX 必 `.tsx`；搬 `types.ts` 的 interface/const 要 `export`；复合类型用 `ReturnType<typeof useXxx>`。
- 派 subagent 前**先用脚本核对文件真实存在**（曾臆测致 21/29 路径不存在白跑）。
- ⚠️ `%`→f-string 批量转换须双守卫：① AST 全扫「非 f 串含 `{identifier` 占位」② 内容级断言。

## 前端类型规范
- tsconfig 严格档已全收口：`strict`+`noImplicitOverride`+`noUnusedLocals`+`noUnusedParameters`；**禁新增 `any`**；仅「保持原运行时值」用 `as`，禁 `!` 批量绕过。
  - ⚠️ 容器接收「任意组件」写 `React.ComponentType`，**禁 `ComponentType<unknown>`**。判据：仅显式标 `React.FC` 的组件报错 ⇒ 根因在容器。
  - ⚠️ 未用的公共方法 / 回调形参**加 `_` 前缀勿删**（删形参致调用点报「传参错误」）。`noUnused*` 必须在 tsc 兜底（eslint 覆盖不到类私有成员）。
  - ❌ 不推（会改运行时语义）：`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`noPropertyAccessFromIndexSignature`。**每格先单独量化再决定**。
- **导入一律走 barrel**（hook/components 双层）；新增子目录**必须建 `index.ts` 并在根 barrel 聚合**。误删**不用 `git checkout`**，以 tsc TS2304/TS2552 为权威。
- ⚠️ `.map()` 回调返回对象字面量时上下文类型可能失效（空数组→TS7018）→ 加显式返回类型标注。
- **Context**：provider `value` 必须 `useMemo`（含函数先 `useCallback`）。
- 前端 `src` 全 LF；prettier = 100/singleQuote/semi/jsxSingleQuote/`endOfLine:"lf"`。
- hook 复用优先：`useStableToast`/`useSubmitGuard`/`useForm`/`useListFetch`/`useListData`/`useWorkbenchClass`/`useDebouncedValue`/`useModal`/`usePermissions`。A 轨：服务端分页→`useListFetch`；全量下拉→`useListData`。

## 分页 / top-N（`utils/pagination.py`）
- 翻页型 `get_pagination(default=20,max_per_page=200)`→`(page,per_page)`；top-N 型 `get_limit(default=50,max_limit=200)`，**恒不引入 page**。
- ⚠️ `/rank/student`、`/rank/class` 保持 limit 语义；喂 ORM `.limit()` 的 request 参数**必须钳制**；导出上限 **10000**。M9 已闭环。

## RBAC / db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`（G2 68 / DB 70 / seed 66 / teacher 30）；teacher 含 `notification.send`、无 `score.manage`；`/api/roles` 已下线。
- ✅ 班级隔离内置 `requires_permission`（`utils/permission.py` → `_check_class_scope`）：`_CLASS_SCOPE_PREFIXES` 12 词根自动 `ensure_class_access`/`ensure_student_access`→403。**新增班级模块必须加词根**。`ALL_CLASSES=0` 哨兵放行（判 `if not class_id`）。冒烟 `tests/test_workbench_isolation_smoke.py`。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径须 `detach=False`**，否则 DetachedInstanceError。
- 前端：菜单 == 路由守卫 == 后端域权限三方一致；前端只 gate `view` 级。

## 关键坑
- MQTT 双连接（控制 QoS1 / 遥测 QoS0）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)` → `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` **不切** `.env.development`；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"` 否则 404。
- sandbox torch 段错误：主线程先 `import services.nlp_ml_service` 预热再 import app。
- ⚠️ **EOL 铁律**：backend 大量 `.py` 为 CRLF，**禁 Edit 直改**（整文件转 LF → 噪音 diff），须 python 二进制读改写。**判据 = `b.count(b"\r\n")` 字节计数**（勿信 `grep -c $'\r'`），**逐文件判不按目录猜**（`phonebox_policy.py` 是纯 LF）。

## 工具链避坑（通用）
- ⚠️ **Edit 对同一文件多次编辑放同一并行批次会静默丢写**（报 success 未落盘）→ 同文件多次编辑**串行 + 回读核验**，或改用带「命中次数==1」断言的 python 脚本。
- ⚠️ **`&&` 链断会致假绿**（前段 exit≠0 跳过后段仍读到旧值）→ 校验段用 `;` 并 `echo "EXIT=$?"` 显式报码（曾因硬编码 `echo "All checks passed"` 把 SyntaxError 文件误判为通过）。
- ⚠️ **快照 diff 前先证明被测代码确定性**：含 `list(set(...))`/无序迭代的输出**先自证「同码两次不同」**，再 pin `PYTHONHASHSEED=0`；dump 里的 `datetime.now()` 必须正则抹平。
- ⚠️ 用 before/after 输出快照证明等价前，**harness 必须先自检**（断言一个必然成立的期望值，如 all-valid 必 imported=1），否则 harness bug 会让所有用例退化而 diff 照样「一致」。
- ✅ Python 函数改写 / C901 抽取细则（二进制保行尾、按行号切片、dedent 公式、I001、RUF059、class 中间禁插顶层 def、观测噪声、差分法、isinstance 链顺序）**已全部下沉** skill `c901-cyclomatic-refactor` —— 动手前先读它，别凭记忆。

## ⚠️ 审计文档引用铁律
- 引用 `docs/` 历史审计文档前**必须实测复核**（生成日期 ≠ 当前状态）。**grep 权限词根必须带 `-A3`**，前端 `requiredPermission` ↔ 后端 `@requires_permission("X")` 逐路由比对。
- 判「某属性无消费者」须**按类型归属逐一核对**（同名属性常分散在多个实体上）。
- `班主任工作台优化方案-待审核.md` / `班主任页拆分方案-铁律③待审.md` / `M9分页复核-缺口清单.md` 已加顶部状态横幅（勿再按待办引用）。

## 业务模块
- **NLP**：链路 `api/nlp/nlp_routes.py::_get_parser()` → `services/nlp_enhanced_service.get_nlp_parser()`；torch 懒加载。G5 OpenAPI 469 零漂移。
- **班主任工作台**（✅ 全闭环 2026-09-11）：`useWorkbenchClass`（store + `useSyncExternalStore`，12 子页共享班级）；评语 `TeacherComment` → `/api/teacher-comments`。4 硬要求：字段命名统一 / 权限体系 / **字段·权限·业务变更须用户审核** / 优化交互。聚合首页已落地（`/workbench` → `WorkbenchOverview`）。**无待办。**
