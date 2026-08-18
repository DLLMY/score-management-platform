#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
P0-1 补遗迁移：nlp_rule_usages.user_id → student_id（幂等）

背景：P0-1（student_id↔user_id 统一）当时只改 7 张表，明确不触碰 NLPRuleUsage；
后 nlp_parser_service/nlp_enhanced_service 构造 NLPRuleUsage 时传 `student_id=user.id`，
而模型/DB 列仍是 `user_id`，命中即 TypeError。本脚本补做列改名（0 行数据，零风险）。

用法：
  python scripts/migrate_nlp_rule_usage_student_id.py            # 执行
  python scripts/migrate_nlp_rule_usage_student_id.py --check-only  # 仅报告
"""
import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "instance", "score_management.db")
CHECK_ONLY = "--check-only" in sys.argv


def main():
    if not os.path.exists(DB_PATH):
        print(f"[error] 找不到数据库: {DB_PATH}")
        sys.exit(2)
    conn = sqlite3.connect(DB_PATH)
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(nlp_rule_usages)")]
        print(f"[info] nlp_rule_usages 当前列: {cols}")
        has_user = "user_id" in cols
        has_student = "student_id" in cols
        if has_student and not has_user:
            print("[skip] 已改名为 student_id，无需迁移")
            return
        if not has_user:
            print("[skip] user_id 列不存在，视为已完成")
            return
        if CHECK_ONLY:
            print("[check-only] 检测到 user_id 列，未做任何修改")
            return
        conn.execute("ALTER TABLE nlp_rule_usages RENAME COLUMN user_id TO student_id")
        conn.commit()
        cols2 = [r[1] for r in conn.execute("PRAGMA table_info(nlp_rule_usages)")]
        print(f"[ok] 已改名，当前列: {cols2}")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败已回滚: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
