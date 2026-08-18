"""幂等迁移：新建「排课教务」专用角色并授予时间规则/排课相关权限。

背景：
  app/db_init.py::init_database 只做 db.create_all() + 默认管理员 + MQTT 配置，
  并不会调用 init_default_permissions/init_default_roles，因此默认角色集里
  没有独立的「排课教务」角色；timetable.rule.manage（维护 TimeRule 与节次）
  现仅授予 super_admin / admin。
  按设计，TimeRule 维护应由「排课教务」专用角色负责（非仅超管）。
  seed_rbac.py 是「清库重建」脚本，生产库不能直接跑，故提供本增量脚本。

本脚本：
  1) 确保 timetable.rule.manage 等权限码存在于 permissions 表（缺失则补）；
  2) 若不存在则新建角色 timetable_manager（角色名「排课教务」）；
  3) 将排课相关权限批量授予该角色（仅逐条映射；CSV 冗余列已废弃），
     已存在则跳过；
  4) 运行前自动备份数据库（.db + -wal/-shm）。

用法：
  python scripts/migrate_timetable_role.py            # 迁移默认 instance 库
  python scripts/migrate_timetable_role.py <db_path>  # 指定库

可重复执行，已存在则跳过。
"""

import os
import shutil
import sqlite3
import sys
from datetime import datetime

ROLE_CODE = "timetable_manager"
ROLE_NAME = "排课教务"
ROLE_DESC = "课程时间规则与节次排课管理（维护 TimeRule / 节次 / 课表）"

# 排课教务角色权限包：timetable.rule.manage 为用户明确要求，其余为使其可实际履行
# 「排课」职责所需的配套查看/管理权限。
ROLE_PERMS = [
    "timetable.rule.manage",  # 核心：管理时间规则（TimeRule）与节次 —— 用户明确要求
    "period.manage",          # 管理节次
    "period.view",            # 查看节次
    "schedule.manage",        # 管理课表（排课）
    "schedule.view",          # 查看课表
    "class.view",             # 查看班级
    "subject.view",           # 查看科目
    "rule.view",              # 查看评分规则
    "student.view",           # 查看学生
    "notification.view",      # 查看通知
]

# 权限码 -> 名称（仅用于「缺失时补建」的友好名；正常 seeded 库已存在，不会触发）
PERM_NAMES = {
    "timetable.rule.manage": "管理时间规则",
    "period.manage": "管理时段",
    "period.view": "查看时段",
    "schedule.manage": "管理课表",
    "schedule.view": "查看课表",
    "class.view": "查看班级",
    "subject.view": "查看科目",
    "rule.view": "查看规则",
    "student.view": "查看学生",
    "notification.view": "查看通知",
}
PERM_CATEGORY = "academic"


def _backup(db_path: str) -> str | None:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = f"{db_path}.bak_timetable_role_{ts}"
    try:
        shutil.copy2(db_path, bak)
        for suffix in ("-wal", "-shm"):
            aux = db_path + suffix
            if os.path.exists(aux):
                shutil.copy2(aux, bak + suffix)
        print(f"[ok] backup -> {bak}")
        return bak
    except Exception as e:  # noqa: BLE001
        print(f"[warn] backup failed: {e}")
        return None


def migrate(db_path: str) -> int:
    if not os.path.exists(db_path):
        print(f"[ERROR] database not found: {db_path}")
        return 1

    _backup(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    changed = []

    # 0) 确保权限码存在（缺失则补建，正常 seeded 库不会触发）
    for perm in ROLE_PERMS:
        cur.execute("SELECT id FROM permissions WHERE code = ?", (perm,))
        if cur.fetchone():
            continue
        name = PERM_NAMES.get(perm, perm)
        cur.execute(
            "INSERT INTO permissions (code, name, category, description, is_active, created_at, updated_at) "
            'VALUES (?,?,?,?,1,datetime("now"),datetime("now"))',
            (perm, name, PERM_CATEGORY, f"自动补建的权限：{name}"),
        )
        changed.append(f"permissions[{perm}]")
        print(f"[ok] inserted missing permission: {perm}")

    # 1) 创建角色（若不存在）
    cur.execute("SELECT id FROM role_permission WHERE role_code = ?", (ROLE_CODE,))
    row = cur.fetchone()
    if row is None:
        cur.execute(
            "INSERT INTO role_permission "
            "(role_code, role_name, description, is_active, created_at, updated_at) "
            'VALUES (?,?,?,1,datetime("now"),datetime("now"))',
            (ROLE_CODE, ROLE_NAME, ROLE_DESC),
        )
        changed.append(f"role[{ROLE_CODE}]")
        print(f"[ok] created role: {ROLE_CODE} ({ROLE_NAME})")
    else:
        print(f"[skip] role already exists: {ROLE_CODE}")

    # 2) 逐条授予权限（仅 role_permission_mappings；CSV 冗余列已废弃）
    for perm in ROLE_PERMS:
        cur.execute(
            "SELECT id FROM role_permission_mappings WHERE role_code = ? AND permission_code = ?",
            (ROLE_CODE, perm),
        )
        if cur.fetchone():
            print(f"[skip] mapping exists: {ROLE_CODE} -> {perm}")
        else:
            cur.execute(
                "INSERT INTO role_permission_mappings (role_code, permission_code, created_at) "
                'VALUES (?,?,datetime("now"))',
                (ROLE_CODE, perm),
            )
            changed.append(f"mapping[{perm}]")
            print(f"[ok] inserted mapping: {ROLE_CODE} -> {perm}")

    conn.commit()

    # 3) 验证
    cur.execute("SELECT role_name FROM role_permission WHERE role_code = ?", (ROLE_CODE,))
    vr = cur.fetchone()
    print("verify role:", vr)
    cur.execute(
        "SELECT permission_code FROM role_permission_mappings WHERE role_code = ? ORDER BY permission_code",
        (ROLE_CODE,),
    )
    print("verify role perms:", [r[0] for r in cur.fetchall()])
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
