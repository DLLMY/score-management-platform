from datetime import datetime
from models import db


class StudyGuide(db.Model):
    __tablename__ = "study_guide"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    guide_type = db.Column(db.String(50))
    content = db.Column(db.Text)
    target_audience = db.Column(db.String(50))
    is_published = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "title": self.title,
            "guide_type": self.guide_type,
            "content": self.content,
            "target_audience": self.target_audience,
            "is_published": self.is_published,
            "created_by": self.created_by,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class ImprovementPlan(db.Model):
    __tablename__ = "improvement_plan"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    plan_type = db.Column(db.String(50))
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), index=True)
    target_score = db.Column(db.Float)
    current_score = db.Column(db.Float)
    plan_content = db.Column(db.Text)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    progress = db.Column(db.Integer, default=0)
    is_completed = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)
