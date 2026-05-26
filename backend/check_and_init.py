#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Admin, User, ClassInfo, AdminClass, SubAccount

def check_and_init():
    with app.app_context():
        print("=" * 60)
        print("检查现有数据...")
        print("=" * 60)

        print("\n[现有的管理员账号:")
        admins = Admin.query.all()
        if admins:
            for admin in admins:
                print(f"  - {admin.username} / {admin.password} ({admin.real_name or '-'}, class: {admin.class_name or '-'})")
        else:
            print("  (无管理员账号，开始创建...")

            # 创建账号
            print("\n开始创建测试账号...")

            # 1. 超级管理员
            admin1 = Admin(
                username='admin',
                password='admin123',
                real_name='系统管理员',
                phone='13800000000',
                class_name=None,
                role='admin',
                created_at=datetime.now()
            )
            db.session.add(admin1)
            db.session.commit()
            print("  ✓ 超级管理员 admin / admin123 创建成功")

            # 2. 班主任1
            teacher1 = Admin(
                username='teacher1',
                password='123456',
                real_name='张老师',
                phone='13800138001',
                class_name='一年级1班',
                role='teacher',
                created_at=datetime.now()
            )
            db.session.add(teacher1)
            db.session.commit()
            print("  ✓ 班主任 teacher1 / 123456 创建成功")

            # 3. 班主任2
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
            print("  ✓ 班主任 teacher2 / 123456 创建成功")

            # 4. 创建学生数据
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
                existing = User.query.filter_by(card_id=s['card_id']).first()
                if not existing:
                    u = User(
                        name=s['name'],
                        class_name=s['class_name'],
                        gender=s['gender'],
                        card_id=s['card_id'],
                        current_score=80,
                        created_at=datetime.now()
                    )
                    db.session.add(u)

            db.session.commit()
            print("  ✓ 示例学生数据创建完成")

            # 5. 创建大屏子账号
            teacher1 = Admin.query.filter_by(username='teacher1').first()
            teacher2 = Admin.query.filter_by(username='teacher2').first()

            if teacher1:
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

            if teacher2:
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

            db.session.commit()
            print("  ✓ 大屏子账号创建完成")

        print("\n" + "=" * 60)
        print("完成！现在可用的账号:")
        print("=" * 60)
        print("\n超级管理员: admin / admin123")
        print("班主任1: teacher1 / 123456 (一年级1班)")
        print("班主任2: teacher2 / 123456 (一年级2班)")
        print("大屏1: dashboard1 / 123456")
        print("大屏2: dashboard2 / 123456")
        print("=" * 60)


if __name__ == '__main__':
    try:
        check_and_init()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
