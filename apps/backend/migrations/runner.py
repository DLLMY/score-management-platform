# -*- coding: utf-8 -*-
"""【已弃用 / 仅供运维参考】手写迁移脚本编排器。

重要（P0-d 设计变更）
--------------------
真实 schema 由 SQLAlchemy 模型 + `db.create_all()` 维护；既有 18 个手写迁移脚本长期
未纳入部署且部分已损坏（如 `from app import db` 符号不存在、对 SQLite 不支持的
`ALTER COLUMN` 整表重建）。因此生产启动已**不再**调用本编排器。

ACTIVE 路径：`app/db_init.init_database` 内的 `migrations.reconcile.ensure_database_ready`
——依据模型 metadata 与线上库 diff，幂等补全缺失表/列/索引（`reconcile_schema`），
并幂等补齐关键种子数据（`seed_defaults`）。该路径自动覆盖未来任何模型演进，无需再写脚本。

本模块仅保留作历史审计：脚本清单与 `schema_migrations` 记账逻辑可供排查"既有库曾应用过哪些
手写迁移"。如需手动对齐历史库，可 `python -m migrations.runner` 触发（best-effort，不保证
全部成功）。
"""
import importlib
import os
import sqlite3
import sys
from datetime import datetime, timezone

# 让 `python migrations/runner.py` 独立运行时也能 import 同级模块与项目根
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# 固定执行顺序。脚本均幂等，顺序仅影响执行效率，不影响正确性；
# 排列遵循"先建表/种子 → 再补列 → 最后补索引"的依赖直觉。
MIGRATIONS = [
    "fix_database_schema",            # 建 scheduled_notify、补 admin 列与索引
    "create_class_periods",           # 建 class_periods 并种子默认节次
    "create_course_schedule",         # 建 course_schedule 表
    "create_exam_subjects_table",      # 建 exam_subjects 表
    "add_rbac",                       # 建 RBAC 三表
    "add_class_management_modules",    # 班级治理模块字段/表
    "add_primary_class_id",            # admin/sub_account 主班级外键列（import 即执行）
    "add_foreign_keys",                # 外键探测（import 即执行）
    "add_head_teacher_id",             # class_info.head_teacher_id
    "add_user_id_to_operation_log",    # operation_log.user_id（import 即执行）
    "add_operation_log_id",            # operation_log.id 收敛
    "add_device_group",                # 设备分组表
    "add_device_indexes",              # device_heartbeat 索引
    "add_device_auth_fields",          # 设备认证密钥列（sqlite3 直连）
    "add_user_risk_fields",            # user 风险评分列（sqlite3 直连）
    "add_firmware_device_type",        # firmware_versions device_type 等（sqlite3 直连）
    "score_change_float",              # score_change 金额改 float
    "migrate_algorithm",               # 预警配置种子
]

SCHEMA_MIGRATIONS_TABLE = "schema_migrations"


def resolve_db_path():
    """解析 SQLite 数据库路径，与 config.py 规则保持一致。

    - 优先环境变量 DATABASE_URI（sqlite:///...）：与生产/容器挂载路径对齐；
    - 未设置则回退到 <backend_root>/instance/score_management.db（历史默认）。
    """
    uri = os.getenv("DATABASE_URI")
    if uri and uri.startswith("sqlite:///"):
        path = uri[len("sqlite:///"):]
        if not os.path.isabs(path):
            path = os.path.join(BACKEND_ROOT, path)
        return path
    return os.path.join(BACKEND_ROOT, "instance", "score_management.db")


def _ensure_tracking_table(conn):
    conn.execute(
        "CREATE TABLE IF NOT EXISTS {} ("
        "name TEXT PRIMARY KEY, applied_at TEXT)".format(SCHEMA_MIGRATIONS_TABLE)
    )
    conn.commit()


def _record(conn, name):
    conn.execute(
        "INSERT OR IGNORE INTO {} (name, applied_at) VALUES (?, ?)".format(SCHEMA_MIGRATIONS_TABLE),
        (name, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()


def _applied_set(conn):
    rows = conn.execute("SELECT name FROM {}".format(SCHEMA_MIGRATIONS_TABLE)).fetchall()
    return {r[0] for r in rows}


def run_all_migrations(logger=None, verbose=True):
    """按顺序执行全部迁移并记录。返回 (applied, skipped, errors) 计数。

    logger: 可选，签名为 (level: str, msg: str) 的回调；缺省打印到 stdout。
    verbose: 是否打印进度（生产入口通常传 False，改用 logger）。
    """
    def log(level, msg):
        if logger:
            logger(level, msg)
        elif verbose:
            print(msg)

    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    try:
        _ensure_tracking_table(conn)
        applied0 = _applied_set(conn)
        applied = skipped = errors = 0
        for name in MIGRATIONS:
            try:
                mod = importlib.import_module("migrations.{}".format(name))
                fn = getattr(mod, "run_migration", None)
                if fn is not None:
                    try:
                        fn(db_path=db_path)
                    except TypeError:
                        # 兼容未声明 db_path 形参的脚本（仅 app db 型）
                        fn()
                # import 即执行型脚本已在 import 时跑过，此处统一记账
                if name not in applied0:
                    _record(conn, name)
                    applied += 1
                else:
                    skipped += 1
                log("INFO", "[MIG] 已应用/确认: {}".format(name))
            except Exception as e:  # noqa: BLE001
                errors += 1
                log("ERROR", "[MIG] 迁移失败: {} -> {}".format(name, e))
        log(
            "INFO",
            "[MIG] 完成：新增应用 {}，已存在跳过 {}，失败 {}".format(applied, skipped, errors),
        )
        return applied, skipped, errors
    finally:
        conn.close()


def list_migrations():
    """返回 (pending, applied) 列表，便于运维在不执行的情况下查看状态。"""
    conn = sqlite3.connect(resolve_db_path())
    try:
        _ensure_tracking_table(conn)
        applied = _applied_set(conn)
    finally:
        conn.close()
    applied_list = [m for m in MIGRATIONS if m in applied]
    pending = [m for m in MIGRATIONS if m not in applied]
    return pending, applied_list


if __name__ == "__main__":
    applied, skipped, errors = run_all_migrations()
    if errors:
        sys.exit(1)
