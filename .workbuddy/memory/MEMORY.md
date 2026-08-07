# 管理平台设计 — 长期记忆

## 运行 / 测试
- 后端 `python run.py --env development --host 127.0.0.1 --port 5000`，入口是 `app/` 包（`app/__init__.py::get_app()`）；顶层 `backend/app.py` 是零逻辑占位死代码，勿改。改启动/MQTT → `app/service_init.py::init_mqtt`。
- 必须用系统 Python 3.11（`C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe`，带 torch）；托管 3.13 缺 torch 启动失败。改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。
- 前端 Vite dev，proxy /api、/ws → http://127.0.0.1:5000（IPv4）；端口 3000 被占跳 3005/3006。pytest：3.11 + `-p no:locust --timeout=300`。
- API 统一 `{success,code,data}`；登录令牌顶层 access_token；admin/123456=super_admin。纯列表端点 data 必须数组，禁包 `{items:[...]}`；分页端点（users/rules/devices/classes）返回 `data.{xx:[...],total,...}`（前端已适配）。
- SQLite instance/score_management.db（WAL）。级联删除：`models/__init__.py::cascade_delete_related_records`。

## 前端约定
- api.ts::request() 仅当 success&&data 都定义时剥 envelope，勿二次访问。
- 嵌套结构错位 → api.ts 加 normalize 层（6 个 normalizeBatch* 三件套：raw interface + normalize + async 包装）；顶层 shape 也错时须重写后端 svc 吐前端期望形状。
- 删除用 window.confirm；vite 优先 .tsx，勿删遗留 .js；ScoreEntry 用「始终可见 input + onBlur 即时入库」。

## 上课时间下发互斥（已完成）
- 上课/自习禁下发积分/通知，后端强拦（ClassTimeChecker：课表反查 + TimeRule）。逃生仅 super_admin `notification.force_send`；学生自助开箱硬拦；管理员远程开锁不受拦。审计 notify_audit。端点 `GET /api/course-schedules/now?class_info_id=`。

## RBAC（重要）
- 正常启动不 seed RBAC。新增权限/角色必须写**幂等增量脚本**（范例 scripts/migrate_phonebox_permission.py、grant_class_edit_to_teacher.py），**禁跑 seed_rbac.py**（清库重建）。has_permission 精确匹配。
- **校验+幂等补齐脚本 `scripts/verify_rbac_consistency.py`**（ast 解析 seed_rbac 字面量不执行，核对 DB 四表；teacher 关键权限 smoke；`--apply` INSERT OR IGNORE 绝不删；check-only 有 issue exit 1 可接 CI）。曾抓出 teacher 缺 notification.send 漂移。改 RBAC 后必跑。
- timetable_manager 角色+paikao 账号（仅排课权限）；teacher 角色含 class.edit / culture.* / phonebox.unlock.manage / notification.send。
- created_by 用 `getattr(g.current_user,"id",None) if getattr(g,"current_user",None) else None or 1`，勿硬编码 1。
- 操作审计：`utils/logger.py::log_operation`（operator 缺省取 g.current_user → X-Admin-Id 头 → system；序列化带 default=str）。rules/classes/notify_template/scheduled_notify 的 CRUD 已接审计，新写端点照抄（成功才记、异常全吞）。

## 班主任工作台 12 页
- /seating-chart /duty-roster /committee /parent-contact /homework-check /attendance /study-groups /mental-health /activity /culture /study-guide /phonebox-policy。
- 座次/值日/班委/家长联系 4 模块写操作依赖 `class.edit`；列表接口必须返回姓名（services/entity_names.py flask.g 缓存）；侧栏权限码与路由 Guard 码可能不一致。

## 手机箱开箱策略（已完成）
- PhoneBoxPolicy 四态 ALLOW_OVERRIDE>ALLOW_WINDOW>BLOCK>DEFER；API /api/phonebox-policy；权限 phonebox.unlock.manage。APIResponse.error 用 `status_code=` 设 HTTP 状态。

