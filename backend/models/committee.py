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


class CommitteeTerm(db.Model):
    __tablename__ = "committee_term"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    term_name = db.Column(db.String(50))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    is_current = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
