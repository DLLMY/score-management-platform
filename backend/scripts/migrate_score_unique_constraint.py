# -*- coding: utf-8 -*-
"""幂等迁移脚本（R3 修复）：scores 表加 (exam_id, student_id, subject_id) 唯一索引。

SQLite 通过 CREATE UNIQUE INDEX 实现（与 SQLAlchemy __table_args__ UniqueConstraint 命名一致，
create_all 时自动跳过已存在的同名索引）。
存在重复数据时不自动删除，先报告并中止（--force 可跳过检查，但唯一索引会因重复而创建失败）。

用法（须系统 Python 3.11）:
    python scripts/migrate_score_unique_constraint.py [--force]
"""
import os
import sqlite3
import sys

DB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "instance", "score_management.db"))
IDX_NAME = "uq_scores_exam_student_subject"


def main():
    if not os.path.exists(DB):
        print("[migrate] DB 不存在，跳过:", DB)
        return
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    try:
        exists = cur.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?", (IDX_NAME,)
        ).fetchone()
        if exists:
            print("[migrate] 唯一索引已存在，跳过")
            return
        dups = cur.execute(
            """
            SELECT exam_id, student_id, subject_id, COUNT(*) AS c
            FROM scores
            GROUP BY exam_id, student_id, subject_id
            HAVING c > 1
            """
        ).fetchall()
        if dups:
            print("[migrate] 发现 %d 组重复成绩（不自动删除，请人工处理）:" % len(dups))
            for d in dups[:10]:
                print("  exam=%s student=%s subject=%s x%d" % d)
            if "--force" not in sys.argv:
                print("[migrate] 已中止。处理重复数据后重跑，或使用 --force（重复会致建索引失败）。")
                sys.exit(1)
        cur.execute(
            "CREATE UNIQUE INDEX %s ON scores(exam_id, student_id, subject_id)" % IDX_NAME
        )
        conn.commit()
        print("[migrate] 唯一索引 %s 创建成功" % IDX_NAME)
    except sqlite3.IntegrityError as e:
        print("[migrate] 创建失败（存在重复数据）:", e)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
