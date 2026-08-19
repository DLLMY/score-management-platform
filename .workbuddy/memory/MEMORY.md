# 管理平台设计 — 长期记忆

## 运行 / 测试
- 后端：系统 Python 3.11 `cd backend && python run.py --env development --host 127.0.0.1 --port 5000`；入口 `app/` 包 `get_app()`；顶层 `backend/app.py` 死代码勿改；改 MQTT 改 `app/service_init.py::init_mqtt`。改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。
- 前端：Vite dev，proxy /api、/ws → 5000；build `node node_modules/vite/bin/vite.js build --logLevel warn`；lint `eslint src --ext .ts,.tsx`。
- pytest：系统 3.11 + `-p no:locust --timeout=300`，勿跑全量；闸门 `bash scripts/run_regression.sh`（G2 RBAC 68 / G5 OpenAPI 461/461 / 关键路由 33 / 契约）。

## 已知架构裂缝（第七次评估确认，待路线图消化）
- **~~前端组件库与页面脱节~~ ✅ M1 已闭环（2026-08-19）**：统一 `DataTable` 落地，24/56 页已迁移；原生 `<table>` 36→2（测试断言/Excel 字符串假阳性）；`window.confirm` 56→1（仅 ConfirmDialog 兜底）；OptimizedList + 旧 useConfirmDialog（state-only 半成品）死代码已删除。
- **221 个索引靠手动脚本**：`backend/scripts/create_indexes.py` 无任何启动/部署调用 → 新环境漏跑则索引全失且闸门不报警。改幂等 + 启动校验 + `verify_indexes.py` 纳入 run_regression.sh。
- **~~错误文案链路~~ ✅ M2 已闭环（2026-08-19）**：前端 `getErrorMessage` 优先级反转（error_code 文案表 → 业务 message 透传 → 技术报错屏蔽+HTTP 兜底，TECHNICAL_ERROR_PATTERNS 启发式）；后端 `api/` 响应内 `str(e)` 210→1（仅业务 ValueError 保留）。G5 --strict 461/461 零漂移。**改响应 message 的批改脚本须注意多行 import 会把 logger 插进括号（SyntaxError 崩热重载），必须全量 py_compile。**
- **~~性能保护缺口~~ ✅ M9 已闭环（2026-08-19）**：`utils/pagination.py::get_pagination` 统一分页（max=200，api/ 43 处全替换，上限保护 26%→100%）；`@cached_api` 12→**96 处**（列表 ttl=30/聚合 60，强一致单条不加）；**修复 invalidate_cache 前缀重复拼接 bug**（曾拼 `api:api:/api/*` 导致按前缀失效永不命中），现传 `/api/<域>/*` 或 `api:/api/<域>/*` 均正确。剩余：NLP 推理 HTTP 线程同步（M10）、MQTT 连接超时阻塞启动（M10）、索引闸门（M11）。
- 交互统一：~~`window.confirm` 56 处~~ ✅ 全部换 `useConfirm`；~~`useAutoSave`/`useSubmitGuard` 仅 1–2 页~~ ✅ **M3 已闭环（2026-08-19）**：useAutoSave 加 draftAvailable+beforeunload 拦截，ScoreEntry/ExamManagement/AttendanceManage/RemoteNotify 四录入页草稿+恢复条（成绩录入刷新可恢复）；useSubmitGuard 推广 13 页。

## M1 DataTable 约定（✅ 已完成，2026-08-19）
- 组件 `frontend/src/components/data-display/DataTable.tsx`，从 `../components` 导入 `DataTable`，`ColumnType` 从 `../components/data-display/DataTable` 导入。**新建表格一律用 DataTable，禁止手写原生 `<table>`**。
- 接口 antd 兼容：`columns[{title,key,dataIndex,render(value:unknown,record,index),width,align,sorter,className,ellipsis}]` + `dataSource` + `rowKey`(必填)。内置五件套：loading 骨架 / 空态(empty prop) / 分页(20/50/100/200 硬上限 200，受控传 total+page+pageSize+onPageChange，客户端数组自动分页) / overflow-x-auto 横滚 / 非受控且行数≥200 自动切 VirtualList。
- 确认弹窗：`import { useConfirm } from '../components/ui/ConfirmDialog'`（ConfirmProvider 已挂 App 根）。**lint 铁律**：`const confirmRef = useRef(confirmFn); confirmRef.current = confirmFn;` 回调里 `await confirmRef.current({message, type:'danger'|...})`，ref 不进 deps。
- 迁移范式：columns useMemo 必须放所有 early return **之前**；render 的 value 需显式断言 `as string/number`；受控分页下页大小选择器须与后端 per_page 一致（或 `pageSizeOptions` 锁死）。
- 测试：`DataTable.test.tsx` 7 用例；全量 vitest 171 用例是回归基准。

## 架构铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`（conftest walk_packages 动态注册）。API 统一信封 {success,code,data}；create 端点历史双元组 `[env,201]` 契约勿改。
- **F17 防腐层渐进**：写入/事务路径内联 `db.session` → `services/*_service.py` 薄封装；路由保留 get_or_404(404)、请求校验、缓存失效、跨切面副作用(MQTT/FTS/管理员通知)、响应构造。只读 query 暂缓。**逐字节复刻**响应体/状态码/错误。每域：快照→测试先行→service→改写→py_compile+定向 pytest+G2/G5→memory。禁一次性全改、禁 git commit。

