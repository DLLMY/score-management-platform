"""幂等迁移：为 RBAC 注册运维中心相关权限并授予管理员/运维角色。

背景：
  app 正常启动不 seed RBAC，新增权限码不会自动落库。seed_rbac.py 是「清库重建」
  型脚本（生产禁用），故提供本增量脚本。

本次注册两项权限：
  - ops_center.view  : 运维中心聚合仪表盘查看（新页面 /ops-center 的入口权限）
  - system.view      : 系统健康/性能/统计等监控数据查看。
                      注意：api/system/health、/system/performance、/system/stats
                      端点早已使用 @requires_permission("system.view")，但该权限码此前
                      并未落入 permissions 目录，导致非 super_admin 角色访问这些端点会 403。
                      本脚本补齐该权限并授予运维角色，修复此潜在缺口。

授予角色：admin、super_admin、operator
  （super_admin 本身含 'all' 已满足，此处一并补映射保持一致性；
   operator 是运维执行角色，本应可查看监控数据。）

用法：
  python scripts/migrate_ops_center_permission.py            # 迁移默认 instance 库
  python scripts/migrate_ops_center_permission.py <db_path>  # 指定库

可重复执行，已存在则跳过。
"""

import os
import sqlite3
import sys

# 待注册的权限目录：(code, name, category, description)
PERMS_TO_REGISTER = [
    ("ops_center.view", "运维中心查看", "系统管理", "查看系统运维中心聚合仪表盘（健康/性能/MQTT/日志/设备总览）"),
    ("system.view", "系统查看", "系统管理", "查看系统健康/性能/统计等监控数据（/api/system/health|performance|stats）"),
]

TARGET_ROLES = ["admin", "super_admin", "operator"]


def migrate(db_path: str) -> int:
    if not os.path.exists(db_path):
        print(f"[ERROR] database not found: {db_path}")
        return 1

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    changed = []

    # 1) permissions 目录
    for code, name, category, desc in PERMS_TO_REGISTER:
        cur.execute("SELECT id FROM permissions WHERE code = ?", (code,))
        if cur.fetchone():
            print(f"[skip] permission already exists: {code}")
        else:
            cur.execute(
                "INSERT INTO permissions (code, name, category, description, is_active, created_at, updated_at) "
                'VALUES (?,?,?,?,1,datetime("now"),datetime("now"))',
                (code, name, category, desc),
            )
            changed.append(f"permissions[{code}]")
            print(f"[ok] inserted permission: {code}")

    for role_code in TARGET_ROLES:
        # 2) role_permission_mappings（CSV 冗余列已废弃，仅维护映射）
        for code, _, _, _ in PERMS_TO_REGISTER:
            cur.execute(
                "SELECT id FROM role_permission_mappings WHERE role_code = ? AND permission_code = ?",
                (role_code, code),
            )
            if cur.fetchone():
                print(f"[skip] mapping exists: {role_code} -> {code}")
            else:
                cur.execute(
                    "INSERT INTO role_permission_mappings (role_code, permission_code, created_at) "
                    "VALUES (?,?,datetime('now'))",
                    (role_code, code),
                )
                changed.append(f"mapping[{role_code}->{code}]")
                print(f"[ok] inserted mapping: {role_code} -> {code}")

    conn.commit()

    # 验证
    for code, _, _, _ in PERMS_TO_REGISTER:
        cur.execute("SELECT code, name, category FROM permissions WHERE code = ?", (code,))
        print("verify permission:", cur.fetchone())
    cur.execute(
        "SELECT role_code FROM role_permission_mappings WHERE permission_code = ?",
        ("ops_center.view",),
    )
    print("verify ops_center.view mapped roles:", [r[0] for r in cur.fetchall()])
    cur.execute(
        "SELECT role_code FROM role_permission_mappings WHERE permission_code = ?",
        ("system.view",),
    )
    print("verify system.view mapped roles:", [r[0] for r in cur.fetchall()])
    conn.close()

    print(f"DONE (changed: {changed or 'nothing, already up-to-date'})")
    return 0


if __name__ == "__main__":
    default_db = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "instance",
        "score_management.db",
    )
    sys.exit(migrate(sys.argv[1] if len(sys.argv) > 1 else default_db))
