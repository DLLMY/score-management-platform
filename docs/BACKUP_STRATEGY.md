# SQLite 数据备份策略（P1-e）

> 适用对象：自托管 SQLite 部署（`apps/backend/instance/score_management.db` 单文件数据库）。
> 本文档为 `2026-09-22` P1-e 收口后的权威说明，取代 `docs/archive/doc/后端文档/备份指南.md`。

## 1. 数据文件位置

| 项 | 路径 |
| --- | --- |
| 数据库 | `apps/backend/instance/score_management.db` |
| 备份目录 | `apps/backend/backups/`（由 `BACKUP_DIR` 决定，已被 `.gitignore` 忽略） |

SQLite 为单文件数据库，备份本质是对该文件的原子副本 + 元数据打包。

## 2. 三条备份路径

### 2.1 自动定时备份（推荐生产开启）
- 实现：`app/service_init.py::init_scheduler` 用 APScheduler 注册 `cron 02:00` 任务 → `_scheduled_backup_job` → `BackupManager.create_backup("full")`。
- **权威开关：`BACKUP_ENABLED` 环境变量（默认 `false`）。**
  - `BACKUP_ENABLED=true`：启动时为自动备份注册 02:00 cron。
  - `BACKUP_ENABLED=false`（默认）：**不注册**自动备份任务，`_scheduled_backup_job` 运行时也会二次兜底拦截。
  - 此前该 cron 无条件注册、`BACKUP_ENABLED` 形同虚设（已修复）。
- 保留策略清理：`cron 03:00` 任务 → `clean_old_backups(max_count=BACKUP_MAX_COUNT)`，**无条件运行**（防御性，防止磁盘膨胀，即使自动备份关闭，手动产生的备份也会被清理）。

### 2.2 手动 API 备份
- 创建：`POST /api/import_export/backup/create?type=full`（`type` ∈ `full|incremental|data_only`）
- 列表：`GET  /api/import_export/backup/list`
- 统计：`GET  /api/import_export/backup/stats`
- 恢复：`POST /api/import_export/backup/restore/<filename>`
- 删除：`DELETE /api/import_export/backup/delete/<filename>`（含路径穿越防护）
- 清理：`POST /api/import_export/backup/clean_old`
- 系统端点（独立实现）：`POST /api/system/backup`、`GET /api/system/backups`
- 以上均不受 `BACKUP_ENABLED` 限制，管理员可随时手动备份/恢复。

### 2.3 CLI 脚本（compose cron / 系统计划任务）
- 脚本：`apps/backend/scripts/backup_db.py`
- 用法：
  ```bash
  cd apps/backend
  python scripts/backup_db.py backup            # 默认动作，复制 .db 到 backups/
  python scripts/backup_db.py list              # 列出 .db 备份
  python scripts/backup_db.py restore backups/score_management_backup_YYYYMMDD_HHMMSS.db
  python scripts/backup_db.py help
  ```
- 适用于不想启用应用内 cron、而用外部调度（Docker `cron` / Windows 任务计划 / systemd timer）的场景。

## 3. 配置项（`apps/backend/config.py`）

| 变量 | 含义 | 默认 |
| --- | --- | --- |
| `BACKUP_ENABLED` | 是否启用应用内自动备份（02:00 cron） | `false` |
| `BACKUP_INTERVAL_HOURS` | 文档保留字段（当前应用内 cron 固定每日 02:00） | `24` |
| `BACKUP_MAX_COUNT` | 保留备份份数上限，超出删最旧 | `10` |
| `BACKUP_DIR` | 备份根目录 | `apps/backend/backups` |

> `BackupManager` 默认 `retention_days=30`：清理任务同时按"超过 30 天"与"超过 `BACKUP_MAX_COUNT` 份"双规则删除。

## 4. 恢复步骤（重要）
1. **先停止后端服务**（SQLite 不支持热替换，运行中复制回写会损坏）。
2. 用 API `restore` 或 CLI `restore` 将备份覆盖回 `instance/score_management.db`。
3. 重启服务。
4. 应用内自动备份在恢复前会自动留一份 `pre_restore_*.db` 兜底。

## 5. legacy 调度 API 说明（避免混淆）
`/api/import_export/backup/schedule/{enable,disable,status,set_time}` 控制的是一个**内存中的 `BackupScheduler` 实例**，该实例**并未接入**真实 APScheduler cron。因此：
- 真实自动备份的唯一权威开关是 **`BACKUP_ENABLED` 环境变量**（启动时决定）。
- 上述 4 个端点的 `status` 现在如实返回 `enabled = Config.BACKUP_ENABLED` 与真实 cron 时间；`enable/disable/set_time` 仅置位内存标记并返回说明，**不影响**已注册的 cron。
- 如需改自动备份时间，请在部署层（compose cron / 系统计划任务）调整，而非调用 `set_time`。

## 6. Docker Compose 外部定时备份示例
不启用应用内 cron 时，可在 `ops/infra/docker-compose.yml` 增加：
```yaml
  backup-cron:
    image: alpine:3.20
    volumes:
      - ./apps/backend/instance:/data/db
      - ./apps/backend/backups:/data/backups
    entrypoint: |
      sh -c 'while true; do
        cp /data/db/score_management.db /data/backups/score_management_backup_$(date +%Y%m%d_%H%M%S).db;
        ls -t /data/backups/*.db | tail -n +11 | xargs -r rm -f;
        sleep 86400; done'
```
或挂载宿主机 cron 直接调用 `python scripts/backup_db.py backup`。

---
变更记录：
- 2026-09-22：P1-e 收口——`BACKUP_ENABLED` 真正门控自动备份 cron；`_scheduled_backup_job` 加运行时兜底；legacy `/backup/schedule/*` 端点如实反映权威状态；本文档建立。
