from datetime import datetime
from models import db


class StudyGroup(db.Model):
    __tablename__ = "study_group"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    leader_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    description = db.Column(db.String(200))
    score = db.Column(db.Float, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


class StudyGroupMember(db.Model):
    __tablename__ = "study_group_member"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("study_group.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    joined_at = db.Column(db.DateTime, default=datetime.now)


class StudyGroupScore(db.Model):
    __tablename__ = "study_group_score"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("study_group.id"), nullable=False, index=True)
    score_change = db.Column(db.Float, nullable=False)
    reason = db.Column(db.String(200))
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)
