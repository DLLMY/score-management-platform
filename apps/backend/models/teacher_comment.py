from datetime import datetime
from models import db


class TeacherComment(db.Model):
    """班主任评语：按学生维度记录阶段性评价（学期/月度/自定义），支持星级与内容。"""

    __tablename__ = "teacher_comment"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    term = db.Column(db.String(100), index=True)
    comment_type = db.Column(db.String(50), default="term")
    rating = db.Column(db.Integer)
    content = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "term": self.term,
            "comment_type": self.comment_type,
            "rating": self.rating,
            "content": self.content,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data