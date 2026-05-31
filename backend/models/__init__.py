from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    gender = db.Column(db.String(10))
    class_name = db.Column(db.String(50), index=True)
    phone = db.Column(db.String(20), index=True)
    parent_info = db.Column(db.String(500))
    father_name = db.Column(db.String(100))
    father_phone = db.Column(db.String(20))
    mother_name = db.Column(db.String(100))
    mother_phone = db.Column(db.String(20))
    guardian_name = db.Column(db.String(100))
    guardian_phone = db.Column(db.String(20))
    guardian_relation = db.Column(db.String(50))
    card_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    current_score = db.Column(db.Integer, default=0, index=True)
    is_blacklisted = db.Column(db.Boolean, default=False, index=True)
    blacklist_reason = db.Column(db.String(500))
    blacklist_until = db.Column(db.DateTime)
    daily_unlock_limit = db.Column(db.Integer, default=5)
    today_unlock_count = db.Column(db.Integer, default=0)
    last_unlock_date = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class ScoreCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.String(200))
    color = db.Column(db.String(20), default='#3B82F6')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

class ScoreRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    description = db.Column(db.String(500))
    category_id = db.Column(db.Integer, db.ForeignKey('score_category.id'), index=True)
    score = db.Column(db.Float, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    daily_limit = db.Column(db.Integer, default=0)
    min_interval = db.Column(db.Integer, default=0)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    category = db.relationship('ScoreCategory', backref='rules')

class ScoreRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('score_rule.id'), index=True)
    score_change = db.Column(db.Integer, nullable=False, index=True)
    description = db.Column(db.String(500))
    operator = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    user = db.relationship('User', backref='records')
    rule = db.relationship('ScoreRule', backref='records')

class ScoreRankRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    min_score = db.Column(db.Integer, nullable=False)
    max_score = db.Column(db.Integer)
    color = db.Column(db.String(20), default='#0ea5e9')
    icon = db.Column(db.String(50), default='Award')
    description = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    permissions = db.Column(db.Text)

class MQTTLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String(200))
    message = db.Column(db.Text)
    direction = db.Column(db.String(10))
    timestamp = db.Column(db.DateTime, default=datetime.now)

class OperationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operation_type = db.Column(db.String(50), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    operator = db.Column(db.String(100), default='system')
    description = db.Column(db.Text)
    before_data = db.Column(db.Text)
    after_data = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now)

class MQTTConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    broker = db.Column(db.String(200), default='nc5233fc.ala.cn-hangzhou.emqxsl.cn')
    port = db.Column(db.Integer, default=8883)
    client_id = db.Column(db.String(100), default='score_backend')
    username = db.Column(db.String(100), default='phoneboxtest')
    password = db.Column(db.String(100), default='123456')
    ssl = db.Column(db.Boolean, default=True)
    timeout = db.Column(db.Integer, default=10)
    keepalive = db.Column(db.Integer, default=60)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class SystemConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    system_name = db.Column(db.String(100), default='积分管理平台')
    system_logo = db.Column(db.String(500), default='')
    default_score = db.Column(db.Integer, default=60)
    min_score = db.Column(db.Integer, default=0)
    max_score = db.Column(db.Integer, default=100)
    enable_notifications = db.Column(db.Boolean, default=True)
    notification_sound = db.Column(db.Boolean, default=True)
    auto_save = db.Column(db.Boolean, default=True)
    theme = db.Column(db.String(20), default='light')
    language = db.Column(db.String(20), default='zh-CN')
    updated_at = db.Column(db.DateTime, default=datetime.now)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    type = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending', index=True)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    sent_at = db.Column(db.DateTime)

    user = db.relationship('User', backref='notifications')

class Approval(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    type = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(100))
    description = db.Column(db.Text)
    score_change = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending', index=True)
    approver_id = db.Column(db.Integer, index=True)
    approve_time = db.Column(db.DateTime)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    user = db.relationship('User', backref='approvals')