## 学生自助端（P0 已全部完成）
- 学生 = `User` 实体（无独立 Student 模型），`card_id` 唯一作登录名；User 无 password → **card_id + 姓名双因子免密登录**。`validate_card_id` 仅 `^[A-Za-z0-9]{4,20}$`（无连字符/下划线）。
- **双 JWT 体系隔离**：Admin `type="access"`（`generate_tokens`）、学生 `type="student"`（`generate_student_token`）；`validate_token(token, token_type)` 按 type 校验。新增 `requires_student` 装饰器（`utils/permission.py`，与 Admin `requires_permission` 完全隔离，置 `g.current_student`）。
- 后端端点 `ns_student`（`api/student/student_routes.py`，`api_versioning.py` 注册）：`POST /api/student/login`、`GET /api/student/me|score|records`、`GET /api/student/notifications`（按 user_id 分页）、`GET|POST /api/student/leaves`（POST 复用 `attendance_service.apply_leave`，student_id 自动绑定当前学生；`parse_date` 对坏日期返回 None 而非抛异常，须显式判 None）、`POST /api/student/phonebox/unlock`（调 `phonebox_policy.evaluate`，allow_override/allow_window 时 publish_mqtt 最佳努力下发 `phonebox/unlock/A|B`，MQTT 离线仅标记 dispatched=False）。**必须保留 `api/student/__init__.py`**（空，否则 walk_packages 不递归→404）。
- 前端独立学生区（隔离 admin 态）：localStorage 键 `student`/`student_token`；`api.ts` `getBearerToken()` 双键回退、`clearStudentAuth()`；401 分流（student→`/student/login`，admin→`/login`）。`StudentPortal.tsx` 用 Tab 组织：积分/通知/请假/手机箱。路由 `/student/login`、`/student`（`StudentProtectedRoute`）。
- 测试 `tests/test_student_endpoints.py`：自建 `student_user` fixture（card 用 `uuid4().hex` 避连字符），共 23 passed（登录 5 + 受保护/积分 4 + 通知/请假/手机箱 14）。改学生端点后必跑。

## 科任老师效率模块（P1，已完成批量录分 + 群发通知）
- **权限码不一致（重要坑）**：`exam_routes.py` 单条录分用 `score.manage`，但 RBAC seed 实际定义的是 `score.entry`/`score.edit`（teacher 持有 `score.entry`，**无 `score.manage`**）。批量录分端点必须用 `score.entry` 才能被老师访问，否则 403。前端 ScoreEntry 页面守卫码也是 `score.entry`。
- 后端新增：`POST /api/scores/batch`（`api/academics/exam_routes.py`，权限 `score.entry`，支持 `student_id` 或 `card_id` 识别，批量建 Score，逐条收集 errors，部分成功返回 207）；`POST /api/notifications/batch`（`api/monitoring/notifications_routes.py`，权限 `notification.send`，支持 `user_ids` 或 `class_id` 展开，复用 `ClassTimeChecker.is_broadcast_blocked` 上课时间拦截，循环建 Notification）。
- 前端 `api.ts` 新增 `scores.batchCreate` / `notifications.batchSend` 及类型 `BatchScoreItem`/`BatchScoreResult`/`BatchNotifyResult`；新建 `TeacherTools.tsx`（`/teacher-tools`，`PermissionGuard score.entry`），Tab 布局：批量录分（选考试+班级+多行成绩）/ 群发通知（选班级+标题内容+上课时间拦截提示）。复用 `api.exams/classes/users`。
- 测试 `tests/test_teacher_tools.py`：**12 passed**（批量录分 6 + 群发 6，含权限隔离：student token 被拒）。生成学生 token 用 `generate_student_token(user_id, class_info_id, card_id)`（3 参，缺参报错）。
- **验证总况**：后端 35 passed（teacher_tools + student_endpoints + test_api_envelope）；前端 build 成功、eslint 0 error。

## 班级学期报告导出（P1 收尾）
- 后端 `backend/api/reports/report_routes.py`（`ns_reports`，**`api_versioning.py::register_v1_routes` 注册**，**必须建 `api/reports/__init__.py`**）：`GET /api/reports/class-semester?class_id=&format=excel|csv`，权限 `score.view`（班主任/任课/年级组长均持；注意专用 `report.export` 仅 head_teacher/dashboard_viewer 持有，班主任没有，故用 `score.view`）。聚合班级全体学生 + 各考试跨科目总分 + 当前积分余额，输出 Excel/CSV（文件名含班级名）。复用 `ExcelUtils.export_to_excel(sheets)` + `send_file(BytesIO(content), as_attachment=True, download_name=)`（与既有 export_records 路由同款，已验证可用）。
- 前端 `api.ts` 增 `reports.exportClassSemester(classId, format)`：用 `fetch` + Bearer token 取 blob 触发下载（`window.open` 不带鉴权头，故不能用，改用 fetch+blob 模式，与 import_errors 下载一致）。**注意 `api` 是 `export default api`（非命名导出）**，页面须 `import api from '../services/api'`。新建 `pages/SemesterReport.tsx`（`/semester-report`，`PermissionGuard score.view`，选班级→预览人数→导出 Excel/CSV），`App.tsx` 加懒加载+路由。
- 测试 `tests/test_reports.py`：**5 passed**（excel/csv 成功看 content_type、缺 class_id 400、班级不存在 404、student token 401/403）。
- **验证总况**：后端 40 passed（reports 5 + teacher 12 + student 23 + envelope）；前端 build 成功、eslint 0 error。

