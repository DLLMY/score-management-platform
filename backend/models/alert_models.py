from datetime import datetime
from models import db


class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    alert_type = db.Column(db.String(50), nullable=False, index=True)
    severity = db.Column(db.String(20), default="info", index=True)
    message = db.Column(db.Text, nullable=False)
    device_id = db.Column(db.String(100), index=True)
    device_name = db.Column(db.String(100))
    extra_data = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False, index=True)
    read_at = db.Column(db.DateTime)
    # F9-A: 合并 device_alert 后，区分告警来源（'device'=设备告警 / 'system'=系统告警）
    # P0-6: 新增 'mental'=心理预警 / 'risk'=风险预警；student_id 承载学生来源
    source = db.Column(db.String(20), default="device", index=True)
    is_resolved = db.Column(db.Boolean, default=False, index=True)
    resolved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    # P0-6: 合并 mental_health_alert / risk_warnings 后承载学生预警的附加列（均为 nullable）
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True, index=True)
    risk_level = db.Column(db.String(20), nullable=True, index=True)
    risk_score = db.Column(db.Float, nullable=True)
    recommended_action = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)


class StudentCluster(db.Model):
    """学生聚类分组"""

    __tablename__ = "student_clusters"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    cluster_label = db.Column(db.String(50), nullable=False, index=True)
    cluster_score = db.Column(db.Float)
    features = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)
