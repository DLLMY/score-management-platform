# -*- coding: utf-8 -*-
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db, Permission

"""
班主任工作台 - 11个新模块数据库迁移脚本

创建以下模块的数据库表：
1. 座次表模块: seating_chart, seating_seat
2. 值日生模块: duty_group, duty_assignment
3. 班委模块: class_committee, committee_term
4. 家长联系模块: parent_contact, contact_log
5. 作业检查模块: homework_assignment, homework_submission
6. 考勤管理模块: attendance, leave_application
7. 学习小组模块: study_group, study_group_member, study_group_score
8. 心理健康模块: mental_health_record, mental_health_alert
9. 文体活动模块: activity, activity_registration
10. 班级文化模块: culture_record, culture_item
11. 学法指导模块: study_guide, improvement_plan

同时初始化新模块的权限码到 Permission 表
"""


def run_migration():
    with app.app_context():
        # 创建新表（如果不存在）
        try:
            db.create_all()
            print("班主任工作台模块表创建完成")
        except Exception as e:
            print(f"创建表时出现异常（可能部分表已存在）: {e}")
            db.session.rollback()

        # 初始化新模块的权限码
        new_permissions = [
            # 作业检查模块
            {"code": "homework.view", "name": "查看作业", "category": "homework"},
            {"code": "homework.edit", "name": "编辑作业", "category": "homework"},
            {"code": "homework.check", "name": "批改作业", "category": "homework"},
            # 考勤管理模块
            {"code": "attendance.view", "name": "查看考勤", "category": "attendance"},
            {"code": "attendance.edit", "name": "编辑考勤", "category": "attendance"},
            {"code": "attendance.approve", "name": "审批请假", "category": "attendance"},
            # 心理健康模块
            {"code": "mental_health.view", "name": "查看心理健康", "category": "mental_health"},
            {"code": "mental_health.edit", "name": "编辑心理健康", "category": "mental_health"},
            # 文体活动模块
            {"code": "activity.view", "name": "查看活动", "category": "activity"},
            {"code": "activity.edit", "name": "编辑活动", "category": "activity"},
            # 学习小组模块
            {"code": "study_group.view", "name": "查看学习小组", "category": "study_group"},
            {"code": "study_group.edit", "name": "编辑学习小组", "category": "study_group"},
            # 学法指导模块
            {"code": "study_guide.view", "name": "查看学法指导", "category": "study_guide"},
            {"code": "study_guide.edit", "name": "编辑学法指导", "category": "study_guide"},
        ]

        added_count = 0
        skipped_count = 0

        for perm_data in new_permissions:
            try:
                # 幂等性检查：使用 first_or_404 风格的查询，确保不重复插入
                existing = Permission.query.filter_by(code=perm_data["code"]).first()
                if not existing:
                    permission = Permission(**perm_data)
                    db.session.add(permission)
                    added_count += 1
                    print(f"添加权限: {perm_data['code']}")
                else:
                    skipped_count += 1
                    print(f"权限已存在，跳过: {perm_data['code']}")
            except Exception as e:
                print(f"处理权限 {perm_data['code']} 时出错: {e}")
                db.session.rollback()
                continue

        try:
            db.session.commit()
            print(f"\n权限初始化完成：新增 {added_count} 个，跳过 {skipped_count} 个（已存在）")
        except Exception as e:
            print(f"提交权限数据时出错: {e}")
            db.session.rollback()
            # 尝试逐条提交
            for perm_data in new_permissions:
                try:
                    existing = Permission.query.filter_by(code=perm_data["code"]).first()
                    if not existing:
                        permission = Permission(**perm_data)
                        db.session.add(permission)
                        db.session.commit()
                        print(f"单条提交成功: {perm_data['code']}")
                except Exception as e2:
                    print(f"单条提交失败 {perm_data['code']}: {e2}")
                    db.session.rollback()

        print("\n班主任工作台模块迁移完成!")


if __name__ == "__main__":
    run_migration()