# -*- coding: utf-8 -*-
"""幂等增量迁移：把 class.edit 授予「班主任(teacher)」角色。

背景
----
班主任工作台的「座次表 / 值日生 / 班委 / 家长联系」4 个模块，
其全部写端点（共 20 个 POST/PUT/DELETE）都用 @requires_permission("class.edit") 把关，
但 teacher 角色从未被授予该权限 → 班主任能看列表（class.view 有），
一点「新增/编辑/删除」就 403「权限不足」，表现为「功能全都用不了」。

class.edit 在全后端**仅**被这 4 个模块使用（班级本身的增删改走 class.manage），
因此授予 teacher 是精确授权，不会让班主任获得建班/删班能力。

本脚本可重复执行：
  1. 备份数据库
  2. permissions 目录表补 class.edit（缺失才插）
  3. role_permission_mappings 插入映射（已存在则跳过）
  4. 打印校验结果
"""
import os
import shutil
import sqlite3
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "..", "instance", "score_management.db")
DB = os.path.normpath(DB)

ROLE = "teacher"
# (code, name, category)
NEW_PERMS = [
    ("class.edit", "编辑班级事务(座次/值日/班委/家长联系)", "班主任工作台"),
]


def main():
    if not os.path.exists(DB):
        print("数据库不存在: %s" % DB)
        return 1

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = "%s.bak_class_edit_%s" % (DB, stamp)
    shutil.copy2(DB, backup)
    print("已备份 -> %s" % backup)

    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # --- 1. 权限目录 ---
    for code, name, category in NEW_PERMS:
        cur.execute("SELECT 1 FROM permissions WHERE code=?", (code,))
        if cur.fetchone():
            print("目录已存在，跳过: %s" % code)
        else:
            cur.execute(
                "INSERT INTO permissions (code, name, category, description, is_active, created_at)"
                " VALUES (?,?,?,?,1,datetime('now'))",
                (code, name, category, name),
            )
            print("目录新增: %s" % code)

    # --- 2. role_permission_mappings（CSV 冗余列已废弃，仅维护映射） ---
    for code, _, _ in NEW_PERMS:
        cur.execute(
            "SELECT 1 FROM role_permission_mappings WHERE role_code=? AND permission_code=?",
            (ROLE, code),
        )
        if cur.fetchone():
            print("映射已存在，跳过: %s -> %s" % (ROLE, code))
        else:
            cur.execute(
                "INSERT INTO role_permission_mappings (role_code, permission_code, created_at)"
                " VALUES (?,?,datetime('now'))",
                (ROLE, code),
            )
            print("映射新增: %s -> %s" % (ROLE, code))

    conn.commit()

    # --- 4. 校验 ---
    cur.execute(
        "SELECT permission_code FROM role_permission_mappings WHERE role_code=? ORDER BY permission_code",
        (ROLE,),
    )
    perms = [r[0] for r in cur.fetchall()]
    print("\n=== 校验 ===")
    print("%s 映射权限总数 = %d" % (ROLE, len(perms)))
    for code, _, _ in NEW_PERMS:
        print("  %s: %s" % (code, "OK" if code in perms else "缺失"))
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
