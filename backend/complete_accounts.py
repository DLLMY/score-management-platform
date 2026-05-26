#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Admin, User, ClassInfo, AdminClass, SubAccount

def complete_accounts():
    with app.app_context():
        print("=" * 60)
        print("补充缺失账号...")
        print("=" * 60)

        # 1. 检查并创建 teacher2
        teacher2 = Admin.query.filter_by(username='teacher2').first()
        if not teacher2:
            print("\n创建 teacher2 (李老师)...")
            teacher2 = Admin(
                username='teacher2',
                password='123456',
                real_name='李老师',
                phone='13800138002',
                class_name='一年级2班',
                role='teacher',
                created_at=datetime.now()
            )
            db.session.add(teacher2)
            db.session.commit()
            print("  ✓ teacher2 创建成功")

        # 2. 创建学生账号
        sample_students = [
            {'name': '张三', 'class_name': '一年级1班', 'gender': '男', 'card_id': '001'},
            {'name': '李四', 'class_name': '一年级1班', 'gender': '女', 'card_id': '002'},
            {'name': '王五', 'class_name': '一年级1班', 'gender': '男', 'card_id': '003'},
            {'name': '赵六', 'class_name': '一年级2班', 'gender': '女', 'card_id': '004'},
            {'name': '钱七', 'class_name': '一年级2班', 'gender': '男', 'card_id': '005'},
            {'name': '孙八', 'class_name': '二年级1班', 'gender': '男', 'card_id': '006'},
            {'name': '周九', 'class_name': '二年级1班', 'gender': '女', 'card_id': '007'}
        ]

        for s in sample_students:
            u = User.query.filter_by(card_id=s['card_id']).first()
            if not u:
                u = User(
                    name=s['name'],
                    class_name=s['class_name'],
                    gender=s['gender'],
                    card_id=s['card_id'],
                    current_score=80,
                    created_at=datetime.now()
                )
                db.session.add(u)
                print(f"  ✓ 创建学生 {s['name']}")

        db.session.commit()

        # 3. 创建大屏账号
        teacher1 = Admin.query.filter_by(username='teacher1').first()
        teacher2 = Admin.query.filter_by(username='teacher2').first()

        if teacher1:
            sub1 = SubAccount.query.filter_by(username='dashboard1').first()
            if not sub1:
                sub1 = SubAccount(
                    parent_admin_id=teacher1.id,
                    username='dashboard1',
                    password='123456',
                    real_name='一年级1班大屏',
                    phone='13800138011',
                    role_type='dashboard_viewer',
                    is_active=True,
                    created_at=datetime.now()
                )
                db.session.add(sub1)
                print("  ✓ dashboard1 创建成功")

        if teacher2:
            sub2 = SubAccount.query.filter_by(username='dashboard2').first()
            if not sub2:
                sub2 = SubAccount(
                    parent_admin_id=teacher2.id,
                    username='dashboard2',
                    password='123456',
                    real_name='一年级2班大屏',
                    phone='13800138012',
                    role_type='dashboard_viewer',
                    is_active=True,
                    created_at=datetime.now()
                )
                db.session.add(sub2)
                print("  ✓ dashboard2 创建成功")

        db.session.commit()

        print("\n" + "=" * 60)
        print("✅ 完整账号列表")
        print("=" * 60)

        print("\n[超级管理员]")
        print("  账号: admin")
        print("  密码: admin123")

        print("\n[班主任账号]")
        print("  账号: teacher1")
        print("  密码: 123456")
        print("  班级: 一年级1班")

        teacher2 = Admin.query.filter_by(username='teacher2').first()
        if teacher2:
            print("\n  账号: teacher2")
            print("  密码: 123456")
            print("  班级: 一年级2班")

        print("\n[数据大屏账号]")
        sub1 = SubAccount.query.filter_by(username='dashboard1').first()
        if sub1:
            print("  账号: dashboard1")
            print("  密码: 123456")

        sub2 = SubAccount.query.filter_by(username='dashboard2').first()
        if sub2:
            print("\n  账号: dashboard2")
            print("  密码: 123456")

        print("\n" + "=" * 60)
        print("现在可以登录了！")
        print("  前端: http://localhost:3000")
        print("=" * 60)


if __name__ == '__main__':
    complete_accounts()
