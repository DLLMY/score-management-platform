# 管理平台设计 — 长期记忆

## 运行 / 测试
- 后端：系统 Python 3.11（带 torch）`python run.py --env development --host 127.0.0.1 --port 5000`；入口 `app/` 包 `get_app()`；顶层 `backend/app.py` 是占位死代码勿改；改启动/MQTT 改 `app/service_init.py::init_mqtt`。改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。
- 前端：Vite dev，proxy /api、/ws → 127.0.0.1:5000；3000 被占跳 3005/3006；验证 build 用 `node node_modules/vite/bin/vite.js build --logLevel warn`（勿单跑 tsc --noEmit）。
- pytest：3.11 + `-p no:locust --timeout=300`。全量 ~35min / 1633 passed + 9 skipped。前端 vitest 149 passed；e2e 21/21（须 `mode:'serial'`，后端先起）。

## 架构铁律
- **路由注册唯一源 = `app/api_versioning.py::register_v1_routes`**（`create_app` 调 `api_version_manager.init_app`）。`conftest.py` 用 `walk_packages` 动态注册 `api` 包全部 Namespace → pytest 永远绿；但生产只注册 `register_v1_routes` 显式列出的 → **漏列即生产 404**。新增命名空间必须同时在此补 `add_namespace`。（`app/route_init.py` 已删，曾漏注册三模块致生产 404。）
- 路由文件两形态：**flask-restx Namespace**（被 `register_v1_routes` 注册）与**裸 Blueprint**（`migration_bp`/`version_bp`/`logs_bp` 等）。裸 Blueprint 须 `app.register_blueprint` 才生效；未注册=死代码（见代码健康待办）。
- API 统一信封 `{success,code,data}`；admin/123456=super_admin；纯列表 data=数组，分页 data={xx:[],total}。

## RBAC（重要）
- 正常启动不 seed。新增权限/角色写**幂等增量脚本**；**禁跑 seed_rbac.py**（清库重建）。has_permission 精确匹配。
- `scripts/verify_rbac_consistency.py --check-only`：CI 用，DB 漂移 exit 1。改 RBAC 后必跑。teacher 角色含 class.edit/culture.*/phonebox.unlock.manage/notification.send；**无 score.manage**（批量录分用 score.entry）。
- 操作审计 `utils/logger.py::log_operation`（成功才记、异常全吞）。created_by 用 `getattr(g.current_user,'id',None) if getattr(g,'current_user',None) else None or 1`。

## 双 JWT 隔离（学生自助端）
- Admin `type="access"`（`generate_tokens`）+ `requires_permission`；学生 `type="student"`（`generate_student_token`）+ `requires_student`（置 `g.current_student`）。`validate_token(token, token_type)` 按 type 校验，互不越权。学生 = User 实体（无 Student 模型），card_id+姓名双因子免密登录（`validate_card_id` 仅 `^[A-Za-z0-9]{4,20}$`）。`api/student/__init__.py` 必须保留（否则 walk_packages 不递归→404）。

## 功能模块状态（已完成）
- 班主任工作台 12 页、手机箱四态策略（ALLOW_OVERRIDE>ALLOW_WINDOW>BLOCK>DEFER，权限 phonebox.unlock.manage）、上课时间下发互斥（ClassTimeChecker 强拦，逃生 super_admin notification.force_send）、科任老师批量录分+群发通知（TeacherTools.tsx）、班级学期报告导出（SemesterReport.tsx）、积分排行榜（RankBoard.tsx + 学生端排名 Tab）。前端学生区隔离 admin 态（localStorage `student`/`student_token`）。

## 关键坑（勿回退）
- NLPScoringRule.last_used_at 是 String(50) → 须 `_coerce_dt()` 转 datetime 否则 /api/nlp/parse 500。
- SQLAlchemy 关系对象不能当 dict key/value → jsonify 500。
- 列表 GET 用持久化缓存：写操作后清缓存+提供 skipCache。
- 学生排行榜：`analysis_service.get_student_ranking` 按 `class_name` 字符串聚合，学生须同时有 class_info_id 与 class_name 才入榜。
- `api.ts` interface→运行时对象复制时 `};` 须改 `},`（否则 esbuild 整前端 build 失败）。
- DB 还原：先 `cp 库 库.bak_<ts>`；勿拿旧备份当还原点（WAL 覆盖丢未 checkpoint 写入）。
- **StudentPortal.tsx TDZ 崩溃（已修复）**：`loadMyRank` 的 `useCallback` 若定义在引用它的 `useEffect` **之后**，运行期报 `Cannot access 'loadMyRank' before initialization`（`const` 暂时性死区），被 ErrorBoundary 捕获→**学生端整页白屏**。须保证所有被 useEffect/useCallback 依赖引用的 hook 定义在使用之前。此 bug **仅浏览器运行时暴露**，build/lint/vitest 全不报——**后期前端页面必须用 playwright 实跑验证**（见功能模块状态）。
- **MQTT 双连接架构（勿回退为单连接）**：`services/mqtt_manager.py` 现为**双 paho 客户端**——控制连接 `self._client` 订阅 `score/#`+`phonebox/query`+`phonebox/unlock/#`+`phonebox/ota/#`+`phonebox/points/#`（QoS1，即时业务派发，绝不被洪流淹没）；遥测连接 `self._telemetry_client` 订阅 `phonebox/#`（QoS0，可容忍丢包），心跳即时推 WS、DB 落库异步入 Celery `tasks.mqtt_tasks.process_phonebox_telemetry`。各自独立 `_on_connect/_on_message/_on_disconnect` + 重连线程。原单连接 + 13 具体 topic 触发 EMQX 订阅上限死链、且被遥测洪流淹没控制消息，已于 2026-08-14 根治。新增控制 topic 加进 `CONTROL_SUBSCRIPTIONS`、新增遥测加进 `TELEMETRY_SUBSCRIPTIONS`，勿混。
- **控制回包 QoS=1**：`services/mqtt_service.py::publish_mqtt` 默认 qos=1（低频控制/回包/通知），确保设备可靠收包；遥测高频消息不走此函数。
- **生产 Broker 洪流（真机 MQTT 测试须知）**：生产 EMQX（nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883）有真实设备 ~5000 msg/s 命中 phonebox/#。后端双连接已根治「控制消息被淹没」（控制连接独立，2026-08-14 验证在洪流下稳定收发 A/B/C1/C2 并以 qos1 回包）。但**e2e 测试桩（paho 模拟设备）在洪流窗口下偶发收不到自己回包**（B 的 phonebox/unlock、C2 的 undo_code），属测试设备连接收包 artifact，非后端 bug；后端侧已铁证可靠。干净验证可起本地 Broker（amqtt 在 Windows 上 ConnectionResetError 不稳，建议 Linux）。

