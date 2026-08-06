import os
import sys
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app, db
from models import Admin
from utils.security import hash_password


def init_admin(password=None):
    """初始化默认管理员用户"""
    with app.app_context():
        existing_admin = Admin.query.first()
        if existing_admin:
            print(f"数据库中已有管理员用户: {existing_admin.username}")
            print("跳过初始化")
            return
        if not password:
            password = os.getenv("ADMIN_INIT_PASSWORD")
            if not password:
                print("错误: 必须提供初始化密码")
                print("方式1: 使用 --password 参数")
                print("方式2: 设置环境变量 ADMIN_INIT_PASSWORD")
                return
        print("创建默认管理员用户...")
        admin = Admin(
            username="admin",
            password=hash_password(password),
            role="admin",
            real_name="系统管理员",
            phone="13800138000",
        )
        db.session.add(admin)
        db.session.commit()
        print("默认管理员创建成功!")
        print("-" * 50)
        print("用户名: admin")
        print("密码: [已设置]")
        print("-" * 50)
        print("⚠️  请妥善保管密码，首次登录后建议立即修改！")


def reset_password(username="admin", new_password=None):
    """重置管理员密码"""
    if not new_password:
        new_password = os.getenv("ADMIN_RESET_PASSWORD")
        if not new_password:
            print("错误: 必须提供新密码")
            return
    with app.app_context():
        admin = Admin.query.filter_by(username=username).first()
        if admin:
            print(f"找到管理员用户: {admin.username}")
            admin.password = hash_password(new_password)
            db.session.commit()
            print("✓ 管理员密码已更新")
        else:
            print(f"未找到用户: {username}")


def create_admin(username, password, real_name="管理员", phone="", role="admin"):
    """创建新管理员"""
    with app.app_context():
        existing_admin = Admin.query.filter_by(username=username).first()
        if existing_admin:
            print(f"用户 {username} 已存在")
            return
        print(f"创建管理员用户: {username}")
        admin = Admin(username=username, password=hash_password(password), role=role, real_name=real_name, phone=phone)
        db.session.add(admin)
        db.session.commit()
        print("管理员创建成功!")
        print("-" * 50)
        print(f"用户名: {username}")
        print(f"密码: {password}")
        print(f"姓名: {real_name}")
        print(f"角色: {role}")
        print("-" * 50)


def list_admins():
    """列出所有管理员"""
    with app.app_context():
        admins = Admin.query.all()
        if not admins:
            print("暂无管理员用户")
            return
        print("管理员列表:")
        print("-" * 60)
        print(f"{'ID':<5} {'用户名':<15} {'姓名':<15} {'角色':<10} {'创建时间':<20}")
        print("-" * 60)
        for admin in admins:
            created_at = admin.created_at.strftime("%Y-%m-%d %H:%M:%S") if admin.created_at else ""
            print(f"{admin.id:<5} {admin.username:<15} {admin.real_name:<15} {admin.role:<10} {created_at:<20}")


def delete_admin(username):
    """删除管理员"""
    with app.app_context():
        admin = Admin.query.filter_by(username=username).first()
        if not admin:
            print(f"未找到用户: {username}")
            return
        if admin.username == "admin":
            print("警告: 不建议删除默认管理员")
            confirm = input("确认删除? (y/N): ").strip().lower()
            if confirm != "y":
                print("操作已取消")
                return
        db.session.delete(admin)
        db.session.commit()
        print(f"✓ 管理员 {username} 已删除")


def main():
    parser = argparse.ArgumentParser(description="管理员用户管理工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    init_parser = subparsers.add_parser("init", help="初始化默认管理员")
    init_parser.add_argument("--password", default=None, help="默认密码(或使用环境变量ADMIN_INIT_PASSWORD)")
    reset_parser = subparsers.add_parser("reset", help="重置管理员密码")
    reset_parser.add_argument("--username", default="admin", help="用户名")
    reset_parser.add_argument("--password", default=None, help="新密码(或使用环境变量ADMIN_RESET_PASSWORD)")
    create_parser = subparsers.add_parser("create", help="创建新管理员")
    create_parser.add_argument("username", help="用户名")
    create_parser.add_argument("password", help="密码")
    create_parser.add_argument("--name", default="管理员", help="真实姓名")
    create_parser.add_argument("--phone", default="", help="联系电话")
    create_parser.add_argument("--role", default="admin", help="角色")
    subparsers.add_parser("list", help="列出所有管理员")
    delete_parser = subparsers.add_parser("delete", help="删除管理员")
    delete_parser.add_argument("username", help="用户名")
    args = parser.parse_args()
    if args.command == "init":
        init_admin(args.password)
    elif args.command == "reset":
        reset_password(args.username, args.password)
    elif args.command == "create":
        create_admin(args.username, args.password, args.name, args.phone, args.role)
    elif args.command == "list":
        list_admins()
    elif args.command == "delete":
        delete_admin(args.username)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
