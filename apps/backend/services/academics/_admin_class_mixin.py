"""管理员-班级关联（第 1 子批：assign/remove）。"""

from datetime import datetime

from models import (
    Admin,
    AdminClass,
    ClassInfo,
    CourseSchedule,
    Exam,
    ImportConfig,
    Score,
    Subject,
    SubjectClass,
    User,
    cascade_delete_related_records,
    db,
    get_by_id,
)
from utils.db_session import db_session_scope


class _AdminClassMixin:
    def assign_class_to_admin(self, admin_id, class_id, is_primary, class_info):
        """为管理员分配班级（含班主任主班同步）。404 语义由路由层 get_or_404 保证。

        一次性事务：新增/更新 AdminClass 关联；若设为主班，同步 ClassInfo.head_teacher_id，
        并将该管理员其他班级 is_primary 置 False，且清理原班主任的 is_primary。
        """
        with db_session_scope(detach=False):
            existing_link = AdminClass.query.filter_by(
                admin_id=admin_id, class_info_id=class_id
            ).first()
            if existing_link:
                existing_link.is_primary = is_primary
            else:
                link = AdminClass(
                    admin_id=admin_id,
                    class_info_id=class_id,
                    is_primary=is_primary,
                    assigned_at=datetime.now(),
                )
                db.session.add(link)

            if is_primary:
                # 保存之前的班主任ID，用于后续清理
                prev_head_teacher_id = class_info.head_teacher_id

                # 将该班级的班主任设置为当前管理员
                class_info.head_teacher_id = admin_id

                # 将该管理员其他班级的 is_primary 设置为 False
                AdminClass.query.filter(
                    AdminClass.admin_id == admin_id, AdminClass.class_info_id != class_id
                ).update({"is_primary": False})

                # 将该班级之前的班主任的 is_primary 设置为 False（如果存在且不同）
                if prev_head_teacher_id and prev_head_teacher_id != admin_id:
                    prev_admin_link = AdminClass.query.filter_by(
                        admin_id=prev_head_teacher_id, class_info_id=class_id
                    ).first()
                    if prev_admin_link:
                        prev_admin_link.is_primary = False

    def remove_class_from_admin(self, admin_id, class_id):
        """移除管理员与班级的关联。返回 False 表示未找到关联记录（路由据此回 404）。"""
        link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
        if not link:
            return False

        with db_session_scope(detach=False):
            # 如果移除的是主要班级（班主任），清空 ClassInfo.head_teacher_id
            class_info = get_by_id(ClassInfo, class_id)
            if class_info and class_info.head_teacher_id == admin_id:
                class_info.head_teacher_id = None

            db.session.delete(link)

        return True
