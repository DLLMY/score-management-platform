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



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "name": self.name,
            "leader_id": self.leader_id,
            "description": self.description,
            "score": self.score,
            "is_active": self.is_active,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class StudyGroupMember(db.Model):
    __tablename__ = "study_group_member"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("study_group.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    joined_at = db.Column(db.DateTime, default=datetime.now)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "group_id": self.group_id,
            "student_id": self.student_id,
            "joined_at": self.joined_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class StudyGroupScore(db.Model):
    __tablename__ = "study_group_score"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("study_group.id"), nullable=False, index=True)
    score_change = db.Column(db.Float, nullable=False)
    reason = db.Column(db.String(200))
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "group_id": self.group_id,
            "score_change": self.score_change,
            "reason": self.reason,
            "created_by": self.created_by,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data