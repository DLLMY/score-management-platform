from datetime import datetime
from models import db


class ScoreCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.String(200))
    color = db.Column(db.String(20), default="#3B82F6")
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    code = db.Column(db.String(20), unique=True)
    grade = db.Column(db.String(20))
    description = db.Column(db.String(200))
    color = db.Column(db.String(20), default="#10B981")
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class ScoreRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    description = db.Column(db.String(500))
    category_id = db.Column(db.Integer, db.ForeignKey("score_category.id"), index=True)
    score = db.Column(db.Float, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    daily_limit = db.Column(db.Integer, default=0)
    min_interval = db.Column(db.Integer, default=0)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    min_score = db.Column(db.Integer)
    max_score = db.Column(db.Integer)
    score_type = db.Column(db.Text)
    conditions = db.Column(db.Text)
    action = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    category = db.relationship("ScoreCategory", backref="rules")


class ScoreRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    rule_id = db.Column(db.Integer, db.ForeignKey("score_rule.id"), index=True)
    score_change = db.Column(db.Float, nullable=False, index=True)
    description = db.Column(db.String(500))
    operator = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    user = db.relationship("User", backref="records")
    rule = db.relationship("ScoreRule", backref="records")


class ScoreRankRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    min_score = db.Column(db.Integer, nullable=False)
    max_score = db.Column(db.Integer)
    color = db.Column(db.String(20), default="#0ea5e9")
    icon = db.Column(db.String(50), default="Award")
    description = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)
    unlock_min_score = db.Column(
        db.Integer, nullable=True, comment="开门最低分数要求，NULL则使用全局默认值"
    )
    weekly_unlock_limit = db.Column(
        db.Integer, nullable=True, comment="每周开门次数限制，NULL则使用全局默认值"
    )
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class Exam(db.Model):
    __tablename__ = "exams"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    exam_type = db.Column(db.String(50))
    date = db.Column(db.DateTime)
    description = db.Column(db.Text)
    subjects = db.Column(db.JSON)
    start_time = db.Column(db.DateTime, index=True)
    end_time = db.Column(db.DateTime, index=True)
    importance = db.Column(db.String(20), default="medium", index=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), index=True)
    status = db.Column(db.String(20), default="draft", index=True)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"), index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "exam_type": self.exam_type,
            "date": self.date.isoformat() if self.date else None,
            "description": self.description,
            "subjects": self.subjects,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "importance": self.importance,
            "class_id": self.class_id,
            "status": self.status,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    class_info = db.relationship("ClassInfo", backref=db.backref("exams", lazy=True))
    admin = db.relationship("Admin", backref=db.backref("exams", lazy=True))


class Score(db.Model):
    __tablename__ = "scores"

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), nullable=False, index=True)
    score = db.Column(db.Float)
    full_score = db.Column(db.Float, default=100)
    status = db.Column(db.String(20), default="pending", index=True)
    remark = db.Column(db.String(200))
    entered_by = db.Column(db.Integer, db.ForeignKey("admin.id"), index=True)
    entered_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)  # R7

    # R3 修复: (exam, student, subject) 唯一约束——此前仅应用层 check-then-act，并发/重复录入可写重复成绩
    __table_args__ = (
        db.UniqueConstraint(
            "exam_id", "student_id", "subject_id", name="uq_scores_exam_student_subject"
        ),
    )

    exam = db.relationship("Exam", backref=db.backref("scores", lazy=True))
    student = db.relationship("User", backref=db.backref("scores", lazy=True))
    admin = db.relationship("Admin", backref=db.backref("scores", lazy=True))
    subject_rel = db.relationship("Subject", backref=db.backref("score_records", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "subject_id": self.subject_id,
            "subject": self.subject_rel.name if self.subject_rel else None,
            "score": self.score,
            "full_score": self.full_score,
            "status": self.status,
            "remark": self.remark,
            "entered_by": self.entered_by,
            "entered_at": self.entered_at.isoformat() if self.entered_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ClassPeriod(db.Model):
    """课时表"""

    __tablename__ = "class_periods"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    period_number = db.Column(db.Integer, nullable=False)
    start_hour = db.Column(db.Integer, nullable=False)
    start_minute = db.Column(db.Integer, nullable=False)
    end_hour = db.Column(db.Integer, nullable=False)
    end_minute = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "period_number": self.period_number,
            "start_hour": self.start_hour,
            "start_minute": self.start_minute,
            "end_hour": self.end_hour,
            "end_minute": self.end_minute,
            "duration": (self.end_hour * 60 + self.end_minute)
            - (self.start_hour * 60 + self.start_minute),
            "description": self.description,
            "is_active": self.is_active,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class SubjectClass(db.Model):
    """科目-班级关联表"""

    __tablename__ = "subject_classes"

    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), nullable=False, index=True)
    class_info_id = db.Column(
        db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True
    )
    teacher_id = db.Column(db.Integer, db.ForeignKey("admin.id"), index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    subject = db.relationship("Subject", backref=db.backref("class_links", lazy=True))
    class_info = db.relationship("ClassInfo", backref=db.backref("subject_links", lazy=True))
    teacher = db.relationship("Admin", backref=db.backref("subject_teachings", lazy=True))

    __table_args__ = (db.UniqueConstraint("subject_id", "class_info_id", name="uq_subject_class"),)


class CourseSchedule(db.Model):
    """课程时间表"""

    __tablename__ = "course_schedules"

    id = db.Column(db.Integer, primary_key=True)
    class_info_id = db.Column(
        db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True
    )
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), nullable=False, index=True)
    day_of_week = db.Column(db.Integer, nullable=False)
    period_number = db.Column(db.Integer, nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("admin.id"))
    teacher_name = db.Column(db.String(100))
    classroom = db.Column(db.String(100))
    description = db.Column(db.String(500))
    color = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    class_info = db.relationship("ClassInfo", backref=db.backref("schedules", lazy=True))
    subject = db.relationship("Subject", backref=db.backref("schedules", lazy=True))


class CompositeScore(db.Model):
    """综合评分记录"""

    __tablename__ = "composite_scores"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    composite_score = db.Column(db.Float, default=0)
    academic_score = db.Column(db.Float, default=0)
    behavior_score = db.Column(db.Float, default=0)
    attendance_score = db.Column(db.Float, default=0)
    social_score = db.Column(db.Float, default=0)
    weights = db.Column(db.JSON)
    computed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class WarningConfig(db.Model):
    """预警配置"""

    __tablename__ = "warning_configs"

    id = db.Column(db.Integer, primary_key=True)
    risk_type = db.Column(db.String(50), index=True)
    threshold_low = db.Column(db.Float)
    threshold_medium = db.Column(db.Float)
    threshold_high = db.Column(db.Float)
    is_active = db.Column(db.Boolean, default=True)
    notification_enabled = db.Column(db.Boolean, default=True)
    config_key = db.Column(db.Text)
    config_value = db.Column(db.Text)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)
