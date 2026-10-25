"""考试 CRUD 与发布/关闭。"""

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
from utils.datetime_utils import parse_date, parse_datetime
from utils.db_session import db_session_scope


class _ExamMixin:
    def create_exam(self, data):
        """创建考试。name/date 必填校验（请求级 400）由路由层完成；本方法仅负责写入并返回新 id。

        字段解析（parse_date/parse_datetime）与原文 ExamList.post 内联逻辑逐字节一致。
        """
        exam = Exam(
            name=data.get("name"),
            description=data.get("description"),
            date=parse_date(data.get("date")),
            subjects=data.get("subjects", []),
            start_time=parse_datetime(data.get("start_time")),
            end_time=parse_datetime(data.get("end_time")),
            importance=data.get("importance", "medium"),
            class_id=data.get("class_id"),
            status=data.get("status", "draft"),
            created_by=data.get("created_by"),
        )
        with db_session_scope(detach=False):
            db.session.add(exam)
            db.session.flush()
            return exam.id

    def update_exam(self, exam_id, data):
        """更新考试字段。404 语义由路由层 get_by_id 保证；逐字节复刻字段赋值与 updated_at。"""
        with db_session_scope(detach=False):
            exam = get_by_id(Exam, exam_id)
            if exam is None:
                return None
            for key in [
                "name",
                "description",
                "date",
                "subjects",
                "start_time",
                "end_time",
                "importance",
                "class_id",
                "status",
            ]:
                if key in data:
                    if key in ("start_time", "end_time"):
                        setattr(exam, key, parse_datetime(data[key]))
                    elif key == "date":
                        setattr(exam, key, parse_date(data[key]))
                    else:
                        setattr(exam, key, data[key])
            exam.updated_at = datetime.now()
            return exam.id

    def delete_exam(self, exam_id):
        """删除考试（先级联清理子表成绩，再删父记录）。404 语义由路由层 get_by_id 保证。"""
        with db_session_scope(detach=False):
            cascade_delete_related_records(Exam, exam_id)
            exam = get_by_id(Exam, exam_id)
            if exam:
                db.session.delete(exam)

    def publish_exam(self, exam_id):
        """发布考试（草稿→已发布）。状态前置校验（已发布幂等/非草稿报错）由路由层完成。"""
        with db_session_scope(detach=False):
            exam = get_by_id(Exam, exam_id)
            if exam is None:
                return None
            exam.status = "published"
            exam.updated_at = datetime.now()
            return exam.id

    def close_exam(self, exam_id):
        """结束考试（已发布→已关闭）。状态前置校验由路由层完成。"""
        with db_session_scope(detach=False):
            exam = get_by_id(Exam, exam_id)
            if exam is None:
                return None
            exam.status = "closed"
            exam.updated_at = datetime.now()
            return exam.id
