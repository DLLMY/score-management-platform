# F16 模型层拆包 — 执行日志（2026-08-17）

> 触发：`docs/重构专项评估与排期_F16F17F19S4_2026-08-17.md` 第一批（F16 模型模块化），用户指令"开始"。
> 本文档即该批次的执行产物，遵循"一步到位、可回滚、全闸门验证"铁律。

## 1. 范围与目标
- **范围**：将 `backend/models/__init__.py` 内 60 个内联 ORM 模型类拆分为独立子模块，使 `__init__.py` 仅保留 `db` 实例、辅助函数与再导出块，降低单文件爆炸半径。
- **目标**：结构重构（不改表结构/语义），`from models import X` 全量兼容，零回归。
- **排除**：F17（路由服务化）、F19（kebab 统一）、S4（JWT→Cookie）按评估排期未执行。

## 2. 备份策略
- DB 物理拷贝：`backend/instance/score_management.db.pre_upgrade_20260817`（沿用升级期回滚点，2.3G）。
- 配置/代码快照：分支 `refactor/F16`（`git checkout -b refactor/F16`）。
- 模型专属快照：`backend/backups/refactor_F16/models_init_before.py`（拆分前 `__init__.py` 原件）。
- 可重放工具：`backend/backups/refactor_F16/split_models.py`（AST 逐字切片，仅删除 class 块、保留模块级函数）。

## 3. 拆分映射（60 类 → 8 子模块）
| 子模块 | 承载模型（类数） |
|---|---|
| `user_models.py` | User, Admin, SubAccount, RolePermission, PermissionLog, AdminRole, Permission, RolePermissionMapping, RoleHierarchy, SecurityAudit, LoginAttempt（11） |
| `score_models.py` | ScoreCategory, Subject, ScoreRule, ScoreRecord, ScoreRankRule, Exam, Score, ClassPeriod, SubjectClass, CourseSchedule, CompositeScore, WarningConfig（12） |
| `device_models.py` | MQTTLog, MQTTConfig, ProcessedMessage, PhoneBoxPolicy, Device, DeviceHeartbeat, FirmwareVersion, DeviceFirmwareUpdate, DeviceGroup, DeviceGroupMapping（10） |
| `system_models.py` | OperationLog, SystemConfig, TimeRule, ClassInfo, AdminClass, ImportConfig, FrontendPerfMetric, FrontendErrorLog, SystemMetric, RateLimitRecord（10） |
| `notify_models.py` | Notification, Approval, NotifyAudit, ScheduledNotify, NotifyTemplate, NotifyHistory（6） |
| `alert_models.py` | Alert, StudentCluster（2） |
| `archive_models.py` | ScoreArchive, AttendanceArchive, OperationLogArchive（3） |
| `nlp_models.py` | NLPScoringRule, NLPBehaviorKeyword, NLPMatchResult, NLPRuleUsage, NLPModelTraining, NLPCorrection（6） |

`__init__.py` 仅保留：`db=SQLAlchemy()`、`cascade_delete_related_records`/`cascade_delete_user_related_records`/`is_bcrypt_hash`/`hash_password`/`get_by_id` 等辅助函数，及底部再导出块（既有 12 子模块 + 新增 8 子模块）。

## 4. 执行步骤与关键修正
1. 创建分支 `refactor/F16`，快照 `__init__.py`。
2. 编写 AST 切片脚本，按映射生成 8 子模块（逐字保留原注释，如 F9-B / R7 / 双 JWT 注解）。
3. **首版缺陷（已修复）**：脚本最初将 110–1361 区间整段删除，误删模块级函数 `get_by_id`（被 10+ 路由 `from models import get_by_id`），致 `create_app` 抛 `ImportError`。修正逻辑为"仅删除 class 块、保留其余模块级内容"，重跑后恢复。
4. 重跑切片，确认 `get_by_id` 仍在 `__init__.py`，内联类数归零。

## 5. 回滚方案
- 代码：`git checkout main`（放弃分支）；或 `cp backend/backups/refactor_F16/models_init_before.py backend/models/__init__.py` 并 `rm backend/models/{user,score,device,system,notify,alert,archive,nlp}_models.py`。
- DB：本重构不改表结构，无需 DB 回滚（沿用既有 `pre_upgrade_20260817` 拷贝即可）。

## 6. 全闸门验证（全绿，无回归）
| 闸门 | 结果 |
|---|---|
| py_compile（models/*） | ✅ 0 errors |
| create_app 冒烟（FLASK_ENV=development） | ✅ `CREATE_APP_OK`；RBAC 一致性 / Redis 连通 / 安全中间件 / API 缓存中间件 均 OK |
| OpenAPI strict | ✅ 461/461 路径 0 漂移 |
| 宽导入面 | ✅ academics/devices/users/monitoring/scores 路由 + utils.permission/security + nlp/ota/score 服务 全部导入 OK |
| 命名空间 0 回归 | ✅ 原 68 个顶层名（类+函数+常量）全部 `hasattr(models, x)` 通过 |
| 表名 0 漂移 | ✅ 显式 `__tablename__` 逐字保留；与 live DB 实际表名一致 |
| 前端 | ➖ 本次为后端纯结构重构，前端不受影响 |

## 7. 新约定（写入 MEMORY）
- 新增模型**必须**放入对应子模块（如分数→`score_models`、设备→`device_models`），**禁止**回写 `__init__.py` 内联。
- `__init__.py` 仅在底部新增 `from models.xxx import ...` 再导出，以维持 `from models import X` 兼容性。

## 8. 结论
F16（评估排期第一批）已一步到位完成并全闸门验证通过：模型层由单文件 1395 行拆为 1 个薄 `__init__.py` + 20 个子模块（既有 12 + 新增 8），命名空间与表结构零漂移，回滚路径完备。
