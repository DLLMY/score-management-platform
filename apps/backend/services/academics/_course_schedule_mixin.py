"""课程表 CRUD 与批量导入。"""

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


class _CourseScheduleMixin:
    def create_course_schedule(self, data):
        """创建课程安排。冲突检测/教师校验/数据隔离（请求级 400/403）由路由层完成；
        本方法仅负责写入并返回新 id。逐字节复刻 CourseScheduleList.post 的字段赋值。
        """
        schedule = CourseSchedule(
            class_info_id=data["class_info_id"],
            subject_id=data["subject_id"],
            day_of_week=data["day_of_week"],
            period_number=data["period_number"],
            teacher_id=data.get("teacher_id"),
            teacher_name=data.get("teacher_name"),
            classroom=data.get("classroom"),
            description=data.get("description"),
            color=data.get("color"),
            is_active=data.get("is_active", True),
        )
        with db_session_scope(detach=False):
            db.session.add(schedule)
            db.session.flush()
            return schedule.id

    def update_course_schedule(self, schedule_id, data):
        """更新课程安排字段。404 语义由路由层 get_or_404 保证；逐字节复刻字段赋值与 updated_at。"""
        with db_session_scope(detach=False):
            schedule = get_by_id(CourseSchedule, schedule_id)
            if schedule is None:
                return None
            schedule.class_info_id = data["class_info_id"]
            schedule.subject_id = data["subject_id"]
            schedule.day_of_week = data["day_of_week"]
            schedule.period_number = data["period_number"]
            schedule.teacher_id = data["teacher_id"]
            schedule.teacher_name = data["teacher_name"]
            schedule.classroom = data["classroom"]
            schedule.description = data["description"]
            schedule.color = data["color"]
            schedule.is_active = data["is_active"]
            schedule.updated_at = datetime.now()
            return schedule.id

    def delete_course_schedule(self, schedule_id):
        """删除课程安排。404 语义由路由层 get_or_404 保证。"""
        with db_session_scope(detach=False):
            schedule = get_by_id(CourseSchedule, schedule_id)
            if schedule:
                db.session.delete(schedule)

    def apply_course_schedule_import(self, creates, updates):
        """批量写入课程表导入结果。creates: 新建行字段 dict 列表；updates: (existing_id, 字段 dict) 列表。

        路由负责文件解析、逐行校验、关联解析、冲突检测与 messages/计数构建；本方法仅整段提交已验证的
        写操作（与原 CourseScheduleImport.post 内联 add + 末尾 commit 单事务语义逐字节一致）。
        返回 (created_count, updated_count)。
        """
        with db_session_scope(detach=False):
            created = 0
            updated = 0
            for fields in creates:
                schedule = CourseSchedule(
                    class_info_id=fields["class_info_id"],
                    subject_id=fields["subject_id"],
                    day_of_week=fields["day_of_week"],
                    period_number=fields["period_number"],
                    teacher_name=fields.get("teacher_name"),
                    classroom=fields.get("classroom"),
                    description=fields.get("description"),
                    color=fields.get("color"),
                    is_active=fields.get("is_active", True),
                )
                db.session.add(schedule)
                created += 1
            for schedule_id, fields in updates:
                existing = get_by_id(CourseSchedule, schedule_id)
                if existing is None:
                    continue
                existing.subject_id = fields["subject_id"]
                existing.teacher_name = fields.get("teacher_name", existing.teacher_name)
                existing.classroom = fields.get("classroom", existing.classroom)
                existing.description = fields.get("description", existing.description)
                existing.color = fields.get("color", existing.color)
                existing.is_active = fields.get("is_active", existing.is_active)
                existing.updated_at = datetime.now()
                updated += 1
            return created, updated
