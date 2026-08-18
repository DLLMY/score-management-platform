"""创建「排课教务」专用账号并绑定 timetable_manager 角色（幂等、可重跑）。

用法：
  python scripts/create_timetable_admin.py [--username paikao] [--password 'Paikao@123'] [--real-name 排课教务]

- 若用户名已存在，仅确保角色绑定（不重建账号、不改密码）。
- 若角色已绑定，跳过绑定。
- 运行前自动备份数据库。
- 结束后用 has_permission 验证 timetable.rule.manage 等关键权限。
"""

import os
import sys
import shutil
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app

INSTANCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance")
DB_PATH = os.path.join(INSTANCE_DIR, "score_management.db")
ROLE_CODE = "timetable_manager"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--username", default="paikao")
    ap.add_argument("--password", default="Paikao@123")
    ap.add_argument("--real-name", default="排课教务")
    args = ap.parse_args()

    # 自动备份
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = os.path.join(INSTANCE_DIR, "score_management.db.bak_create_timetable_admin_%s" % ts)
    shutil.copy2(DB_PATH, bak)
    print("[backup] %s" % bak)

    app = create_app(lightweight=True)
    with app.app_context():
        from models import db, Admin, AdminRole
        from utils.permission import has_permission

        u = Admin.query.filter_by(username=args.username).first()
        created = False
        if u is None:
            u = Admin(
                username=args.username,
                password=args.password,
                role=ROLE_CODE,
                real_name=args.real_name,
            )
            db.session.add(u)
            db.session.flush()
            created = True
            print("[create] new admin username=%s id=%s" % (args.username, u.id))
        else:
            print(
                "[skip] admin username=%s already exists (id=%s), keep password unchanged"
                % (args.username, u.id)
            )

        link = AdminRole.query.filter_by(admin_id=u.id, role_code=ROLE_CODE).first()
        if link is None:
            db.session.add(AdminRole(admin_id=u.id, role_code=ROLE_CODE))
            print("[bind] role %s -> admin %s" % (ROLE_CODE, u.id))
        else:
            print("[skip] role %s already bound to admin %s" % (ROLE_CODE, u.id))

        db.session.commit()

        perm_timetable = has_permission(u, "timetable.rule.manage")
        perm_period = has_permission(u, "period.manage")
        perm_schedule = has_permission(u, "schedule.manage")
        perm_student = has_permission(u, "student.view")
        perm_force = has_permission(u, "notification.force_send")
        perm_all = has_permission(u, "all")
        print("[verify] has_permission:")
        print("  timetable.rule.manage: %s" % perm_timetable)
        print("  period.manage: %s" % perm_period)
        print("  schedule.manage: %s" % perm_schedule)
        print("  student.view: %s" % perm_student)
        print("  notification.force_send (应为 False): %s" % perm_force)
        print("  all (应为 False): %s" % perm_all)

        ok = (
            perm_timetable
            and perm_period
            and perm_schedule
            and perm_student
            and not perm_force
            and not perm_all
        )
        print("[result] %s" % ("OK — 账号可管理时间规则且无越权" if ok else "WARN — 请检查权限"))


if __name__ == "__main__":
    main()
