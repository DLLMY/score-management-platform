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



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "title": self.title,
            "description": self.description,
            "activity_type": self.activity_type,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "location": self.location,
            "organizer": self.organizer,
            "is_published": self.is_published,
            "created_by": self.created_by,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class ActivityRegistration(db.Model):
    __tablename__ = "activity_registration"

    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey("activity.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    status = db.Column(db.String(20), default="registered")
    registered_at = db.Column(db.DateTime, default=datetime.now)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "activity_id": self.activity_id,
            "student_id": self.student_id,
            "status": self.status,
            "registered_at": self.registered_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data