from datetime import datetime

from models import db


class DutyGroup(db.Model):
    __tablename__ = "duty_group"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    day_of_week = db.Column(db.String(20))
    area = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    # R16 修复: 值日分组排序复合索引，消弭 USE TEMP B-TREE FOR ORDER BY（ORDER BY day_of_week, name）
    __table_args__ = (
        db.Index("ix_duty_group_day_name", "day_of_week", "name"),
    )



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "name": self.name,
            "day_of_week": self.day_of_week,
            "area": self.area,
            "is_active": self.is_active,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class DutyAssignment(db.Model):
    __tablename__ = "duty_assignment"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("duty_group.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    task = db.Column(db.String(200))
    is_completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    checked_by = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "group_id": self.group_id,
            "student_id": self.student_id,
            "date": self.date,
            "task": self.task,
            "is_completed": self.is_completed,
            "completed_at": self.completed_at,
            "checked_by": self.checked_by,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data