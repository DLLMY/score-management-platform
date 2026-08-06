"""幂等迁移：为 RBAC 注册 phonebox.unlock.manage 权限并授予班主任(teacher)角色。

背景：
  app/db_init.py::init_database 只做 db.create_all() + 默认管理员 + MQTT 配置，
  并不会调用 api/users/rbac_routes.py 里的 init_default_permissions/init_default_roles，
  因此新增的权限码不会在正常启动时自动落库。
  seed_rbac.py 是「清库重建」脚本（会 DELETE admin_roles / 自定义角色），生产库不能直接跑，
  故提供本增量脚本。

用法：
  python scripts/migrate_phonebox_permission.py            # 迁移默认 instance 库
  python scripts/migrate_phonebox_permission.py <db_path>  # 指定库

可重复执行，已存在则跳过。
"""

import os
import sqlite3
import sys

PERM_CODE = "phonebox.unlock.manage"
PERM_NAME = "管理本班手机箱开箱策略"
PERM_CATEGORY = "device"
PERM_DESC = "班主任管理本班手机箱自助开箱策略（预设时段/一键放行）"
TARGET_ROLES = ["teacher"]


def migrate(db_path: str) -> int:
    if not os.path.exists(db_path):
        print(f"[ERROR] database not found: {db_path}")
        return 1

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    changed = []

    # 1) permissions 目录
    cur.execute("SELECT id FROM permissions WHERE code = ?", (PERM_CODE,))
    if cur.fetchone():
        print(f"[skip] permission already exists: {PERM_CODE}")
    else:
        cur.execute(
            "INSERT INTO permissions (code, name, category, description, is_active, created_at, updated_at) "
            'VALUES (?,?,?,?,1,datetime("now"),datetime("now"))',
            (PERM_CODE, PERM_NAME, PERM_CATEGORY, PERM_DESC),
        )
        changed.append("permissions")
        print(f"[ok] inserted permission: {PERM_CODE}")

    for role_code in TARGET_ROLES:
        # 2) role_permission.permissions CSV
        cur.execute(
            "SELECT id, permissions FROM role_permission WHERE role_code = ?",
            (role_code,),
        )
        row = cur.fetchone()
        if row is None:
            print(f"[warn] role not found, skip CSV update: {role_code}")
        else:
            role_id, csv_text = row[0], (row[1] or "")
            codes = [c.strip() for c in csv_text.split(",") if c.strip()]
            if PERM_CODE in codes:
                print(f"[skip] {role_code}.permissions already contains {PERM_CODE}")
            else:
                codes.append(PERM_CODE)
                cur.execute(
                    'UPDATE role_permission SET permissions = ?, updated_at = datetime("now") WHERE id = ?',
                    (",".join(codes), role_id),
                )
                changed.append(f"role_permission[{role_code}]")
                print(f"[ok] appended {PERM_CODE} to role_permission[{role_code}]")

        # 3) role_permission_mappings
        cur.execute(
            "SELECT id FROM role_permission_mappings WHERE role_code = ? AND permission_code = ?",
            (role_code, PERM_CODE),
        )
        if cur.fetchone():
            print(f"[skip] mapping exists: {role_code} -> {PERM_CODE}")
        else:
            cur.execute(
                "INSERT INTO role_permission_mappings (role_code, permission_code, created_at) "
                'VALUES (?,?,datetime("now"))',
                (role_code, PERM_CODE),
            )
            changed.append(f"mapping[{role_code}]")
            print(f"[ok] inserted mapping: {role_code} -> {PERM_CODE}")

    conn.commit()

    # 验证
    cur.execute("SELECT code, name, category FROM permissions WHERE code = ?", (PERM_CODE,))
    print("verify permission:", cur.fetchone())
    cur.execute(
        "SELECT role_code FROM role_permission_mappings WHERE permission_code = ?",
        (PERM_CODE,),
    )
    print("verify mapped roles:", [r[0] for r in cur.fetchall()])
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
