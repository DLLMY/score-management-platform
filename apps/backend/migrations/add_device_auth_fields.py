# -*- coding: utf-8 -*-
"""差异 #4 迁移：设备认证凭证列 + 白名单开关列。

幂等：已存在的列/索引会被跳过。直接使用 sqlite3 连接，不 import app，
避免触发应用启动时的索引优化等副作用（与 add_user_risk_fields.py 同范式）。

新增：
    device.device_secret       TEXT    设备密钥（NULL = 未发放，验签放行）
    device.secret_issued_at    DATETIME
    device.last_seen_ts        BIGINT  最近上行时间戳（防重放基线）
    system_config.device_whitelist_enabled  BOOLEAN NOT NULL DEFAULT 0
"""

import os
import sqlite3
import sys

DEFAULT_DB = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance", "score_management.db"
)

ADDITIONS = [
    ("device", "device_secret", "VARCHAR(64)"),
    ("device", "secret_issued_at", "DATETIME"),
    ("device", "last_seen_ts", "BIGINT"),
    (
        "system_config",
        "device_whitelist_enabled",
        "BOOLEAN NOT NULL DEFAULT 0",
    ),
]


def existing_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def run_migration(db_path=None):
    db_path = db_path or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB)
    if not os.path.exists(db_path):
        print(f"FAIL: 数据库不存在 {db_path}")
        return 1

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    added, skipped = [], []

    for table, column, ddl in ADDITIONS:
        cols = existing_columns(cursor, table)
        if not cols:
            print(f"WARN: 表 {table} 不存在，跳过 {column}")
            skipped.append(f"{table}.{column}")
            continue
        if column in cols:
            skipped.append(f"{table}.{column}")
            continue
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
        added.append(f"{table}.{column}")

    conn.commit()

    # 复验
    verify = {}
    for table, column, _ in ADDITIONS:
        verify[f"{table}.{column}"] = column in existing_columns(cursor, table)
    conn.close()

    print(f"数据库: {db_path}")
    print(f"新增列: {added or '（无）'}")
    print(f"已存在跳过: {skipped or '（无）'}")
    all_ok = all(verify.values())
    for k, v in verify.items():
        print(f"  复验 {k}: {'OK' if v else 'MISSING'}")
    print("RESULT:", "PASS" if all_ok else "FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
