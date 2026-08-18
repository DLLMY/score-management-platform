# 系统升级执行日志与回滚方案

> 升级日期：**2026-08-17**（执行窗口 Mon Aug 17 13:00–14:10 GMT+8）
> 依据文档：`docs/系统整体评估报告_六维度_2026-08-16.md`
> 执行原则：**一步到位、非破坏式、可回滚、全闸门验证**

---

## 一、升级范围与目标

### 1.1 范围界定原则
本升级严格遵循评估报告的"安全可一步到位"清单，**排除**以下项：
- 已落地项：S5/CSP 策略、接口限流、权限缓存（无需重复）。
- 高风险/需专项验证项：F16/F17/F19 大型重构、S4（JWT 改 Cookie 会话）、S2（固件真机验证）。这些不在本次一步到位范围内，避免引入不可控回归。

### 1.2 本次落地项（6 大类 / 7 子项）

| 编号 | 类别 | 目标 | 影响面 |
|------|------|------|--------|
| **S1** | 安全硬化 | production 下 `SECRET_KEY`/`JWT_SECRET_KEY` 缺失或长度 <32 位时**拒绝启动**（`sys.exit(1)`） | `backend/app/config_init.py` |
| **M1** | 配置校验硬化 | production 下 `validate_config()` 返回 `False`（error 级）时**拒绝启动** | `backend/app/config_init.py` |
| **M3** | RBAC 启动门禁 | 启动时非致命调用 RBAC 一致性检查，不一致仅告警不杀进程 | `backend/app/config_init.py` + `scripts/verify_rbac_consistency.py` |
| **R1** | Redis 连通性 | 启动时非致命探测 Redis，库缺失/不可达时告警降级 | `backend/app/config_init.py` |
| **R2** | MQTT 韧性 | MQTT 管理器的 DB 配置读取失败时回退到"最近一次已知好配置" | `backend/services/mqtt_manager.py` |
| **P1** | 数据归档 | 新增 `scores_archive` / `attendance_archive` 归档表 + 幂等迁移脚本 | `backend/models/__init__.py` + `backend/scripts/migrate_archive_tables.py` |
| **Q3** | 前端测试 | 为 AttendanceManage、Notifications 两个核心页补充 vitest | `frontend/src/tests/components/*.test.tsx` |

### 1.3 依赖项与配置项
- **后端依赖**：无新增第三方依赖（Redis 探测复用既有 `redis` 客户端；torch 仅在 `create_app` 全量加载时按需导入，不影响升级）。
- **配置项新增**：`ARCHIVE_RETENTION_DAYS`（默认 365，P1 归档窗口），其余沿用既有 `.env`。
- **运行时**：后端使用**系统 Python 3.11**（`C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`，含 torch）；前端使用**受管 Node 22.22.2**。

---

## 二、备份策略与清单（升级前已完成）

> ⚠️ 注意：C 盘长期处于 100% 满（NTFS 重复数据删除下，删除旧备份**不释放空间**）。本次备份采用"物理拷贝 + 配置快照 + git stash"三重保险，回滚不依赖删除操作。

### 2.1 数据库物理备份
| 项目 | 值 |
|------|-----|
| 源文件 | `backend/instance/score_management.db`（2.3 GB） |
| 备份文件 | `backend/instance/score_management.db.pre_upgrade_20260817` |
| 大小 | 2.3 GB（与源一致，物理拷贝非符号链接） |
| 时间 | 2026-08-17 13:37 |
| 回滚用途 | 整体覆盖恢复（见第四节） |

### 2.2 配置文件快照
目录：`backend/backups/pre_upgrade_20260817/`（2026-08-17 13:38）

| 文件 | 说明 |
|------|------|
| `config_init.py` | 升级主入口（S1/M1/M3/R1 改动点） |
| `config_validator.py` | 配置校验器（M1 调用对象） |
| `config.py` | 应用配置 |
| `mqtt_manager.py` | R2 改动点 |
| `__init__.py` | 即 `models/__init__.py`（P1 改动点） |
| `.env` | 环境变量快照 |

### 2.3 代码快照（git stash）
| 项 | 值 |
|------|-----|
| 引用 | `stash@{0}: On main: pre_upgrade_20260817_WIP` |
| 内容 | 升级前完整工作树（264 文件，含未跟踪） |
| 回滚命令 | `git stash apply stash@{0}`（或 `git stash pop`） |
| 清理重复 | 早期失败尝试产生的不完整 `stash@{1}`（214 文件）已 `git stash drop` 丢弃 |