## 测试 / 资产 / 约定
- 契约回归 `tests/test_api_envelope.py`：遍历无参 GET /api，5xx/未捕获异常判失败（200 无信封仅告警）。改端点后必跑。
- OpenAPI 校验 `scripts/verify_openapi_contract.py --update/--strict`；快照 api-docs/openapi.json（451 路径）。
- 不主动 git commit（用户约定）；CI 见下方待办。
- **Git push 需代理**：本机直连 GitHub 不通（DNS 可解析 github.com→20.205.243.166，但 TCP 443 `Could not connect to server`/`Connection was reset`），6 个常见代理端口（7890/7891/1080/8080/10808/8118）默认全无响应。push 前须用户在本地开代理（Clash 7890 / v2rayN 10808-10809 / SSR 1080），再用 `git -c http.proxy=http://127.0.0.1:<port> push origin main` 重推；**勿写 git 全局代理配置**。提交可离线完成，安全落盘。

## 代码健康（评估发现并修复，2026-08-07）
- ✅ **CI 红已修**：`ci.yml` MQTT 测试改为实际存在的 `test_mqtt_message_service.py`/`test_mqtt_service.py`。
- ✅ **裸 Blueprint 已注册**：`migration_bp`/`version_bp` 在 `register_v1_routes` 末尾 `app.register_blueprint` 注册（/api/version、/api/v1/compatibility、/api/migration/* 生产可用）。冲突处理：`version_bp` 的 `/api/versions` 与 `api_versioning.py` 的 `api_version_manager` 同名路由重复 → 已删 `version_bp.list_versions`，保留 version_manager 的权威实现。
- ✅ **security.py NameError 已修**：顶部加 `from flask import request`（`get_request_data`/`get_request_param` 现可调用）。
- ✅ **前端死代码已删**：`services/api.js` + 4 孤儿页（ClassAssignment.js/MQTTDebug.js/UserManagement.js/ClassTimeSettings.tsx.bak）。确认 api.js 因 vite `resolve.extensions` 优先 .ts 实际由 api.ts 解析（rbacApi.ts 的 `import {request} from './api'` 命中 api.ts 的 request 导出），删除安全。
- ✅ **utils/ 9 个孤儿已删**：batch_operations/cache_middleware/data_sync_events/db_pool_manager/exception_handler/monitoring_service/performance/swagger_config/initializer（AST 扫描确认活跃+测试零引用）。
- ✅ **信封拆包 DRY**：api.ts 抽出单一 `unwrapEnvelope(rawData, skipDataExtract)` 替代 3 处内联（行为不变，消除重复并集中维护）；`code` 字段增强判定因担心行为回退暂未加（当前后端业务失败均置 success:false，前端已能识别）。
- ✅ **仓库噪音已清理（2026-08-13）**：backend 根散落 24 个孤儿脚本（verify_algo*/verify_risk_batch/test_*/debug_*/probe_*/inspect_*/fix_* + scripts/verify_algo_fix.py）+ 12 张 NLP 调试 PNG + instance/ 21 个备份库（.db.bak_* + *_corrupt.db + *_rebuilt_broken.db + .db.*_bak 变体）全部 `git rm --cached` 移出跟踪并 mv 归档到 `backend/scripts/archive/{,screenshots,db_backups}`（保留本地不删）；`.gitignore` 追加 `backend/scripts/archive/` + `backend/*.png`。`instance/` 现仅正常库。commit c771c6b。
- ✅ **后期功能端到端验证（2026-08-07 playwright 实跑：临时后端 5001 + 前端 3000 代理 5001）**：学生端登录→5 Tab（积分/通知/请假/手机箱/排名）全渲染、0 控制台错误；TeacherTools（教师效率工具/批量录入成绩）、SemesterReport（班级学期报告导出）均完整渲染无崩溃；后端学生 API 全可用（登录/me/score/records/notifications/leaves/rank + 请假 POST 201 + 手机箱 POST 按策略拦截 + 学生 token 打 admin 端点 401 双 JWT 隔离生效）。验证中发现并修复 StudentPortal TDZ 白屏 bug（见关键坑），该 bug 致**学生端自写完一直不可用**，因无 StudentPortal 组件测试未被 vitest(149)/build/lint 覆盖。

## 项目规模（2026-08-07）
- 后端 433 .py / 98,668 LOC；前端 179 .tsx/.ts / 63,674 LOC；git 107 commits（2026-08 月 6 commits）。README/Dockerfile/docker-compose/CI 齐备。
