from datetime import datetime
from models import db


class HomeworkAssignment(db.Model):
    __tablename__ = "homework_assignment"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), index=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    assigned_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    is_completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "title": self.title,
            "description": self.description,
            "assigned_date": self.assigned_date,
            "due_date": self.due_date,
            "assigned_by": self.assigned_by,
            "is_completed": self.is_completed,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class HomeworkSubmission(db.Model):
    __tablename__ = "homework_submission"

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(
        db.Integer, db.ForeignKey("homework_assignment.id"), nullable=False, index=True
    )
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    is_submitted = db.Column(db.Boolean, default=False)
    submitted_at = db.Column(db.DateTime, nullable=True)
    is_late = db.Column(db.Boolean, default=False)
    notes = db.Column(db.String(500))
    checked_by = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
