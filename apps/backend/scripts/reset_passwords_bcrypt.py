"""使用bcrypt重置测试账号密码"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from models import db, Admin
from utils.security import hash_password, verify_password

with app.app_context():
    accounts = [
        {"username": "admin", "real_name": "超级管理员", "role": "super_admin"},
        {"username": "teacher", "real_name": "测试教师", "role": "teacher"},
        {"username": "student", "real_name": "测试学生", "role": "student"},
    ]

    for acc in accounts:
        admin = Admin.query.filter_by(username=acc["username"]).first()
        if admin:
            admin.password = hash_password("123456")
            db.session.commit()
            # 验证密码
            verify_result = verify_password("123456", admin.password)
            print(f"  ✓ {acc['username']}: 密码已重置, 验证结果={verify_result}")
        else:
            # 创建新账号
            new_admin = Admin(
                username=acc["username"],
                password=hash_password("123456"),
                real_name=acc["real_name"],
                role=acc["role"],
                is_active=True,
            )
            db.session.add(new_admin)
            db.session.commit()
            verify_result = verify_password("123456", new_admin.password)
            print(f"  ✓ {acc['username']}: 账号已创建, 验证结果={verify_result}")

    print("\n=== 测试账号密码重置完成 ===")
    print("可用测试账号:")
    print("  - admin / 123456 (管理员)")
    print("  - teacher / 123456 (教师)")
    print("  - student / 123456 (学生)")
