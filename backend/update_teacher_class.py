#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Admin, ClassInfo, AdminClass, User

def update_teacher_class():
    with app.app_context():
        print("=" * 60)
        print("更新张老师班级关联")
        print("=" * 60)

        # 1. 找到张老师
        teacher = Admin.query.filter_by(username='teacher1').first()
        if not teacher:
            print("错误：未找到 teacher1 用户")
            return

        print(f"\n找到教师: {teacher.username} - {teacher.real_name}")

        # 2. 查找或创建班级
        class_name = '25电气五年制'
        class_info = ClassInfo.query.filter_by(name=class_name).first()
        
        if not class_info:
            print(f"\n创建班级: {class_name}")
            class_info = ClassInfo(
                name=class_name,
                grade='25电气',
                description='25级电气五年制班级'
            )
            db.session.add(class_info)
            db.session.commit()
            print(f"  ✓ 班级创建成功")
        else:
            print(f"\n找到班级: {class_name}")

        # 3. 更新教师的班级字段
        teacher.class_name = class_name
        teacher.updated_at = datetime.now()
        db.session.commit()
        print(f"  ✓ 更新教师主班级为: {class_name}")

        # 4. 移除旧的班级关联（如果有）
        old_links = AdminClass.query.filter_by(admin_id=teacher.id).all()
        for link in old_links:
            db.session.delete(link)
        db.session.commit()
        print(f"  ✓ 清除旧的班级关联")

        # 5. 创建新的班级关联
        new_link = AdminClass(
            admin_id=teacher.id,
            class_info_id=class_info.id,
            is_primary=True
        )
        db.session.add(new_link)
        db.session.commit()
        print(f"  ✓ 创建新的班级关联")

        # 6. 显示该班级的学生
        students = User.query.filter_by(class_name=class_name).all()
        print(f"\n班级 '{class_name}' 的学生 ({len(students)}人):")
        for s in students:
            print(f"  - {s.name} ({s.card_id}) - {s.current_score}分")

        print("\n" + "=" * 60)
        print("✅ 操作完成！")
        print("=" * 60)
        print(f"\n张老师现在关联到: {class_name}")
        print(f"班级学生数: {len(students)}人")
        print("\n现在用 teacher1 / 123456 登录测试数据隔离")
        print("=" * 60)


if __name__ == '__main__':
    update_teacher_class()