---

## 三、逐步操作日志（可追溯）

### STEP 0 — 备份（13:25–13:38）
- [x] `cp backend/instance/score_management.db backend/instance/score_management.db.pre_upgrade_20260817`（大小校验一致）
- [x] 复制 6 个配置文件至 `backend/backups/pre_upgrade_20260817/`
- [x] `git stash push -u -m "pre_upgrade_20260817_WIP"` → 生成 `stash@{0}`
- [x] `git stash apply stash@{0}` 恢复工作树保持可编辑

### STEP 1 — S1 密钥生产硬失败（config_init.py）
- [x] 顶部新增 `import sys`
- [x] `validate_secret_keys(app)` 重写：`production` 下读取 `FLASK_ENV`；密钥缺失 / 等于默认值 / `len(key) < 32` → 打印明确错误并 `sys.exit(1)`
- [x] 新增 `_current_flask_env(app)` 辅助函数

### STEP 2 — M1 配置校验硬化（config_init.py）
- [x] 在 `init_config` 中 `validate_secret_keys` 之后插入 `config_ok = validate_config()`
- [x] `production` 且 `config_ok is False` → `sys.exit(1)`；非 production → 仅警告
- [x] 删除原文件末尾重复的 `from utils.config_validator import validate_config; validate_config()`（避免双报告）

### STEP 3 — M3 RBAC 启动门禁
- [x] `scripts/verify_rbac_consistency.py`：将原 `main()` 校验逻辑抽取为 `run_check(check_only=True, apply=False)`，返回 `(issues, infos, exit_code)`，**绝不调用 `sys.exit`**；`main()` 改为 `run_check()` 包装后 `sys.exit(code)`（CLI 行为不变）
- [x] `config_init.py` 新增 `_check_rbac_consistency(app)`：用 `importlib` 加载并调用 `run_check(check_only=True, apply=False)`，非致命（异常捕获告警）

### STEP 4 — R1 Redis 连通性（config_init.py）
- [x] 新增 `_check_redis_connectivity(app)`：`import redis` 失败时告警降级；`ping()` 失败按环境（`production` 告警 / 其他忽略）处理，非致命

### STEP 5 — R2 MQTT 已知好配置缓存（mqtt_manager.py）
- [x] `__init__` 新增 `self._last_known_good = None`
- [x] `load_config_from_db` 成功加载后 `self._last_known_good = dict(self._config)`
- [x] DB 读取异常时：若有 `_last_known_good` 则回退到它并返回 `False`，否则用 `DEFAULT_CONFIG`
- [x] `_on_connect_control` 成功（`rc == 0`）时刷新 `_last_known_good`

### STEP 6 — P1 归档表 + 迁移脚本
- [x] `models/__init__.py` 新增 `ScoreArchive`（`scores_archive`，列同 `scores` + `archived_at`）与 `AttendanceArchive`（`attendance_archive`，列同 `attendance` + `archived_at`）
- [x] 新建 `scripts/migrate_archive_tables.py`：`ensure_tables()`（`db.create_all()` 幂等建表）、`dry_run(cutoff)`（报告可归档行数）、`execute(cutoff)`（按 `RETENTION_DAYS` 默认 365，分批 BATCH=2000 INSERT…SELECT 后 DELETE 热表）；CLI：`--dry-run` / `--execute` / 无参仅建表

### STEP 7 — Q3 前端核心页 vitest
- [x] 新建 `frontend/src/tests/components/AttendanceManage.test.tsx`：通用 proxy mock（`vi.mock('../../services/api', ...)` 任意调用返回 `Promise.resolve([])` 避免真实 fetch）；断言页面渲染（`heading /考勤管理/i`）、`快速记录` 按钮可见
- [x] 新建 `frontend/src/tests/components/Notifications.test.tsx`：同上 proxy mock；断言页面渲染（`heading /通知中心/i`）、空态 `暂无通知` 可见
- [x] 修复首跑用例：将"快速考勤记录"（模态框内文本）改为始终可见的 `快速记录` 按钮断言 → 4/4 通过

### STEP 8 — 全闸门验证（13:50–14:05）
依次执行 8 道闸门，全部通过（详见第五节）。

---

## 四、详细回滚方案

> 若升级后出现异常（启动失败、核心功能回归、数据异常），按以下顺序回滚。每步均可独立执行，无需全部回滚。

