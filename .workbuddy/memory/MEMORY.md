# 管理平台设计 — 长期记忆

## 运行 / 测试
- 后端 `python run.py --env development --host 127.0.0.1 --port 5000`，入口是 `app/` 包（`app/__init__.py::get_app()`）；顶层 `backend/app.py` 是零逻辑占位死代码，勿改。改启动/MQTT → `app/service_init.py::init_mqtt`。
- 必须用系统 Python 3.11（`C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe`，带 torch）；托管 3.13 缺 torch 启动失败。改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。
- 前端 Vite dev，proxy /api、/ws → http://127.0.0.1:5000（IPv4）；端口 3000 被占跳 3005/3006。pytest：3.11 + `-p no:locust --timeout=300`。
- API 统一 `{success,code,data}`；登录令牌顶层 access_token；admin/123456=super_admin。纯列表端点 data 必须数组，禁包 `{items:[...]}`；分页端点（users/rules/devices/classes）返回 `data.{xx:[...],total,...}`（前端已适配）。
- SQLite instance/score_management.db（WAL）。级联删除：`models/__init__.py::cascade_delete_related_records`；routes/ 是 legacy 副本，改时同步。

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
