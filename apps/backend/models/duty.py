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
