from datetime import datetime
from models import db


class ParentContact(db.Model):
    __tablename__ = "parent_contact"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    father_name = db.Column(db.String(50))
    father_phone = db.Column(db.String(20))
    mother_name = db.Column(db.String(50))
    mother_phone = db.Column(db.String(20))
    address = db.Column(db.String(200))
    email = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "father_name": self.father_name,
            "father_phone": self.father_phone,
            "mother_name": self.mother_name,
            "mother_phone": self.mother_phone,
            "address": self.address,
            "email": self.email,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class ContactLog(db.Model):
    __tablename__ = "contact_log"

    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(
        db.Integer, db.ForeignKey("parent_contact.id"), nullable=False, index=True
    )
    contact_type = db.Column(db.String(20))
    content = db.Column(db.Text)
    contact_time = db.Column(db.DateTime, default=datetime.now)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    follow_up_needed = db.Column(db.Boolean, default=False)
    follow_up_time = db.Column(db.DateTime, nullable=True)
    is_resolved = db.Column(db.Boolean, default=False)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "parent_id": self.parent_id,
            "contact_type": self.contact_type,
            "content": self.content,
            "contact_time": self.contact_time,
            "created_by": self.created_by,
            "follow_up_needed": self.follow_up_needed,
            "follow_up_time": self.follow_up_time,
            "is_resolved": self.is_resolved,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data