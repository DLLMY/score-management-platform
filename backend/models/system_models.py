from datetime import datetime
from models import db


class OperationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operation_type = db.Column(db.String(50), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    operator = db.Column(db.String(100), default="system")
    description = db.Column(db.Text)
    before_data = db.Column(db.Text)
    after_data = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    user_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now)


class SystemConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    system_name = db.Column(db.String(100), default="积分管理平台")
    system_logo = db.Column(db.String(500), default="")
    default_score = db.Column(db.Integer, default=60)
    min_score = db.Column(db.Integer, default=0)
    max_score = db.Column(db.Integer, default=100)
    enable_notifications = db.Column(db.Boolean, default=True)
    notification_sound = db.Column(db.Boolean, default=True)
    auto_save = db.Column(db.Boolean, default=True)
    theme = db.Column(db.String(20), default="light")
    language = db.Column(db.String(20), default="zh-CN")
    updated_at = db.Column(db.DateTime, default=datetime.now)


class TimeRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    day_of_week = db.Column(db.Integer, default=-1)
    start_hour = db.Column(db.Integer, nullable=False)
    start_minute = db.Column(db.Integer, nullable=False)
    end_hour = db.Column(db.Integer, nullable=False)
    end_minute = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    allow_unlock = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class ClassInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    grade = db.Column(db.String(50))
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True, index=True)
    head_teacher_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class AdminClass(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=False, index=True)
    class_info_id = db.Column(
        db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True
    )
    is_primary = db.Column(db.Boolean, default=False)
    assigned_at = db.Column(db.DateTime, default=datetime.now)

    admin = db.relationship("Admin", backref=db.backref("class_links", lazy=True))
    class_info = db.relationship("ClassInfo", backref=db.backref("admin_links", lazy=True))


class ImportConfig(db.Model):
    """导入配置表"""

    __tablename__ = "import_configs"

    id = db.Column(db.Integer, primary_key=True)
    module_name = db.Column(db.String(100), nullable=False, index=True)
    import_type = db.Column(db.String(50), index=True)
    config_name = db.Column(db.String(100), nullable=False)
    field_mappings = db.Column(db.JSON)
    validation_rules = db.Column(db.JSON)
    conflict_strategy = db.Column(db.String(20))
    default_values = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)
    is_default = db.Column(db.Boolean, default=False)
    description = db.Column(db.String(500))
    created_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "module_name": self.module_name,
            "config_name": self.config_name,
            "field_mappings": self.field_mappings,
            "validation_rules": self.validation_rules,
            "conflict_strategy": self.conflict_strategy,
            "default_values": self.default_values,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "description": self.description,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class FrontendPerfMetric(db.Model):
    """前端性能/错误上报落库（运维中心可查）"""

    __tablename__ = "frontend_perf_metrics"

    id = db.Column(db.Integer, primary_key=True)
    metric_type = db.Column(
        db.String(30), default="web_vital", index=True
    )  # web_vital / api / custom
    name = db.Column(db.String(200), nullable=False, index=True)
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20))
    page = db.Column(db.String(200), index=True)
    user_agent = db.Column(db.String(500))
    screen_width = db.Column(db.Integer)
    screen_height = db.Column(db.Integer)
    detail = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class FrontendErrorLog(db.Model):
    """前端错误上报落库（运维中心可查）"""

    __tablename__ = "frontend_error_logs"

    id = db.Column(db.Integer, primary_key=True)
    error_type = db.Column(
        db.String(30), default="js_error", index=True
    )  # js_error / api_error / resource_error
    message = db.Column(db.Text, nullable=False)
    stack = db.Column(db.Text)
    file = db.Column(db.String(500))
    line = db.Column(db.Integer)
    column = db.Column(db.Integer)
    page = db.Column(db.String(200), index=True)
    url = db.Column(db.String(500))
    method = db.Column(db.String(10))
    status = db.Column(db.Integer)
    user_agent = db.Column(db.String(500))
    detail = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class SystemMetric(db.Model):
    """系统指标历史采样（运维中心趋势查看）"""

    __tablename__ = "system_metrics"

    id = db.Column(db.Integer, primary_key=True)
    metric_name = db.Column(
        db.String(50), nullable=False, index=True
    )  # cpu_percent / memory_percent / disk_percent / net_sent / net_recv
    metric_value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20))
    category = db.Column(db.String(30), default="system", index=True)
    tags = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class RateLimitRecord(db.Model):
    """限流记录"""

    __tablename__ = "rate_limit_records"

    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(45), nullable=False, index=True)
    endpoint = db.Column(db.String(200), index=True)
    request_count = db.Column(db.Integer, default=0)
    window_start = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
