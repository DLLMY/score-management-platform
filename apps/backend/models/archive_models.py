from datetime import datetime
from models import db


class ScoreArchive(db.Model):
    """成绩历史归档表（P1）：结构与 scores 一致，额外增加 archived_at 标记归档时间。

    仅承载冷数据（历史学年成绩）。不复制 (exam,student,subject) 唯一约束，因为归档
    允许同一条逻辑记录随学年多次出现。归档/还原由 scripts/migrate_archive_tables.py 负责。
    """

    __tablename__ = "scores_archive"

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), nullable=False, index=True)
    score = db.Column(db.Float)
    full_score = db.Column(db.Float, default=100)
    status = db.Column(db.String(20), default="pending", index=True)
    remark = db.Column(db.String(200))
    entered_by = db.Column(db.Integer, db.ForeignKey("admin.id"), index=True)
    entered_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    archived_at = db.Column(db.DateTime, default=datetime.now, index=True)

    exam = db.relationship("Exam", backref=db.backref("score_archives", lazy=True))
    student = db.relationship("User", backref=db.backref("score_archives", lazy=True))
    admin = db.relationship("Admin", backref=db.backref("score_archives", lazy=True))
    subject_rel = db.relationship("Subject", backref=db.backref("score_archive_records", lazy=True))



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "subject_id": self.subject_id,
            "score": self.score,
            "full_score": self.full_score,
            "status": self.status,
            "remark": self.remark,
            "entered_by": self.entered_by,
            "entered_at": self.entered_at,
            "updated_at": self.updated_at,
            "archived_at": self.archived_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class AttendanceArchive(db.Model):
    """考勤历史归档表（P1）：结构与 attendance 一致，额外增加 archived_at 标记归档时间。"""

    __tablename__ = "attendance_archive"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    period = db.Column(db.String(20))
    status = db.Column(db.String(20), default="present")
    arrive_time = db.Column(db.DateTime, nullable=True)
    leave_time = db.Column(db.DateTime, nullable=True)
    recorded_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    notes = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.now)
    archived_at = db.Column(db.DateTime, default=datetime.now, index=True)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "student_id": self.student_id,
            "date": self.date,
            "period": self.period,
            "status": self.status,
            "arrive_time": self.arrive_time,
            "leave_time": self.leave_time,
            "recorded_by": self.recorded_by,
            "notes": self.notes,
            "created_at": self.created_at,
            "archived_at": self.archived_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class OperationLogArchive(db.Model):
    """操作日志归档"""

    __tablename__ = "operation_log_archives"

    id = db.Column(db.Integer, primary_key=True)
    original_id = db.Column(db.Integer, index=True)
    admin_id = db.Column(db.Integer, index=True)
    action = db.Column(db.String(100))
    details = db.Column(db.JSON)
    archived_at = db.Column(db.DateTime, default=datetime.now, index=True)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "original_id": self.original_id,
            "admin_id": self.admin_id,
            "action": self.action,
            "details": self.details,
            "archived_at": self.archived_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data