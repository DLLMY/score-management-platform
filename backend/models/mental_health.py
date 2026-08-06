from datetime import datetime
from models import db


class MentalHealthRecord(db.Model):
    __tablename__ = "mental_health_record"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    mood_level = db.Column(db.Integer)
    stress_level = db.Column(db.Integer)
    sleep_hours = db.Column(db.Float)
    notes = db.Column(db.Text)
    recorded_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)


class MentalHealthAlert(db.Model):
    __tablename__ = "mental_health_alert"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    alert_type = db.Column(db.String(50))
    severity = db.Column(db.Integer)
    message = db.Column(db.Text)
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
