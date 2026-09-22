# -*- coding: utf-8 -*-
"""元数据驱动的模式对账器（生产就绪 P0-d 收口；替代脆弱的手写迁移脚本）。

为什么不再手工编排 migrations/*.py
------------------------------
既有 18 个迁移脚本长期"手工执行、未纳入部署"，且多数为脆弱的 SQLite 手写 DDL：
- `from app import db` 根本不存在该符号（db 在 models）；
- 对 SQLite 不支持的 `ALTER COLUMN` 做整表重建，且对"全新库"盲目 ALTER 失败；
- 依赖人工 `python migrations/x.py`，部署极易漏跑 → 既有库缺列 → 运行期报错。
真实可运行的 schema 由 SQLAlchemy 模型 + `db.create_all()` 维护。

本对账器依据模型 metadata 与线上库做 diff，自动补全缺失的表/列/索引：
- 幂等：缺失才补、已有则跳过；
- 零外部依赖：不引入 Alembic（其基线/升降级在无法访问真实生产库时风险高）；
- 自动作用于 DATABASE_URI 指向的库（开发与生产一致）；
- 未来任何模型 schema 演进（新增列/表/索引）无需再写迁移脚本，重启即自动收敛。

已知限制：SQLite `ADD COLUMN` 不支持同时加主键/外键/唯一约束，这类列会被跳过并告警
（需手工一次性脚本或表重建），普通可空/带默认列均自动补全。
"""
import os
import sqlite3
from datetime import datetime, timezone

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def _compile_type(col, engine):
    try:
        return col.type.compile(dialect=engine.dialect)
    except Exception:  # noqa: BLE001
        # SQLite 动态类型，退化为类名也安全
        return col.type.__class__.__name__


def reconcile_schema(app, logger=None, verbose=True):
    """依据模型 metadata 与线上库对账，补全缺失的表/列/索引。

    返回 (added_tables, added_columns, added_indexes)。调用方需处于/已建立应用上下文。
    """
    from sqlalchemy import inspect, text
    from models import db

    def log(level, msg):
        if logger:
            logger(level, msg)
        elif verbose:
            print(msg)

    engine = db.engine
    metadata = db.metadata
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    model_tables = metadata.tables

    added_tables = added_columns = added_indexes = 0

    # 1) 缺失的表：用 metadata 创建（checkfirst 保证幂等）
    missing = [t for t in model_tables if t not in existing_tables]
    if missing:
        try:
            db.metadata.create_all(
                bind=engine,
                tables=[model_tables[t] for t in missing],
                checkfirst=True,
            )
            added_tables = len(missing)
            log("INFO", "[RECONCILE] 新建表 %d 张: %s" % (added_tables, ", ".join(missing)))
        except Exception as e:  # noqa: BLE001
            log("ERROR", "[RECONCILE] 建表失败: %s" % e)

    # 2) 既有表缺失的列：ALTER TABLE ADD COLUMN（SQLite 不支持 ALTER COLUMN，仅新增）
    for tname, table in model_tables.items():
        if tname not in existing_tables:
            continue
        try:
            db_cols = {c["name"] for c in inspector.get_columns(tname)}
        except Exception:  # noqa: BLE001
            continue
        for col in table.columns:
            if col.name in db_cols:
                continue
            if col.primary_key or col.foreign_keys or col.unique:
                log(
                    "WARNING",
                    "[RECONCILE] 跳过需手工处理的列 %s.%s（含 PK/FK/UNIQUE，SQLite ADD COLUMN 不支持）"
                    % (tname, col.name),
                )
                continue
            try:
                type_str = _compile_type(col, engine)
                ddl = "ALTER TABLE %s ADD COLUMN %s %s" % (tname, col.name, type_str)
                with engine.connect() as conn:
                    conn.execute(text(ddl))
                    conn.commit()
                added_columns += 1
                if not col.nullable:
                    log(
                        "WARNING",
                        "[RECONCILE] 列 %s.%s 模型为 NOT NULL，但 SQLite ADD COLUMN 已按可空添加"
                        "（请确认应用层始终赋值，或手工补 NOT NULL）" % (tname, col.name),
                    )
                else:
                    log("INFO", "[RECONCILE] +列 %s.%s" % (tname, col.name))
            except Exception as e:  # noqa: BLE001
                log("ERROR", "[RECONCILE] 加列失败 %s.%s: %s" % (tname, col.name, e))

    # 3) 缺失的索引：按 metadata 创建
    for tname, table in model_tables.items():
        if tname not in existing_tables:
            continue
        try:
            db_indexes = {ix["name"] for ix in inspector.get_indexes(tname)}
        except Exception:  # noqa: BLE001
            continue
        for idx in table.indexes:
            if idx.name in db_indexes:
                continue
            try:
                with engine.connect() as conn:
                    idx.create(bind=conn)
                    conn.commit()
                added_indexes += 1
                log("INFO", "[RECONCILE] +索引 %s" % idx.name)
            except Exception as e:  # noqa: BLE001
                log("ERROR", "[RECONCILE] 建索引失败 %s: %s" % (idx.name, e))

    _record_run(engine, added_tables, added_columns, added_indexes)
    log(
        "INFO",
        "[RECONCILE] 完成：+表 %d，+列 %d，+索引 %d" % (added_tables, added_columns, added_indexes),
    )
    return added_tables, added_columns, added_indexes


def ensure_database_ready(app, logger=None, verbose=True):
    """生产启动统一入口：先按模型 metadata 对账补全 schema，再幂等补齐种子数据。

    这是 P0-d 的鲁棒主体（替代脆弱的手写迁移脚本链路）。返回 (tables, columns, indexes, periods, configs)。
    调用方需在应用上下文中；建议在 `if not app.config.get("TESTING")` 守卫下调用，
    避免污染测试库（测试库由 conftest 自行构造）。
    """
    # 延迟导入种子模块，避免 `python migrations/reconcile.py` 以脚本方式运行时
    # 在模块加载期因 backend 根尚未入 sys.path 而 ImportError。
    from migrations.seed_defaults import seed_defaults

    added_tables, added_columns, added_indexes = reconcile_schema(app, logger=logger, verbose=verbose)
    added_periods, added_configs = seed_defaults(app, logger=logger, verbose=verbose)
    if logger:
        logger(
            "INFO",
            "[RECONCILE] 数据库就绪：+表 %d，+列 %d，+索引 %d，+节次 %d，+预警配置 %d"
            % (added_tables, added_columns, added_indexes, added_periods, added_configs),
        )
    return added_tables, added_columns, added_indexes, added_periods, added_configs


def _record_run(engine, tables, columns, indexes):
    """记录最近一次对账结果，便于运维审计（单行覆盖写）。"""
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS schema_migrations "
                    "(name TEXT PRIMARY KEY, applied_at TEXT, detail TEXT)"
                )
            )
            conn.execute(
                text(
                    "INSERT OR REPLACE INTO schema_migrations (name, applied_at, detail) "
                    "VALUES (:n, :t, :d)"
                ),
                {
                    "n": "schema_reconcile",
                    "t": datetime.now(timezone.utc).isoformat(),
                    "d": "tables=%d,columns=%d,indexes=%d" % (tables, columns, indexes),
                },
            )
            conn.commit()
    except Exception:  # noqa: BLE001
        pass


if __name__ == "__main__":
    import sys

    sys.path.insert(0, BACKEND_ROOT)
    from app import create_app

    flask_app = create_app(lightweight=True)
    with flask_app.app_context():
        reconcile_schema(flask_app, verbose=True)