class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='admin')
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    class_name = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class ProcessedMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.String(100), unique=True, nullable=False)
    record_id = db.Column(db.Integer)
    new_score = db.Column(db.Integer)
    client_id = db.Column(db.String(100))
    processed_at = db.Column(db.DateTime, default=datetime.now)

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

class Device(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100))
    status = db.Column(db.String(20), default='offline', index=True)
    last_heartbeat = db.Column(db.DateTime, index=True)
    wifi_signal = db.Column(db.Integer)
    uptime = db.Column(db.Integer)
    box_a_status = db.Column(db.String(20), default='closed')
    box_b_status = db.Column(db.String(20), default='closed')
    system_state = db.Column(db.Integer, default=0)
    class_info_id = db.Column(db.Integer, db.ForeignKey('class_info.id'), index=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('admin.id'), index=True)
    ip_address = db.Column(db.String(45))
    fw_version = db.Column(db.String(20))
    platform = db.Column(db.String(50))
    free_heap = db.Column(db.Integer)
    last_error = db.Column(db.String(500))
    error_count = db.Column(db.Integer, default=0)
    alert_enabled = db.Column(db.Boolean, default=True)
    heartbeat_timeout = db.Column(db.Integer, default=30)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    class_info = db.relationship('ClassInfo', backref=db.backref('devices', lazy=True))
    admin = db.relationship('Admin', backref=db.backref('devices', lazy=True))


class DeviceAlert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), nullable=False, index=True)
    alert_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='warning')
    message = db.Column(db.String(500))
    is_resolved = db.Column(db.Boolean, default=False, index=True)
    resolved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class DeviceHeartbeat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20))
    wifi_signal = db.Column(db.Integer)
    uptime = db.Column(db.Integer)
    box_a_status = db.Column(db.String(20))
    box_b_status = db.Column(db.String(20))
    system_state = db.Column(db.Integer)
    received_at = db.Column(db.DateTime, default=datetime.now)

class ClassInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    grade = db.Column(db.String(50))
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class SubAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    parent_admin_id = db.Column(db.Integer, db.ForeignKey('admin.id'), nullable=False, index=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    role_type = db.Column(db.String(30), default='dashboard_viewer', index=True)
    permissions = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    parent_admin = db.relationship('Admin', backref=db.backref('sub_accounts', lazy=True))

class RolePermission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    role_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    permissions = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class AdminClass(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('admin.id'), nullable=False, index=True)
    class_info_id = db.Column(db.Integer, db.ForeignKey('class_info.id'), nullable=False, index=True)
    is_primary = db.Column(db.Boolean, default=False)
    assigned_at = db.Column(db.DateTime, default=datetime.now)

    admin = db.relationship('Admin', backref=db.backref('class_links', lazy=True))
    class_info = db.relationship('ClassInfo', backref=db.backref('admin_links', lazy=True))

class PermissionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operator_id = db.Column(db.Integer)
    operator_type = db.Column(db.String(30))
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    description = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    alert_type = db.Column(db.String(50), nullable=False, index=True)
    severity = db.Column(db.String(20), default='info', index=True)
    message = db.Column(db.Text, nullable=False)
    device_id = db.Column(db.String(100), index=True)
    device_name = db.Column(db.String(100))
    extra_data = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False, index=True)
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class FirmwareVersion(db.Model):
    __tablename__ = 'firmware_versions'

    id = db.Column(db.Integer, primary_key=True)
    version = db.Column(db.String(50), unique=True, nullable=False, index=True)
    description = db.Column(db.Text)
    file_path = db.Column(db.String(500))
    file_size = db.Column(db.Integer)
    md5 = db.Column(db.String(64))
    min_compatible_version = db.Column(db.String(50))
    is_mandatory = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    created_by = db.Column(db.Integer)


class DeviceFirmwareUpdate(db.Model):
    __tablename__ = 'device_firmware_updates'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), index=True)
    device_name = db.Column(db.String(100))
    from_version = db.Column(db.String(50))
    to_version = db.Column(db.String(50))
    status = db.Column(db.String(20), default='pending')
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)