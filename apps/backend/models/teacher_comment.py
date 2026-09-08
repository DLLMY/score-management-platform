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
