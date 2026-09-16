"""非破坏性修复 dev 库模式漂移：为缺失列 ALTER TABLE ADD COLUMN。

仅添加列、不删不改现有数据。对带 server_default 的列回填合理默认值。
"""
import sys, os
_PROJ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_BACKEND = os.path.join(_PROJ, "apps", "backend")
sys.path.insert(0, _BACKEND)
os.chdir(_BACKEND)
from app import create_app
from sqlalchemy import inspect as sa_inspect, text
from sqlalchemy.dialects import sqlite as sqlite_dialect

# (表, 列名) -> 回填的默认值 SQL（无则 None）
BACKFILL = {
    ("firmware_versions", "device_type"): "'phonebox'",
    ("firmware_versions", "is_stable"): "0",
    ("firmware_versions", "rollback_to"): None,
    ("system_config", "device_whitelist_enabled"): "0",
    ("device", "device_secret"): None,
    ("device", "secret_issued_at"): None,
    ("device", "last_seen_ts"): None,
}

app = create_app()
dialect = sqlite_dialect.dialect()
with app.app_context():
    sa = app.extensions.get("sqlalchemy")
    insp = sa_inspect(sa.engine)
    md = sa.metadata

    added, backfilled = [], []
    with sa.engine.begin() as conn:
        for t in md.sorted_tables:
            tname = t.name
            try:
                db_cols = {c["name"] for c in insp.get_columns(tname)}
            except Exception:
                continue
            for col in t.columns:
                if col.name in db_cols:
                    continue
                # 加列：用模型类型，强制可空以规避 SQLite NOT NULL 限制
                type_sql = col.type.compile(dialect=dialect)
                ddl = f'ALTER TABLE "{tname}" ADD COLUMN "{col.name}" {type_sql}'
                try:
                    conn.execute(text(ddl))
                    added.append(f'{tname}.{col.name} ({type_sql})')
                except Exception as e:
                    print(f"[ERROR] add {tname}.{col.name}: {e}")
                    continue
                # 回填默认值
                bf = BACKFILL.get((tname, col.name))
                if bf is not None:
                    try:
                        conn.execute(text(f'UPDATE "{tname}" SET "{col.name}" = {bf} WHERE "{col.name}" IS NULL'))
                        backfilled.append(f'{tname}.{col.name} = {bf}')
                    except Exception as e:
                        print(f"[WARN] backfill {tname}.{col.name}: {e}")

    # 复核
    remaining = []
    for t in md.sorted_tables:
        tname = t.name
        try:
            db_cols = {c["name"] for c in insp.get_columns(tname)}
        except Exception:
            continue
        for col in t.columns:
            if col.name not in db_cols:
                remaining.append(f"{tname}.{col.name}")

    print("=== ADDED ===")
    print("\n".join(added) or "(none)")
    print("=== BACKFILLED ===")
    print("\n".join(backfilled) or "(none)")
    print("=== REMAINING DRIFT ===")
    print("\n".join(remaining) or "NONE — drift resolved")
