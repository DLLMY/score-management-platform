from datetime import datetime
from models import db


class ClassCommittee(db.Model):
    __tablename__ = "class_committee"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    position = db.Column(db.String(50), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    responsibilities = db.Column(db.Text)
    rating = db.Column(db.Integer, default=0)
    term_start = db.Column(db.Date)
    term_end = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "position": self.position,
            "student_id": self.student_id,
            "responsibilities": self.responsibilities,
            "rating": self.rating,
            "term_start": self.term_start,
            "term_end": self.term_end,
            "is_active": self.is_active,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class CommitteeTerm(db.Model):
    __tablename__ = "committee_term"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    term_name = db.Column(db.String(50))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    is_current = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "term_name": self.term_name,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "is_current": self.is_current,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data