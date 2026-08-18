#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
S1 修复：teacher 角色补授 score.edit（成绩录入闭环）。

背景：教师（唯一主要用户）有 score.entry/score.view，但 ScoreEntry 页面的
「批量操作/导入/确认全部/保存全部」按钮使用 score.edit 权限码，后端 DB 有
该码但 teacher 未被授权 → 教师进入成绩录入页后核心按钮全部不渲染，录入流程断。

本脚本为幂等增量：仅当 teacher 缺 score.edit 时插入 role_permission_mappings，
重复运行安全。按项目铁律：新增权限/角色写幂等增量脚本，禁跑 seed_rbac.py。

用法：python scripts/migrate_teacher_score_edit.py
"""
import os
import sys
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "instance", "score_management.db")
ROLE = "teacher"
PERM = "score.edit"


def main():
    if not os.path.exists(DB_PATH):
        print(f"[error] 找不到数据库: {DB_PATH}")
        sys.exit(2)
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        # 权限码必须存在于 permissions 表（防御）
        cur.execute("SELECT id FROM permissions WHERE code=?", (PERM,))
        perm_row = cur.fetchone()
        if not perm_row:
            print(f"[error] 权限码 {PERM} 不在 permissions 表，中止")
            sys.exit(1)
        # 角色是否存在
        cur.execute("SELECT DISTINCT role_code FROM role_permission_mappings WHERE role_code=?", (ROLE,))
        if not cur.fetchone():
            print(f"[warn] 角色 {ROLE} 无任何映射记录，跳过（角色可能未启用）")
        # 幂等：已存在则跳过
        cur.execute(
            "SELECT id FROM role_permission_mappings WHERE role_code=? AND permission_code=?",
            (ROLE, PERM),
        )
        if cur.fetchone():
            print(f"[skip] teacher 已有 {PERM}，无需处理")
        else:
            cur.execute(
                "INSERT INTO role_permission_mappings (role_code, permission_code, created_at) VALUES (?, ?, datetime('now'))",
                (ROLE, PERM),
            )
            conn.commit()
            print(f"[done] teacher 已补授 {PERM}")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败并回滚: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
