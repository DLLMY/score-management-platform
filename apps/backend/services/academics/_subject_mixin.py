"""科目与科目-班级关联 CRUD + 排序。"""

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


class _SubjectMixin:
    def create_subject(self, data):
        """创建科目。名称/代码重复校验（请求级 400）由路由层完成；本方法仅负责写入并返回新 id。"""
        subject = Subject(
            name=data["name"],
            code=data.get("code"),
            grade=data.get("grade"),
            description=data.get("description"),
            color=data.get("color", "#10B981"),
            is_active=data.get("is_active", True),
        )
        with db_session_scope(detach=False):
            db.session.add(subject)
            db.session.flush()
            return subject.id

    def toggle_subject(self, subject):
        """切换科目启用/禁用。subject 由路由 get_or_404 加载（同作用域 session，autoflush 落库）。"""
        with db_session_scope(detach=False):
            subject.is_active = not subject.is_active
            subject.updated_at = datetime.now()
            return subject.id

    def update_subject(self, subject, data):
        """更新科目字段。名称/代码重复校验由路由层完成；本方法逐字节复刻字段赋值与 updated_at。"""
        with db_session_scope(detach=False):
            subject.name = data.get("name", subject.name)
            subject.code = data.get("code", subject.code)
            subject.grade = data.get("grade", subject.grade)
            subject.description = data.get("description", subject.description)
            subject.color = data.get("color", subject.color)
            subject.is_active = data.get("is_active", subject.is_active)
            subject.updated_at = datetime.now()
            return subject.id

    def delete_subject(self, subject_id):
        """删除科目（先级联清理子表关联，再删父记录）。404 语义由路由 get_or_404 保证。"""
        with db_session_scope(detach=False):
            subject = Subject.query.get(subject_id)
            if subject is None:
                return
            cascade_delete_related_records(Subject, subject_id)
            db.session.delete(subject)

    def create_subject_class(self, subject_id, class_info_id, teacher_id):
        """新增科目-班级关联。重复/班级存在校验由路由层完成；返回新关联 id。"""
        link = SubjectClass(
            subject_id=subject_id, class_info_id=class_info_id, teacher_id=teacher_id
        )
        with db_session_scope(detach=False):
            db.session.add(link)
            db.session.flush()
            return link.id

    def update_subject_class(self, link, teacher_id):
        """更新科目-班级关联（如更换授课教师）。link 由路由 first_or_404 加载；teacher_id 为 None 表示清空。"""
        with db_session_scope(detach=False):
            link.teacher_id = teacher_id
            return link.id

    def delete_subject_class(self, link):
        """删除科目-班级关联。link 由路由 first_or_404 加载。"""
        with db_session_scope(detach=False):
            db.session.delete(link)

    def update_subject_order(self, data):
        """批量更新科目排序；异常由 db_session_scope 回滚并上抛，路由捕获后回 500。

        优化点评估 2026-10-03：将逐条 Subject.query.get 的 N 次查询收敛为一次 in_() 批量预取，
        避免批量排序端点的 N+1（写路径非热路径，但量级随科目数线性增长）。
        """
        with db_session_scope(detach=False):
            ids = [item.get("id") for item in data if item.get("id") is not None]
            subjects = Subject.query.filter(Subject.id.in_(ids)).all() if ids else []
            by_id = {s.id: s for s in subjects}
            for item in data:
                subject = by_id.get(item.get("id"))
                if subject:
                    subject.sort_order = item.get("order", 0)