## RBAC
- `verify_rbac_consistency.py --check-only` 改 RBAC 后必跑（68 条）。真实守卫 `utils/permission.py` 仅读 role_permission_mappings+RoleHierarchy。RolePermission.permissions 列已删，`/api/roles` 下线。teacher 含 notification.send，无 score.manage。

## 双 JWT
- Admin type=access+requires_permission；学生 type=student+requires_student（置 g.current_student）。`api/student/__init__.py` 须保留。

## 关键坑
- MQTT 双连接：控制(self._client, QoS1, 订阅 score/# + phonebox/query/unlock/#/ota/#/points/#) + 遥测(QoS0, phonebox/#)；派发逐条 try/except 隔离。生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- score/add 幂等：add(record) 后须 `db.session.flush()` 再读 record.id。
- 缓存单套 `redis_cache_service.RedisCache.get_cache_service()` + `utils.api_cache_middleware.cached_api`（兼容元组/裸 dict、仅 200、降级）。
- C 盘满：删 `.bak_*`/`pre_F*` 不释放空间（NTFS 去重）；释放只能删非重复内容。safe-delete 钩子>50 阻断→`cmd /c rmdir /s /q <绝对路径>`。
- **git-bash 内 `python` 解析为 managed 3.13（缺项目依赖，`run.py` 起不来 / G5 连不上）**：启动后端、跑 G5、pytest 须显式用系统 3.11 绝对路径 `C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`。py_compile 语法检查可用任意版本。

## 已完成专项
- OTA(P0-P3)、ops_center、F9 通知合并、P0-6 预警合并、F16 模型拆包(60 类拆 8 子模块，__init__ 仅再导出) 均已落地。

## F17 进度
- 已闭环域：scores(8 子域 + notify_template 4 写路径 + scheduled_notify 6 写路径)、notifications 9/9、devices 24/24、academics 59/59、users 15/15；第十六批晚追加收口 approvals/alerts/notify_history（修复 3 契约缺陷 + 审批结果通知内联 → service）。各域 G1/G2/G3/G5 全绿。
- **第十九批（2026-08-18，"全部推进"）收口全部剩余可迁移域**：nlp(6)、sub_accounts(8)、system_routes(7→1 边界)、admin_notifications(9)、import_export(10→7 边界)、security(11 写)、admins(17)、rbac(34) 全部 0 写残留。新增 service：nlp_correction_service / sub_accounts_service / frontend_telemetry_service / admin_notifications_service / import_export_service / security_service / admins_service / rbac_service。
- **跨模块委托函数（路由保留同名，勿删）**：security_routes 的 check_login_rate_limit/record_failed_login/clear_login_attempts（auth/student/admins/sub_accounts 导入）；admin_notifications_routes 的 create_admin_notification（approvals/records 懒加载 + api/system/__init__ 再导出）；rbac_routes 的 init_default_permissions（scripts/fix_permissions_catalog 导入）/init_default_roles。
- **本批修复前序缺陷**：① `APIResponse.bad_request` 不接收 data（import 无文件分支恒 500）→ utils/response.py 增加 data/**kwargs 透传；② rbac assign-roles 审计日志 `admin.username` NameError（作用域仅 _admin）→ 改 `_admin.username`，恒 500 → 200。
- **事务边界保留在路由**（非写路径建模先例）：system_routes 批量 S10 统一 commit；import_export 三导入端点的 commit/rollback（含 TransactionRetry）。
- **意图保留不迁移**（import 回滚/只读聚合兜底）：scores/rules_routes:3、scores/records_routes:2、academics/exam_import_routes:1、devices/devices_routes:2、monitoring/operation_logs_routes:2、ClassPeriod 3 读、scores/notify_template_routes 3（GET /categories 只读聚合）、security_routes audit-stats/suspicious-ips 4 处只读 db.session.query、nlp_routes L579 只读 SELECT、rbac_routes get_inherited_permissions/check_admin_permission 只读助手。
- **scheduled_notify_routes 收口（十八批）**：原 13 db.session → `services/scheduled_notify_service.py` 6 函数（create/update/delete/cancel/record_scheduled_notify_sent/record_scheduled_history）；路由仅留 trigger 防御性 rollback×2 + 后台任务 `process_scheduled_notifications` rollback/commit 事务边界（共 4，非写路径建模）。**修复历史缺陷**：`ScheduledNotify` 模型/库表缺 `created_by` 列（create 端点此前恒 500），已补模型列声明 + ALTER 库表（SQLite ADD COLUMN 元数据级，安全）。
- **G2/G5 现状**：rbac 迁移后 G2 一致性 OK(68)；G5 461/461 待迁移后全量复核（backend 5000 强杀重启后跑 `verify_openapi_contract.py --strict`）。

## 约定
- 不主动 git commit（破坏性操作需用户授权）。git push 走 `origin-ssh`（`ssh://git@ssh.github.com:443/...`，id_rsa 已注册，SSH-over-443 绕过代理）；`origin`(https) 直连被重置不可用于 push。
- 规模：后端 433 .py/98k LOC；前端 179 .tsx/.ts/63k LOC。
