from app import create_app
from models import db, Admin, hash_password
import os
import sys
from models import Admin

sys.path.insert(0, ".")


def reset_admin_password(new_password=None):
    if not new_password:
        new_password = os.getenv("ADMIN_RESET_PASSWORD")
        if not new_password:
            print("错误: 必须提供新密码")
            print("方式1: python reset_admin_password.py <new_password>")
            print("方式2: 设置环境变量 ADMIN_RESET_PASSWORD")
            return

    app = create_app()
    with app.app_context():
        admin = Admin.query.filter_by(username="admin").first()

        if admin:
            admin._password = hash_password(new_password)
            db.session.commit()
            print("✓ 管理员密码已重置")
            print("用户名: admin")
            print(f"角色: {admin.role}")
        else:
            print("未找到admin用户")
            admin = Admin(
                username="admin", password=hash_password(new_password), role="super_admin", real_name="超级管理员"
            )
            db.session.add(admin)
            db.session.commit()
            print("✓ 已创建admin用户")
            print("⚠️  请妥善保管密码！")


if __name__ == "__main__":
    password = sys.argv[1] if len(sys.argv) > 1 else None
    reset_admin_password(password)
