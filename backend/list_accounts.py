#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
查看现有测试账号
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Admin, User, ClassInfo, AdminClass, SubAccount

def show_accounts():
    with app.app_context():
        print("=" * 60)
        print("    测试账号列表")
        print("=" * 60)

        # 超级管理员
        super_admin = Admin.query.filter_by(username='admin').first()
        if not super_admin:
            super_admin = Admin.query.first()
        
        print("\n[超级管理员]")
        if super_admin:
            print("  账号: admin")
            print("  密码: admin123")
            print("  权限: 全部系统权限")
            print(f"  姓名: {super_admin.real_name or '-'}")
        else:
            print("  未找到超级管理员")

        # 班主任账号
        print("\n[班主任账号]")
        teachers = Admin.query.filter(Admin.username != 'admin').all()
        for teacher in teachers:
            print(f"\n  账号: {teacher.username}")
            print(f"  密码: 123456 (如未修改)")
            print(f"  姓名: {teacher.real_name or '-'}")
            print(f"  管理班级: {teacher.class_name or '-'}")

        # 子账号（大屏）
        print("\n[数据大屏账号 (子账号)]")
        sub_accounts = SubAccount.query.all()
        for sub in sub_accounts:
            print(f"\n  账号: {sub.username}")
            print(f"  密码: 123456 (如未修改)")
            print(f"  姓名: {sub.real_name or '-'}")
            print(f"  角色: {sub.role_type or '-'}")

        # 班级信息
        print("\n[班级信息]")
        classes = ClassInfo.query.all()
        for cls in classes:
            count = User.query.filter_by(class_name=cls.name).count()
            print(f"  {cls.name} ({count}名学生)")

        print("\n" + "=" * 60)
        print("访问地址:")
        print("  前端: http://localhost:3000")
        print("  后端: http://localhost:5000")
        print("=" * 60)

        print("\n--- 快速参考 ---")
        print("admin / admin123 (超级管理员)")
        print("teacher1 / 123456 (班主任1)")
        print("teacher2 / 123456 (班主任2)")
        print("dashboard1 / 123456 (大屏1)")
        print("dashboard2 / 123456 (大屏2)")
        print("=" * 60)


if __name__ == '__main__':
    try:
        show_accounts()
    except Exception as e:
        print(f"Error: {str(e)}")