## 关键坑（勿回退）
- NLPScoringRule.last_used_at 是 String(50)，须 `_coerce_dt()` 转 datetime 再算，否则 /api/nlp/parse 500。
- SQLAlchemy 关系对象不能当 dict key/value → jsonify 500，统一规整为字符串。
- 列表类 GET 用持久化缓存：写操作后必须清缓存 + 提供 skipCache（exams 删除 404 教训）。
- test_client + TESTING=True：未捕获异常直接冒泡（非 500），契约测试须 try/except 捕获记违规。
- celery task 无 Flask app context，用 DB 必须 `with flask_app.app_context():`（tasks/mqtt_tasks.py 样板）。
- DB 还原铁律：先 `cp 库 库.bak_<ts>`；WAL 覆盖主库+rm -wal 丢未 checkpoint 写入；勿拿旧备份当还原点。

## 测试 / 资产 / 约定
- **后端契约回归网 `backend/tests/test_api_envelope.py`**：遍历所有无参 GET /api 路由，5xx/未捕获异常判失败（200 无信封仅告警）；已知列表/分页端点 shape 快照。曾一次抓出 6 个真实 500（send_file/csv 未 import、HealthChecker 方法名错、ExportService 方法不存在、PerformanceMonitor 慢请求含 datetime 不可 jsonify——后者是数据驱动型，契约测试空数据漏过、冒烟真实数据才触发）。改端点后必跑。
- **全量 pytest 已 0 失败**（1633 passed + 9 skipped，全量约 35 分钟）。失败修法参考：测试旧契约（`data['data']['items']` 包裹 / `result['students']`）落后于实现（数组 / `{summary,anomalies}`）→ 改测试适配；并发类测试在 SQLite :memory: 单连接下无法真实并发 → class 级 skip（test_concurrent_operations.py 样板）。
- **前端冒烟回归 `frontend/tests/e2e/smoke.spec.ts`**：登录后串行访问 8 核心页，断言无 ErrorBoundary/5xx/console error。**必须 `mode:'serial'`**（重负载页并行会互挤误报）。运行：`npm run test:e2e -- --project=chrome smoke.spec.ts`（后端 5000 需先起）。
- playwright webServer 用 `npm run dev:vite`（package.json 已加该脚本）+ `reuseExistingServer:true`（本地复用 3000，无服务自动拉起）。**全量 e2e（--workers=1）21/21 全绿**；旧 spec 断言贴实现事实（登录存 `admin` 键、hash 路由 `/#/xxx`、退出清 admin 键 + auth-storage.token）。
- **前端单测 vitest 已复活**：`npm test`（vitest run）149 passed / 0 failed（jsdom）。配置在独立 `vitest.config.ts`（vitest 4 不导出 loadEnv；Windows 中文路径须 `pool:'threads'`）；`src/test-setup.ts` 全局注入 jest 兼容对象。新写组件单测放 `src/**/*.test.{js,jsx,ts,tsx}`。
- CI：`.github/workflows/ci.yml`（backend 跑不依赖本地 BERT 模型的测试子集 + RBAC 校验 + frontend build/lint；e2e 不入 CI）。
- **OpenAPI 契约校验 `backend/scripts/verify_openapi_contract.py`**：对比实时 swagger.json（信封包裹，paths 在 data.paths）与 api-docs/openapi.json 快照；`--update` 覆盖快照（先备份）、`--strict` 漂移 exit 1。曾抓出 28% 文档漂移并已同步。改端点后跑它。
- 保留回归资产：grant_class_edit_to_teacher.py、verify_workbench.js、verify_algo_fix.py、test_api_envelope.py、smoke.spec.ts、verify_rbac_consistency.py、verify_openapi_contract.py。诊断脚本用完即清。
- 不主动 git commit（用户约定）。验证前端用 `node node_modules/vite/bin/vite.js build --logLevel warn`（勿单跑 tsc --noEmit）。Bash 启动 python 用 `/c/Users/...` 绝对路径 + run_in_background。

