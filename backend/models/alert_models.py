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

    def to_dict(self, fields=None):
        """基础字段序列化（B3 扩展 2026-08-23）。

        告警响应序列化使用 ALERT_FIELDS 子集（10 字段，见 alerts_routes）；
        source/is_resolved 等扩展字段由其他端点（如学生预警）按需取全量。
        """
        data = {
            "id": self.id,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "message": self.message,
            "device_id": self.device_id,
            "device_name": self.device_name,
            "extra_data": self.extra_data,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "source": self.source,
            "is_resolved": self.is_resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "student_id": self.student_id,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "recommended_action": self.recommended_action,
            "status": self.status,
            "acknowledged_at": (
                self.acknowledged_at.isoformat() if self.acknowledged_at else None
            ),
        }
        if fields is None:
            return data
        return {k: data[k] for k in fields if k in data}


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
