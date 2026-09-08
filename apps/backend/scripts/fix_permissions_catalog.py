"""幂等补齐 permissions 目录表缺失的默认权限行。

背景：运行时启动链 (app/db_init.py::init_database) 不调用 init_default_permissions()，
导致现网 permissions 目录表残缺（例如 timetable.rule.manage 缺失）。这不影响鉴权
（has_permission 只读 role_permission_mappings 表），但会让「权限列表」UI 展示不全。

本脚本仅 INSERT 缺失行，可重跑。运行前自动备份数据库。
"""

import os
import sys
import shutil
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from api.users.rbac_routes import init_default_permissions
from models import Permission

INSTANCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance")
DB_PATH = os.path.join(INSTANCE_DIR, "score_management.db")


def main():
    # 自动备份
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = os.path.join(INSTANCE_DIR, "score_management.db.bak_perms_catalog_%s" % ts)
    shutil.copy2(DB_PATH, bak)
    print("[backup] %s" % bak)

    app = create_app(lightweight=True)
    with app.app_context():
        before = {p.code for p in Permission.query.all()}
        init_default_permissions()
        after = {p.code for p in Permission.query.all()}
        inserted = sorted(after - before)
        print("[catalog] before=%d after=%d inserted=%d" % (len(before), len(after), len(inserted)))
        if inserted:
            print("[inserted] " + ", ".join(inserted))
        else:
            print("[inserted] (none — already complete)")


if __name__ == "__main__":
    main()
