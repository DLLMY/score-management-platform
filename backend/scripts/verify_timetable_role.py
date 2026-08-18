"""隔离验证：确认 timetable_manager 角色用户能正确通过 timetable.rule.manage 鉴权。

不改动真实业务数据：临时建一个 __verify_tmp__ 管理员并赋予 timetable_manager 角色，
调用 has_permission 后清理。
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app

app = create_app(lightweight=True)

with app.app_context():
    from models import db, Admin, AdminRole
    from utils.permission import has_permission
    from utils.security import hash_password

    u = Admin(
        username="__verify_tmp__",
        password=hash_password("tmp"),
        role="timetable_manager",
        real_name="verify",
    )
    db.session.add(u)
    db.session.flush()
    db.session.add(AdminRole(admin_id=u.id, role_code="timetable_manager"))
    db.session.commit()

    try:
        checks = {
            "timetable.rule.manage": has_permission(u, "timetable.rule.manage"),
            "period.manage": has_permission(u, "period.manage"),
            "schedule.manage": has_permission(u, "schedule.manage"),
            "student.view": has_permission(u, "student.view"),
            "notification.force_send (应为 False)": has_permission(u, "notification.force_send"),
            "all (应为 False)": has_permission(u, "all"),
        }
        for k, v in checks.items():
            print(f"  {k}: {v}")
    finally:
        AdminRole.query.filter_by(admin_id=u.id).delete()
        Admin.query.filter_by(id=u.id).delete()
        db.session.commit()
    print("cleanup done")
