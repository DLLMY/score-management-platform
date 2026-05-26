#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
初始化测试账号脚本
用于创建完整的测试账号，包括：
- 超级管理员
- 2个班主任
- 2个数据大屏账号
- 示例学生数据
"""

import sys
import os
from datetime import datetime

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Admin, User, ClassInfo, AdminClass, SubAccount, RolePermission

def init_test_data():
    """初始化测试数据"""
    with app.app_context():
        print("=" * 60)
        print("开始初始化测试账号...")
        print("=" * 60)

        # 1. 检查是否已有账号
        existing_admins = Admin.query.all()
        print(f"\n当前已存在 {len(existing_admins)} 个管理员账号")

        if not existing_admins:
            print("\n创建默认超级管理员账号...")

            # 超级管理员 - 全系统权限
            super_admin = Admin(
                username='admin',
                password='admin123',
                real_name='系统管理员',
                phone='13800000000',
                class_name=None,
                role='admin',
                created_at=datetime.now()
            )
            db.session.add(super_admin)
            db.session.commit()
            print(f"✓ 超级管理员创建成功: admin / admin123")

        # 2. 创建班主任账号
        teacher1 = Admin.query.filter_by(username='teacher1').first()
        if not teacher1:
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
            print("✓ 班主任1创建成功: teacher1 / 123456")

        teacher2 = Admin.query.filter_by(username='teacher2').first()
        if not teacher2:
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
            print("✓ 班主任2创建成功: teacher2 / 123456")

        # 3. 创建班级关联
        class1 = ClassInfo.query.filter_by(name='一年级1班').first()
        class2 = ClassInfo.query.filter_by(name='一年级2班').first()
        class3 = ClassInfo.query.filter_by(name='二年级1班').first()

        # 为老师分配班级
        teacher1 = Admin.query.filter_by(username='teacher1').first()
        teacher2 = Admin.query.filter_by(username='teacher2').first()
        super_admin = Admin.query.filter_by(username='admin').first()

        if class1 and teacher1:
            link1 = AdminClass.query.filter_by(admin_id=teacher1.id, class_info_id=class1.id).first()
            if not link1:
                link1 = AdminClass(admin_id=teacher1.id, class_info_id=class1.id, is_primary=True)
                db.session.add(link1)

        if class2 and teacher2:
            link2 = AdminClass.query.filter_by(admin_id=teacher2.id, class_info_id=class2.id).first()
            if not link2:
                link2 = AdminClass(admin_id=teacher2.id, class_info_id=class2.id, is_primary=True)
                db.session.add(link2)

        # 超级管理员分配所有班级
        if super_admin:
            for cls in [class1, class2, class3]:
                if cls:
                    link = AdminClass.query.filter_by(admin_id=super_admin.id, class_info_id=cls.id).first()
                    if not link:
                        link = AdminClass(admin_id=super_admin.id, class_info_id=cls.id, is_primary=False)
                        db.session.add(link)

        db.session.commit()
        print("✓ 班级关联完成")

        # 4. 创建数据大屏子账号
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
                    permissions='["dashboard.view", "user.view", "score.view", "record.view"]',
                    is_active=True,
                    created_at=datetime.now()
                )
                db.session.add(sub1)
                print("✓ 大屏账号1创建成功: dashboard1 / 123456")

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
                    permissions='["dashboard.view", "user.view", "score.view", "record.view"]',
                    is_active=True,
                    created_at=datetime.now()
                )
                db.session.add(sub2)
                print("✓ 大屏账号2创建成功: dashboard2 / 123456")

        db.session.commit()

        # 5. 创建示例学生数据
        sample_students = [
            {'name': '张三', 'class_name': '一年级1班', 'gender': '男', 'card_id': '001'},
            {'name': '李四', 'class_name': '一年级1班', 'gender': '女', 'card_id': '002'},
            {'name': '王五', 'class_name': '一年级1班', 'gender': '男', 'card_id': '003'},
            {'name': '赵六', 'class_name': '一年级2班', 'gender': '女', 'card_id': '004'},
            {'name': '钱七', 'class_name': '一年级2班', 'gender': '男', 'card_id': '005'},
            {'name': '孙八', 'class_name': '二年级1班', 'gender': '男', 'card_id': '006'},
            {'name': '周九', 'class_name': '二年级1班', 'gender': '女', 'card_id': '007'}
        ]

        for student_data in sample_students:
            existing = User.query.filter_by(card_id=student_data['card_id']).first()
            if not existing:
                student = User(
                    name=student_data['name'],
                    class_name=student_data['class_name'],
                    gender=student_data['gender'],
                    card_id=student_data['card_id'],
                    phone='',
                    current_score=80,
                    created_at=datetime.now()
                )
                db.session.add(student)

        db.session.commit()
        print("✓ 示例学生数据创建完成")

        print("\n" + "=" * 60)
        print("初始化完成！")
        print("=" * 60)

        # 输出完整账号列表
        print("\n" + "=" * 60)
        print("🔑 测试账号列表")
        print("=" * 60)

        print("\n👑 超级管理员:")
        print("  账号: admin")
        print("  密码: admin123")
        print("  权限: 全部系统权限")

        print("\n👨‍🏫 班主任账号:")
        print("  账号: teacher1")
        print("  密码: 123456")
        print("  管理: 一年级1班")
        print("")
        print("  账号: teacher2")
        print("  密码: 123456")
        print("  管理: 一年级2班")

        print("\n📊 数据大屏账号 (子账号):")
        print("  账号: dashboard1")
        print("  密码: 123456")
        print("  权限: 查看一年级1班数据 (只读)")
        print("")
        print("  账号: dashboard2")
        print("  密码: 123456")
        print("  权限: 查看一年级2班数据 (只读)")

        print("\n🎓 示例学生 (7人):")
        print("  一年级1班: 张三, 李四, 王五")
        print("  一年级2班: 赵六, 钱七")
        print("  二年级1班: 孙八, 周九")

        print("\n📊 示例班级:")
        classes = ClassInfo.query.all()
        for cls in classes:
            count = User.query.filter_by(class_name=cls.name).count()
            print(f"  {cls.name} ({count}名学生)")

        print("\n" + "=" * 60)
        print("✅ 所有数据初始化完成！")
        print("=" * 60)
        print("\n访问地址:")
        print("  前端: http://localhost:3000")
        print("  后端: http://localhost:5000")
        print("  API文档: http://localhost:5000/api/docs/")
        print("=" * 60)


if __name__ == '__main__':
    try:
        init_test_data()
    except Exception as e:
        print(f"初始化失败: {str(e)}")
        import traceback
        traceback.print_exc()