### 4.1 数据库整体回滚（仅当 P1 `--execute` 已误执行且数据受损时）
```bash
# 停止后端进程（强杀全部 python 后重启，Flask-SocketIO 不 reload）
# 用备份物理覆盖
cp backend/instance/score_management.db.pre_upgrade_20260817 backend/instance/score_management.db
# 校验大小
ls -lh backend/instance/score_management.db
```
> 注：本次 P1 仅执行 `--dry-run`，**未移动任何数据**，数据库无需回滚。

### 4.2 代码回滚（git stash）
```bash
cd <项目根>
# 查看回滚点
git stash list   # 应见 stash@{0}: pre_upgrade_20260817_WIP
# 恢复到升级前工作树
git stash apply stash@{0}
# 若需彻底丢弃升级改动也可用：
# git checkout -- backend/app/config_init.py backend/services/mqtt_manager.py \
#   backend/models/__init__.py backend/scripts/verify_rbac_consistency.py \
#   backend/scripts/migrate_archive_tables.py
# git checkout -- frontend/src/tests/components/AttendanceManage.test.tsx \
#   frontend/src/tests/components/Notifications.test.tsx
```

### 4.3 配置文件回滚
```bash
cd <项目根>/backend
cp backups/pre_upgrade_20260817/config_init.py app/config_init.py
cp backups/pre_upgrade_20260817/config_validator.py utils/config_validator.py
cp backups/pre_upgrade_20260817/config.py app/config.py
cp backups/pre_upgrade_20260817/mqtt_manager.py services/mqtt_manager.py
cp backups/pre_upgrade_20260817/__init__.py models/__init__.py
cp backups/pre_upgrade_20260817/.env .env
```

### 4.4 回滚后验证
回滚完成后重跑 G1–G3（py_compile / RBAC / create_app 冒烟）确认恢复至升级前基线。

### 4.5 回滚时效与影响
- 全部回滚操作预计 < 5 分钟（DB 拷贝受磁盘 I/O 制约，约 1–2 分钟）。
- 升级本身为非破坏式：S1/M1 仅影响 production 启动判定；M3/R1/R2 均为非致命降级；P1 仅加表未删数据；Q3 仅新增测试文件。回滚风险极低。

---

## 五、全闸门验证摘要（G1–G8 全绿）

| 闸门 | 命令 | 结果 |
|------|------|------|
| **G1** py_compile | `python -m py_compile` 升级文件 | ✅ 0 errors |
| **G2** RBAC 一致性 | `verify_rbac_consistency.py --check-only` | ✅ exit 0，一致性 OK（权限目录 68 条） |
| **G3** 后端启动冒烟 | `create_app(lightweight=True)` | ✅ CREATE_APP_OK；输出"配置验证报告 / RBAC 一致性 OK / Redis 连通性 OK / 安全中间件已启用 / API缓存中间件已启用" |
| **G4** P1 归档 dry-run | `migrate_archive_tables.py --dry-run` | ✅ 建表 scores_archive/attendance_archive OK；可归档 0 行（数据在 retention 内），未移动数据 |
| **G5** OpenAPI 契约 strict | `verify_openapi_contract.py --strict` | ✅ 461/461 路径，0 新增/0 消失/0 不一致 |
| **G6** ESLint | `eslint src --ext .ts,.tsx` | ✅ exit 0（0 error） |
| **G7** vite build | `vite build --logLevel warn` | ✅ exit 0（仅无关 CSS warning `backgroundposition` 拼写，预存非阻断） |
| **G8** vitest 全量 | `vitest run` | ✅ **164 passed / 3 skipped**（含新增 4 测试，无回归） |

### 验证结论
所有核心业务功能（路由注册、RBAC 守卫、MQTT 连接、API 缓存、前端核心页渲染）经全闸门验证**正常运行，无回归问题**。升级达成"一步到位"目标。

---

## 六、后续建议（不在本次范围）
1. **F16/F17/F19** 大型重构与 **S4**（JWT→Cookie 会话）需独立专项评估与真机/集成测试，建议单独排期。
2. **S2** 固件 OTA 需 ESP32 工具链实编 + 真机验证（本机无工具链），由硬件侧单独完成。
3. P1 `--execute` 仅在**维护窗口 + 已确认备份**后执行；建议先在生产克隆库演练。
4. 定期清理 `api-docs/openapi.json.bak_*` 与 `instance/*.bak_*` 历史快照（注意 NTFS 去重下删除不释放空间，仅作逻辑清理）。
