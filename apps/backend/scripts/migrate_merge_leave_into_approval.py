#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
P0-4 审批合并迁移脚本（幂等 / 单事务 / 可逆）

将 `leave_application` 表并入 `approval` 表（approval_type='leave'）：
  - leave_application.student_id   -> approval.student_id
  - leave_application.leave_type   -> approval.type='leave' 且 approval.leave_type
  - leave_application.reason       -> approval.description
  - leave_application.status       -> approval.status
  - leave_application.approved_by  -> approval.approver_id
  - leave_application.approved_at  -> approval.approve_time
  - leave_application.start_date   -> approval.start_date (新增列)
  - leave_application.end_date     -> approval.end_date   (新增列)
  - leave_application.created_at   -> approval.created_at

备份策略（受 C 盘空间约束，勿整库 .backup）：
  - 执行前在库内建 `leave_application_bak AS SELECT *`（可逆，占用极小）。
  - 单事务：备份 + 加列 + 拷贝 + DROP 旧表。

幂等：
  - 若 leave_application 已不存在 -> 直接跳过（视为已合并）。
  - 若 leave_application 存在但 leave_application_bak 已存在 -> 仅执行 DROP（前次拷贝已完成）。
  - 加列前用 PRAGMA 检查是否存在，避免重复加列报错。

用法：
  python scripts/migrate_merge_leave_into_approval.py            # 执行
  python scripts/migrate_merge_leave_into_approval.py --check-only  # 仅报告状态不修改
"""

import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "instance", "score_management.db")

CHECK_ONLY = "--check-only" in sys.argv


def table_exists(conn, name):
    cur = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


def column_exists(conn, table, col):
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == col for row in cur.fetchall())


def main():
    if not os.path.exists(DB_PATH):
        print(f"[error] 找不到数据库: {DB_PATH}")
        sys.exit(2)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=OFF")
    try:
        has_leave = table_exists(conn, "leave_application")
        has_bak = table_exists(conn, "leave_application_bak")
        has_approval = table_exists(conn, "approval")

        print(f"[info] leave_application 表存在: {has_leave}")
        print(f"[info] leave_application_bak 表存在: {has_bak}")
        print(f"[info] approval 表存在: {has_approval}")

        if not has_approval:
            print("[error] approval 表不存在，无法合并")
            sys.exit(2)

        if not has_leave:
            print("[skip] leave_application 已不存在，视为已完成合并，直接退出")
            return

        if CHECK_ONLY:
            print("[check-only] 检测到待合并的 leave_application，未做任何修改")
            return

        # 1) 库内备份（可逆）
        if not has_bak:
            conn.execute("CREATE TABLE leave_application_bak AS SELECT * FROM leave_application")
            print("[ok] 已建库内备份 leave_application_bak")
        else:
            print("[info] leave_application_bak 已存在，跳过备份（前次拷贝应已完成）")

        # 2) 给 approval 加列（若不存在）
        for col, ctype in (
            ("leave_type", "VARCHAR(20)"),
            ("start_date", "DATE"),
            ("end_date", "DATE"),
        ):
            if not column_exists(conn, "approval", col):
                conn.execute(f"ALTER TABLE approval ADD COLUMN {col} {ctype}")
                print(f"[ok] approval 新增列 {col}")
            else:
                print(f"[info] approval 列 {col} 已存在，跳过")

        # 3) 仅当备份刚建立（即本次尚未拷贝）时拷贝数据，避免重复插入
        if not has_bak:
            conn.execute("""
                INSERT INTO approval (
                    student_id, type, title, description, status,
                    approver_id, approve_time, created_at,
                    leave_type, start_date, end_date
                )
                SELECT
                    student_id,
                    'leave',
                    COALESCE(leave_type, ''),
                    COALESCE(reason, ''),
                    status,
                    approved_by,
                    approved_at,
                    created_at,
                    leave_type,
                    start_date,
                    end_date
                FROM leave_application
                """)
            copied = conn.execute("SELECT changes()").fetchone()[0]
            print(f"[ok] 已拷贝 {copied} 条请假记录到 approval(type='leave')")
        else:
            already = conn.execute("SELECT COUNT(*) FROM approval WHERE type='leave'").fetchone()[0]
            print(f"[info] 疑似前次已拷贝，当前 approval.type='leave' 共 {already} 条，跳过拷贝")

        # 4) 删除旧表
        conn.execute("DROP TABLE leave_application")
        conn.commit()
        print("[ok] 已删除旧表 leave_application")

        remain = conn.execute("SELECT COUNT(*) FROM approval WHERE type='leave'").fetchone()[0]
        print(f"[done] 合并完成，approval 中 type='leave' 记录数 = {remain}")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败已回滚: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
