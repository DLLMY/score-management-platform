#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""差异 #1 / #2：firmware_versions 表增加 device_type / is_stable / rollback_to 三列。

执行: python migrations/add_firmware_device_type.py

设计要点：
- 直连 sqlite3，不 import app —— 避免 app 启动时的索引优化等副作用干扰迁移
  （与 migrations/add_user_risk_fields.py 同范式）。
- 三列全部以 ADD COLUMN 方式追加，SQLite 原生支持。
  其中 device_type NOT NULL DEFAULT 'phonebox'、is_stable NOT NULL DEFAULT 0
  使**所有历史行自动获得安全默认值**，无需数据回填即可满足模型约束。
- 幂等：重复执行会检测列是否已存在并跳过，不报错。
- 只加列、不改列、不删列，可安全在生产库执行。
"""

import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# (列名, 列定义) —— 顺序即 DDL 执行顺序
NEW_COLUMNS = [
    ("device_type", "VARCHAR(50) NOT NULL DEFAULT 'phonebox'"),
    ("is_stable", "BOOLEAN NOT NULL DEFAULT 0"),
    ("rollback_to", "VARCHAR(50)"),
]

INDEX_NAME = "ix_firmware_versions_device_type"
INDEX_DDL = f"CREATE INDEX {INDEX_NAME} ON firmware_versions (device_type)"


def _table_exists(cursor, table):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cursor.fetchone() is not None


def _existing_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cursor.fetchall()]


def _existing_indexes(cursor, table):
    cursor.execute(f"PRAGMA index_list({table})")
    return [row[1] for row in cursor.fetchall()]


def _add_missing_columns(cursor, cols):
    """逐列 ADD COLUMN，已存在则跳过；返回新增列数。"""
    changed = 0
    for name, ddl in NEW_COLUMNS:
        if name in cols:
            print(f"[SKIP] 列已存在: {name}")
            continue
        stmt = f"ALTER TABLE firmware_versions ADD COLUMN {name} {ddl}"
        print(f"[ADD ] {stmt}")
        cursor.execute(stmt)
        changed += 1
    return changed


def _ensure_device_type_index(cursor):
    """确保 device_type 索引存在；已存在则跳过。存在返回 0，新增返回 1。"""
    indexes = _existing_indexes(cursor, "firmware_versions")
    if INDEX_NAME in indexes:
        print(f"[SKIP] 索引已存在: {INDEX_NAME}")
        return 0
    print(f"[ADD ] {INDEX_DDL}")
    cursor.execute(INDEX_DDL)
    return 1


def _verify_and_report(cursor, changed):
    """复核列齐全 + 历史行默认值落位，并打印报告。返回是否全部通过。"""
    cols_after = _existing_columns(cursor, "firmware_versions")
    missing = [n for n, _ in NEW_COLUMNS if n not in cols_after]
    if missing:
        print(f"[FAIL] 迁移后仍缺列: {missing}")
        return False

    cursor.execute(
        "SELECT COUNT(*), "
        "COALESCE(SUM(CASE WHEN device_type = 'phonebox' THEN 1 ELSE 0 END), 0), "
        "COALESCE(SUM(CASE WHEN is_stable = 0 THEN 1 ELSE 0 END), 0) "
        "FROM firmware_versions"
    )
    total, phonebox_rows, unstable_rows = cursor.fetchone()
    print("-" * 62)
    print(f"[OK] 迁移完成，共执行 {changed} 项 DDL 变更")
    print(f"[OK] 迁移后列: {cols_after}")
    print(
        f"[OK] 历史行默认值：总行数={total}，"
        f"device_type='phonebox' 行数={phonebox_rows}，is_stable=0 行数={unstable_rows}"
    )
    if total and (phonebox_rows != total or unstable_rows != total):
        print("[WARN] 存在未被默认值覆盖的历史行，请人工复核！")
    print("=" * 62)
    return True


def run_migration(db_path=None):
    db_path = db_path or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "instance",
        "score_management.db",
    )
    print("=" * 62)
    print("迁移：firmware_versions 增加 device_type / is_stable / rollback_to")
    print(f"数据库: {db_path}")
    print("=" * 62)

    if not os.path.exists(db_path):
        print(f"[ERROR] 数据库文件不存在: {db_path}")
        return

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _table_exists(cursor, "firmware_versions"):
            print("[SKIP] firmware_versions 表不存在，无需迁移。")
            return

        cols = _existing_columns(cursor, "firmware_versions")
        print(f"[INFO] 迁移前列: {cols}")

        changed = _add_missing_columns(cursor, cols)
        changed += _ensure_device_type_index(cursor)

        conn.commit()

        # ---- 复核：列齐全 + 历史行默认值落位 ----
        if not _verify_and_report(cursor, changed):
            return

    except Exception as e:
        print(f"[ERROR] 迁移失败: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    run_migration()
