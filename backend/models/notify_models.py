from datetime import datetime
from models import db


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    type = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending", index=True)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    sent_at = db.Column(db.DateTime)
    # F9-B: 合并 admin_notifications 后，区分接收方（'user'=用户通知 / 'admin'=管理员通知）
    recipient_type = db.Column(db.String(20), default="user", index=True)
    admin_id = db.Column(db.Integer, index=True)
    priority = db.Column(db.String(20), default="normal")
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    extra_data = db.Column(db.JSON)

    user = db.relationship("User", backref="notifications")
class Approval(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    type = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(100))
    description = db.Column(db.Text)
    score_change = db.Column(db.Float)
    status = db.Column(db.String(20), default="pending", index=True)
    approver_id = db.Column(db.Integer, index=True)
    approve_time = db.Column(db.DateTime)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    # P0-4 审批合并：由 leave_application 并入，承载请假明细
    leave_type = db.Column(db.String(20))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

    user = db.relationship("User", backref="approvals")
class NotifyAudit(db.Model):
    """上课时间拦截 / 强制发送审计表"""

    __tablename__ = "notify_audit"

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), index=True)  # remote_notify / wol / scheduled / template / celery / ota / unlock
    target_class_id = db.Column(db.Integer, index=True)
    admin_id = db.Column(db.Integer, index=True)
    payload = db.Column(db.Text)  # 下发内容（截断）
    reason_code = db.Column(db.String(50), index=True)  # GLOBAL_TIME_RULE / CLASS_IN_SESSION / NORMAL / FORCE
    reason_message = db.Column(db.String(200))
    force_send = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
class ScheduledNotify(db.Model):
    """定时通知"""

    __tablename__ = "scheduled_notifies"

    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    volume = db.Column(db.Float, default=0.7)
    speak = db.Column(db.Boolean, default=True)
    popup = db.Column(db.Boolean, default=True)
    timeout_sec = db.Column(db.Integer, default=8)
    urgent = db.Column(db.Boolean, default=False)
    send_mode = db.Column(db.String(50), default="broadcast")
    device_id = db.Column(db.String(100))
    scheduled_at = db.Column(db.DateTime, index=True)
    repeat_type = db.Column(db.String(20), default="once")
    repeat_interval = db.Column(db.Integer, default=1)
    repeat_day_of_week = db.Column(db.Text)
    repeat_end_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default="pending", index=True)
    last_sent_at = db.Column(db.DateTime)
    next_send_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now)
    template_id = db.Column(db.Integer, db.ForeignKey("notify_templates.id"), index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)
    created_by = db.Column(db.Integer)  # 定时通知创建人（审计链）；修复历史遗漏：路由早已引用，模型/库表此前缺失

class NotifyTemplate(db.Model):
    """通知模板"""

    __tablename__ = "notify_templates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    template = db.Column(db.Text)
    text = db.Column(db.Text)
    description = db.Column(db.String(500))
    volume = db.Column(db.Float, default=0.7)
    speak = db.Column(db.Boolean, default=True)
    popup = db.Column(db.Boolean, default=True)
    timeout_sec = db.Column(db.Integer, default=8)
    urgent = db.Column(db.Boolean, default=False)
    bg_color = db.Column(db.String(20), default="#000000")
    text_color = db.Column(db.String(20), default="#FF0000")
    font_size = db.Column(db.Integer, default=48)
    language = db.Column(db.String(20), default="zh")
    category = db.Column(db.String(50))
    tags = db.Column(db.Text)  # JSON array stored as text
    usage_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)
class NotifyHistory(db.Model):
    """通知发送历史"""

    __tablename__ = "notify_histories"

    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    volume = db.Column(db.Float, default=0.7)
    speak = db.Column(db.Boolean, default=True)
    popup = db.Column(db.Boolean, default=True)
    timeout_sec = db.Column(db.Integer, default=8)
    urgent = db.Column(db.Boolean, default=False)
    send_mode = db.Column(db.String(50))
    device_id = db.Column(db.String(100), db.ForeignKey("device.device_id"))
    topic = db.Column(db.String(500))
    template_id = db.Column(db.Integer, index=True)
    notification_id = db.Column(db.Integer, db.ForeignKey("notification.id"), index=True)
    status = db.Column(db.String(20), default="sent")
    sent_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
