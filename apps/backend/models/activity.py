from datetime import datetime
from models import db


class Activity(db.Model):
    __tablename__ = "activity"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    activity_type = db.Column(db.String(50))
    start_date = db.Column(db.DateTime)
    end_date = db.Column(db.DateTime)
    location = db.Column(db.String(200))
    organizer = db.Column(db.String(50))
    is_published = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)


class ActivityRegistration(db.Model):
    __tablename__ = "activity_registration"

    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey("activity.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    status = db.Column(db.String(20), default="registered")
    registered_at = db.Column(db.DateTime, default=datetime.now)
