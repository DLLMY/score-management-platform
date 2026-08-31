from datetime import datetime
from models import db


class Attendance(db.Model):
    __tablename__ = "attendance"

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