## 积分排行榜（已交付）
- 后端 `ns_rank`（`api/rank/`，权限 `score.view`）`/api/rank/student`、`/api/rank/class`；学生端 `GET /api/student/rank`（`requires_student`）。
- 前端 `RankBoard.tsx`(`/rank-board`)、`StudentPortal`「排名」Tab；`api.ts` 增 `student.getMyRank`、`rank.getStudentRanking/getClassRanking`（**`api` 是 `export default api`**）。

## 关键坑（新增）
- **`api.ts` 从 `interface Api` 复制方法到运行时 `const api: Api = {}` 时，结尾 `};`（interface 成员分隔）必须改成 `},`（对象属性分隔）**，否则 esbuild 报 `Expected "}" but found ";"`、整前端 build 失败。这是 2026-08-06 致命构建缺陷的根因。
- `analysis_service.get_student_ranking` 按 `class_name` **字符串列**聚合：**学生须同时有 `class_info_id` 与 `class_name` 才入榜**；仅设 FK 则 `my_rank` 为 None、`/api/student/rank` 不含本人。
- `generate_student_token(user_id, username, card_id)` 返回 `{"token":..., "expires_in":...}`（dict），取令牌用 `["token"]`，勿当 str 拼接。学生 token 打 Admin 端点被 `validate_token(token,"access")` 因 type 不匹配拒为 **401**（与 `requires_student` 拒 admin token 对称）。

## 路由注册（致命坑）
- **路由注册唯一源 = `app/api_versioning.py::register_v1_routes`（`create_app`→`api_version_manager.init_app` 调用）。`app/route_init.py` 曾是死代码（无任何调用方，已于 2026-08-06 删除），改路由注册只能动 `api_versioning.py`**。`conftest.py` 用 `walk_packages` 动态注册 `api` 包下全部 `Namespace`，故 pytest 永远能命中端点；但生产 app 只注册 `register_v1_routes` 里**显式列出**的命名空间——漏列即 404（学生自助端/学期报告/排行榜曾因此生产 404 但测试全绿，现已补）。**新增命名空间必须同时在 `api_versioning.py` 补 `add_namespace`，否则生产不可达。** 注：`route_init.py` 原先还注册 3 个监控蓝图 `logs_bp`(`/api/logs/*`)、`mqtt_monitor_bp`、`ws_bp`(`/ws/*`)，但 `api_versioning.py` 从未注册它们（生产长期缺这些端点，纯死代码）。已于 2026-08-07 直接删除：`api/monitoring/{logs_routes,mqtt_monitor_routes,websocket_routes}.py` + legacy `routes/{logs_routes,websocket_routes}.py`（备份 /tmp/deadcode_bak/），并清理 `api/monitoring/__init__.py` 悬空 `__all__` 项。前端 `/api/mqtt/status` 由已注册 `ns_mqtt` 提供，不受影响。如需启用这些监控端点，须显式补到 `register_v1_routes`（用 try/except 包裹）。
- **死代码扫描（2026-08-07）**：又清掉两类——① `api/prediction_routes.py`(ns_prediction)、`api/anomaly_routes.py`(ns_anomaly)、`api/risk_routes.py`(ns_risk)、`api/rule_routes.py`(ns_rule)、`api/composite_routes.py`(ns_composite)：5 个独立命名空间从未在 `api_versioning.py` 注册（仅 211-215 行注释占位），功能 100% 被已注册 `ns_algorithm`（`/algorithm/prediction|anomaly|risk-predict|rule-recommend|composite-score|warning`）覆盖，删之零损失，并清掉 api_versioning.py 第209-215 行过时注释块。② 整包删除 legacy `backend/routes/`（37 文件）：全仓库零外部 import（仅包内互 import），纯旧 blueprint 镜像、生产长期未注册；删除前 `tar czf /tmp/legacy_bak/routes_legacy_*.tar.gz` 备份。注意：删路由文件前务必先 `git status` 确认是否 git-tracked（可 `git checkout` 恢复），并确认 `api/__init__.py` 及子包 `__init__.py` 未 `from .xxx_routes import` 这些命名空间（否则启动 ImportError）——本批均无。
- **`ns_rank` 同名冲突**：`api.scores.rank_routes.ns_rank`（积分规则，path `/rank-rules`）与 `api.rank.rank_routes.ns_rank`（排行榜，path `/rank`）名字不同但变量同名；在 `register_v1_routes` 内后 import 会覆盖前者，故排行榜用 `from api.rank.rank_routes import ns_rank as ns_rank_board` 别名。
- 改 `api_versioning.py` 后须强杀全部 `run.py` python 进程重启（Flask-SocketIO 不 reload，debug 模式 stat 重载会触发二次重启，探针需等稳定后再打）。
