#!/usr/bin/env python3
"""
初始化默认管理员用户脚本
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from models import db, Admin
from utils.security import hash_password


def init_admin():
    with app.app_context():
        # 检查是否已存在管理员
        existing_admin = Admin.query.first()

        if existing_admin:
            print(f"数据库中已有管理员用户: {existing_admin.username}")
            print("跳过初始化")
            return

        # 创建默认管理员
        print("创建默认管理员用户...")
        admin = Admin(
            username="admin",
            password=hash_password("admin123"),
            role="admin",
            real_name="系统管理员",
            phone="13800138000",
        )

        db.session.add(admin)
        db.session.commit()

        print("默认管理员创建成功!")
        print("-" * 50)
        print("用户名: admin")
        print("密码: admin123")
        print("-" * 50)


if __name__ == "__main__":
    init_admin()
