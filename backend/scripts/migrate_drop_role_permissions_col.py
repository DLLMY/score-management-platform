# -*- coding: utf-8 -*-
"""幂等迁移：P0-3 收尾 —— 删除 RolePermission.permissions 冗余 CSV 列 + 废弃 role 旧表。

背景
----
P0-3 已在前置代码改动中完成「RBAC 双源清理」：
  - api/users/rbac_routes.py 不再读/写 role_permission.permissions CSV；
  - api/users/role_permissions_routes.py 响应去掉 permissions 字段；
  - models.RolePermission 模型去掉 permissions 列；
  - models.Role 死模型已删除，api/users/roles_routes.py 已删除，
    app/api_versioning.py 不再注册 ns_roles（/api/roles 已下线）；
  - seed_rbac.py / verify_rbac_consistency.py --apply / migrations/add_rbac.py
    及 5 个历史授权脚本均改为仅维护 role_permission_mappings。

本脚本负责把上述代码改动落到数据库（DDL）：
  1) 若 role_permission 表仍存在 permissions 列 → ALTER TABLE ... DROP COLUMN；
  2) 若 role 旧表仍存在 → DROP TABLE role。

幂等：已执行则跳过，可重复运行。

注意
----
  - 真实路由鉴权（utils/permission.requires_permission / has_permission /
    _get_admin_permission_codes）只查 role_permission_mappings + RoleHierarchy，
    从不读 permissions CSV 列；删列不影响任何鉴权（RBAC 68 权限目录数不变）。
  - SQLite 3.35+ 支持 DROP COLUMN（当前 3.43.1）。role_permission 仅 9 行，
    role 表为空闲小表，DROP 代价极低。
  - 磁盘空间紧张（C 盘近乎占满）：按约定跳过完整文件备份（依赖既有 pre_Fxx
    基线），仅做幂等 DDL。请勿在应用运行期执行，避免写锁冲突。

用法
----
  python scripts/migrate_drop_role_permissions_col.py            # 默认 instance 库
  python scripts/migrate_drop_role_permissions_col.py <db_path> # 指定库
  python scripts/migrate_drop_role_permissions_col.py --check-only  # 仅报告，不改
"""

import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.normpath(os.path.join(HERE, "instance", "score_management.db"))


def column_exists(cur, table, col):
    rows = cur.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == col for r in rows)


def table_exists(cur, table):
    row = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def migrate(db_path, check_only=False):
    if not os.path.exists(db_path):
        print(f"[ERROR] database not found: {db_path}")
        return 1

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA busy_timeout=5000")
    cur = conn.cursor()
    actions = []

    # 1) 删除 role_permission.permissions 冗余列
    if table_exists(cur, "role_permission") and column_exists(
        cur, "role_permission", "permissions"
    ):
        if check_only:
            print("[check] role_permission.permissions 列仍存在于数据库，需要 DROP")
        else:
            cur.execute("ALTER TABLE role_permission DROP COLUMN permissions")
            actions.append("DROP COLUMN role_permission.permissions")
            print("[ok] dropped column role_permission.permissions")
    else:
        print("[skip] role_permission.permissions 列不存在（已清理）")

    # 2) 删除废弃的 role 旧表
    if table_exists(cur, "role"):
        if check_only:
            print("[check] role 旧表仍存在于数据库，需要 DROP")
        else:
            cur.execute("DROP TABLE role")
            actions.append("DROP TABLE role")
            print("[ok] dropped table role")
    else:
        print("[skip] role 旧表不存在（已清理）")

    if not check_only:
        conn.commit()
    conn.close()

    if check_only:
        print("DONE (check-only, 未改动数据库)")
    else:
        print(f"DONE (changed: {actions or 'nothing, already up-to-date'})")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    check_only = "--check-only" in args
    args = [a for a in args if a != "--check-only"]
    db = args[0] if args else DEFAULT_DB
    sys.exit(migrate(db, check_only=check_only))
