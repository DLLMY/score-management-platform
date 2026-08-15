from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt
from sqlalchemy import delete as _sa_delete
from sqlalchemy import select as _sa_select
from sqlalchemy import update as _sa_update

db = SQLAlchemy()


# 反射结果缓存：父表名 -> [(子表, 子列)]，metadata 在运行期固定，可安全缓存
_CHILD_FK_CACHE = {}


def _child_foreign_keys(parent_table):
    """列出所有引用 parent_table 的 (子表, 子外键列)。"""
    cached = _CHILD_FK_CACHE.get(parent_table.name)
    if cached is not None:
        return cached
    result = []
    for table in db.metadata.sorted_tables:
        for fk in table.foreign_key_constraints:
            referred = fk.referred_table
            if referred is not None and referred.name == parent_table.name:
                for element in fk.elements:
                    result.append((table, element.parent))
    _CHILD_FK_CACHE[parent_table.name] = result
    return result


def cascade_delete_related_records(
    target, pk_value, nullable_action="set_null", _visited=None, _depth=0, _max_depth=8
):
    """递归清理所有引用某条父记录的子表数据，使父记录可以被安全删除。

    本项目 SQLite 启用了外键约束（config.py 的 "foreign_keys": 1 +
    utils/initializer.py 的 PRAGMA foreign_keys=ON），并且存在大量 NOT NULL 外键
    （如 scores.student_id / scores.exam_id / seating_seat.chart_id /
    duty_assignment.group_id）。直接 db.session.delete(obj) 会出现两类失败：
    ORM 先把子表外键置空触发 NOT NULL 报错，或数据库外键约束直接拦截删除。

    处理策略（按子外键是否可空区分，避免误删业务数据）：
      * NOT NULL 外键 -> 子记录必须删除；删除前先递归清理它自己的子表（多级级联，
        例如 class_info -> seating_chart -> seating_seat）。
      * 可空外键     -> 仅将该外键置为 NULL，保留业务数据。例如删除管理员时，
        scores.entered_by 会被解除引用，而不会连带删掉上万条成绩。

    参数 nullable_action 可设为 "delete"，让可空外键的子记录也一并删除，
    适用于「删除学生」这类需要彻底清理个人数据的场景。
    """
    table = getattr(target, "__table__", target)
    if _visited is None:
        _visited = set()
    key = (table.name, pk_value)
    if key in _visited or _depth > _max_depth:
        return
    _visited.add(key)

    for child_table, child_col in _child_foreign_keys(table):
        # 自引用表由 _visited 阻断循环
        if child_col.nullable and nullable_action == "set_null":
            db.session.execute(
                _sa_update(child_table)
                .where(child_col == pk_value)
                .values({child_col.name: None})
            )
            continue

        # 需要删除子记录：若子表自身还有孙表，先逐行递归清理
        if _child_foreign_keys(child_table):
            child_pk_cols = list(child_table.primary_key.columns)
            if child_pk_cols:
                child_pk = child_pk_cols[0]
                child_ids = (
                    db.session.execute(
                        _sa_select(child_pk).where(child_col == pk_value)
                    )
                    .scalars()
                    .all()
                )
                for child_id in child_ids:
                    cascade_delete_related_records(
                        child_table,
                        child_id,
                        nullable_action=nullable_action,
                        _visited=_visited,
                        _depth=_depth + 1,
                        _max_depth=_max_depth,
                    )
        db.session.execute(_sa_delete(child_table).where(child_col == pk_value))


def cascade_delete_user_related_records(user_id):
    """删除用户前清理其全部关联记录（个人数据彻底清理，含可空外键子表）。"""
    cascade_delete_related_records(User, user_id, nullable_action="delete")


def is_bcrypt_hash(password: str) -> bool:
    """检查密码是否已经是bcrypt哈希"""
    return password is not None and len(password) >= 60 and password.startswith("$2b$")


def hash_password(password: str) -> str:
    """将明文密码转换为bcrypt哈希"""
    if is_bcrypt_hash(password):
        return password
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    gender = db.Column(db.String(10))
    class_name = db.Column(db.String(50), index=True)
    class_info_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), index=True)
    class_info = db.relationship("ClassInfo", backref=db.backref("users", lazy=True))
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
    role = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)


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
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    rule_id = db.Column(db.Integer, db.ForeignKey("score_rule.id"), index=True)
    score_change = db.Column(db.Integer, nullable=False, index=True)
    description = db.Column(db.String(500))
    reason = db.Column(db.String(500))
    period_id = db.Column(db.Integer, index=True)
    student_id = db.Column(db.Integer, index=True)
    subject_id = db.Column(db.Integer, index=True)
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
    unlock_min_score = db.Column(db.Integer, nullable=True, comment="开门最低分数要求，NULL则使用全局默认值")
    weekly_unlock_limit = db.Column(db.Integer, nullable=True, comment="每周开门次数限制，NULL则使用全局默认值")
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
    timestamp = db.Column(db.DateTime, default=datetime.now, index=True)


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


class MQTTConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    broker = db.Column(db.String(200), default="nc5233fc.ala.cn-hangzhou.emqxsl.cn")
    port = db.Column(db.Integer, default=8883)
    client_id = db.Column(db.String(100), default="score_backend")
    username = db.Column(db.String(100), default="phoneboxtest")
    password = db.Column(db.String(100), default="123456")
    ssl = db.Column(db.Boolean, default=True)
    timeout = db.Column(db.Integer, default=10)
    keepalive = db.Column(db.Integer, default=60)
    updated_at = db.Column(db.DateTime, default=datetime.now)


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


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    type = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending", index=True)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    sent_at = db.Column(db.DateTime)

    user = db.relationship("User", backref="notifications")


class Approval(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    type = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(100))
    description = db.Column(db.Text)
    score_change = db.Column(db.Integer)
    status = db.Column(db.String(20), default="pending", index=True)
    approver_id = db.Column(db.Integer, index=True)
    approve_time = db.Column(db.DateTime)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    user = db.relationship("User", backref="approvals")


class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    _password = db.Column("password", db.String(200), nullable=False)
    role = db.Column(db.String(20), default="admin")
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    class_name = db.Column(db.String(50))
    primary_class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"))
    is_active = db.Column(db.Boolean, default=True)
    force_password_change = db.Column(db.Boolean, default=False)
    last_login_at = db.Column(db.DateTime)
    login_count = db.Column(db.Integer, default=0)
    last_login_ip = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, value):
        """设置密码时自动进行哈希处理"""
        if value and not is_bcrypt_hash(value):
            self._password = bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        else:
            self._password = value


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


class PhoneBoxPolicy(db.Model):
    """班主任自助开箱策略：按班级（class_info_id 唯一）配置手机箱自助开箱。

    班主任仅能管理自己班级（由 Admin.primary_class_id 约束，后端强制隔离）。
    字段：
      - allow_self_unlock: 总开关，是否允许本班学生自助开箱（False 时任何时段都拒）。
      - unlock_windows:   预设允许时段列表，形如
                          [{"day":-1,"start_hour":10,"start_minute":0,
                            "end_hour":10,"end_minute":20}, ...]
                          day=-1 表示每天，0-6 表示周一~周日。
      - override_until:   一键临时放行截止时间；> now 时优先级最高，直接放行。
    判定优先级（见 services/phonebox_policy.py）：一键放行 > 预设时段 > 交给现有全局+课表逻辑。
    """

    id = db.Column(db.Integer, primary_key=True)
    class_info_id = db.Column(
        db.Integer, db.ForeignKey("class_info.id"), unique=True, nullable=False, index=True
    )
    allow_self_unlock = db.Column(db.Boolean, default=True)
    unlock_windows = db.Column(db.JSON, default=list)
    override_until = db.Column(db.DateTime, nullable=True)
    updated_by = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    class_info = db.relationship(
        "ClassInfo", backref=db.backref("phone_box_policy", uselist=False, lazy=True)
    )


class Device(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100))
    status = db.Column(db.String(20), default="offline", index=True)
    last_heartbeat = db.Column(db.DateTime, index=True)
    wifi_signal = db.Column(db.Integer)
    uptime = db.Column(db.Integer)
    box_a_status = db.Column(db.String(20), default="closed")
    box_b_status = db.Column(db.String(20), default="closed")
    system_state = db.Column(db.Integer, default=0)
    class_info_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), index=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("admin.id"), index=True)
    ip_address = db.Column(db.String(45))
    fw_version = db.Column(db.String(20))
    platform = db.Column(db.String(50))
    device_type = db.Column(db.String(50))
    auto_update = db.Column(db.Boolean, default=True)  # 是否允许后端自动推送 OTA
    ota_status = db.Column(db.String(20), default="idle")  # idle/pending/upgrading/failed
    last_ota_push_at = db.Column(db.DateTime)  # 最近一次自动推送指令下发时间
    free_heap = db.Column(db.Integer)
    last_error = db.Column(db.String(500))
    error_count = db.Column(db.Integer, default=0)
    alert_enabled = db.Column(db.Boolean, default=True)
    heartbeat_timeout = db.Column(db.Integer, default=30)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    class_info = db.relationship("ClassInfo", backref=db.backref("devices", lazy=True))
    admin = db.relationship("Admin", backref=db.backref("devices", lazy=True))


class DeviceAlert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), nullable=False, index=True)
    alert_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default="warning")
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
    head_teacher_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class SubAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    parent_admin_id = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=False, index=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    _password = db.Column("password", db.String(200), nullable=False)
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    role_type = db.Column(db.String(30), default="dashboard_viewer", index=True)
    permissions = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    parent_admin = db.relationship("Admin", backref=db.backref("sub_accounts", lazy=True))

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, value):
        """设置密码时自动进行哈希处理"""
        if value and not is_bcrypt_hash(value):
            self._password = bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        else:
            self._password = value


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
    admin_id = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=False, index=True)
    class_info_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    is_primary = db.Column(db.Boolean, default=False)
    assigned_at = db.Column(db.DateTime, default=datetime.now)

    admin = db.relationship("Admin", backref=db.backref("class_links", lazy=True))
    class_info = db.relationship("ClassInfo", backref=db.backref("admin_links", lazy=True))


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
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class FirmwareVersion(db.Model):
    __tablename__ = "firmware_versions"

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
    __tablename__ = "device_firmware_updates"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), index=True)
    device_name = db.Column(db.String(100))
    from_version = db.Column(db.String(50))
    to_version = db.Column(db.String(50))
    status = db.Column(db.String(20), default="pending")
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)


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
    subject = db.Column(db.String(50), nullable=False, index=True)
    score = db.Column(db.Float)
    full_score = db.Column(db.Float, default=100)
    rank = db.Column(db.Integer)
    status = db.Column(db.String(20), default="pending", index=True)
    remark = db.Column(db.String(200))
    entered_by = db.Column(db.Integer, db.ForeignKey("admin.id"), index=True)
    entered_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    exam = db.relationship("Exam", backref=db.backref("scores", lazy=True))
    student = db.relationship("User", backref=db.backref("scores", lazy=True))
    admin = db.relationship("Admin", backref=db.backref("scores", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "subject": self.subject,
            "score": self.score,
            "full_score": self.full_score,
            "rank": self.rank,
            "status": self.status,
            "remark": self.remark,
            "entered_by": self.entered_by,
            "entered_at": self.entered_at.isoformat() if self.entered_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def get_by_id(model_class, obj_id):
    """通用的按ID查询方法"""
    if obj_id is None:
        return None
    return model_class.query.get(obj_id)


class AdminRole(db.Model):
    """管理员角色关联表"""

    __tablename__ = "admin_roles"

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=False, index=True)
    role_code = db.Column(db.String(50), index=True)
    assigned_at = db.Column(db.DateTime, default=datetime.now)

    admin = db.relationship("Admin", backref=db.backref("role_links", lazy=True))


class Permission(db.Model):
    """权限定义表"""

    __tablename__ = "permissions"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), index=True)
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)


class RolePermissionMapping(db.Model):
    """角色-权限映射表"""

    __tablename__ = "role_permission_mappings"

    id = db.Column(db.Integer, primary_key=True)
    role_code = db.Column(db.String(50), index=True)
    permission_code = db.Column(db.String(100), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


class RoleHierarchy(db.Model):
    """角色继承层级表"""

    __tablename__ = "role_hierarchies"

    id = db.Column(db.Integer, primary_key=True)
    parent_role_code = db.Column(db.String(50), index=True)
    child_role_code = db.Column(db.String(50), index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


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
            "duration": (self.end_hour * 60 + self.end_minute) - (self.start_hour * 60 + self.start_minute),
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
    class_info_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
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
    class_info_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
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


class WOLDevice(db.Model):
    """WOL设备表"""

    __tablename__ = "wol_devices"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), index=True)
    mac_address = db.Column(db.String(20))
    ip_address = db.Column(db.String(45))
    subnet_mask = db.Column(db.String(45))
    broadcast_ip = db.Column(db.String(45))
    wake_on_lan_enabled = db.Column(db.Boolean, default=True)
    last_wake_time = db.Column(db.DateTime)
    wake_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class DeviceGroup(db.Model):
    """设备分组表"""

    __tablename__ = "device_groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    location = db.Column(db.String(100))
    icon = db.Column(db.String(50), default="Layers")
    color = db.Column(db.String(20), default="#3B82F6")
    sort_order = db.Column(db.Integer, default=0)
    admin_id = db.Column(db.Integer)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "location": self.location,
            "icon": self.icon,
            "color": self.color,
            "sort_order": self.sort_order,
            "admin_id": self.admin_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DeviceGroupMapping(db.Model):
    """设备-分组映射表"""

    __tablename__ = "device_group_mappings"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey("wol_devices.id"), nullable=False, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("device_groups.id"), nullable=False, index=True)
    added_at = db.Column(db.DateTime, default=datetime.now)


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
    updated_at = db.Column(db.DateTime, default=datetime.now)


class NLPScoringRule(db.Model):
    """NLP评分规则"""

    __tablename__ = "nlp_scoring_rules"

    id = db.Column(db.Integer, primary_key=True)
    behavior_keyword = db.Column(db.String(200), index=True)
    behavior_description = db.Column(db.String(500))
    score_value = db.Column(db.Float)
    score_type = db.Column(db.String(20))
    _behavior_tags = db.Column("behavior_tags", db.JSON)
    match_pattern = db.Column(db.String(500))
    priority = db.Column(db.Integer)
    usage_count = db.Column(db.Integer)
    accuracy_rate = db.Column(db.Float)
    is_active = db.Column(db.Boolean)
    created_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)
    last_used_at = db.Column(db.String(50))
    rule_name = db.Column(db.String(200))
    rule_type = db.Column(db.String(50))
    condition = db.Column(db.Text)
    score_change = db.Column(db.Integer)

    @property
    def behavior_tags(self):
        import json

        if not self._behavior_tags:
            return []
        if isinstance(self._behavior_tags, list):
            return self._behavior_tags
        try:
            return json.loads(self._behavior_tags)
        except (json.JSONDecodeError, TypeError):
            return [str(self._behavior_tags)]

    @behavior_tags.setter
    def behavior_tags(self, value):
        import json

        if isinstance(value, list):
            self._behavior_tags = json.dumps(value, ensure_ascii=False)
        else:
            self._behavior_tags = value


class NLPBehaviorKeyword(db.Model):
    """NLP行为关键词"""

    __tablename__ = "nlp_behavior_keywords"

    id = db.Column(db.Integer, primary_key=True)
    keyword = db.Column(db.String(50))
    keyword_type = db.Column(db.String(20))
    score_weight = db.Column(db.Float)
    description = db.Column(db.String(200))
    is_active = db.Column(db.Boolean)
    created_at = db.Column(db.DateTime)
    score_type = db.Column(db.Text)
    default_score = db.Column(db.Integer)
    _synonyms = db.Column("synonyms", db.Text)
    behavior_type = db.Column(db.Text)
    category = db.Column(db.Text)
    weight = db.Column(db.Integer)

    @property
    def synonyms(self):
        import json

        if not self._synonyms:
            return []
        try:
            return json.loads(self._synonyms)
        except (json.JSONDecodeError, TypeError):
            return [s.strip() for s in str(self._synonyms).split(",") if s.strip()]

    @synonyms.setter
    def synonyms(self, value):
        import json

        if value is None:
            self._synonyms = None
        elif isinstance(value, (list, tuple)):
            self._synonyms = json.dumps(list(value), ensure_ascii=False)
        else:
            self._synonyms = str(value)


class NLPMatchResult(db.Model):
    """NLP匹配结果"""

    __tablename__ = "nlp_match_results"

    id = db.Column(db.Integer, primary_key=True)
    input_text = db.Column(db.String(500), nullable=False)
    matched_rule_id = db.Column(db.Integer, index=True)
    matched_keyword = db.Column(db.String(100))
    intent = db.Column(db.String(20))
    confidence = db.Column(db.Float)
    user_id = db.Column(db.Integer, index=True)
    behavior_description = db.Column(db.String(500))
    score_change = db.Column(db.Float, default=0)
    is_manual_correction = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class NLPRuleUsage(db.Model):
    """NLP规则使用记录"""

    __tablename__ = "nlp_rule_usages"

    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, index=True)
    user_id = db.Column(db.Integer, index=True)
    input_text = db.Column(db.Text)
    matched_keyword = db.Column(db.String(200))
    score_change = db.Column(db.Integer)
    is_manual_correction = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class NLPModelTraining(db.Model):
    """NLP模型训练记录"""

    __tablename__ = "nlp_model_trainings"

    id = db.Column(db.Integer, primary_key=True)
    model_name = db.Column(db.String(200), nullable=False, index=True)
    status = db.Column(db.String(20), default="pending", index=True)
    algorithm_type = db.Column(db.String(50), index=True)
    training_data_size = db.Column(db.Integer, default=0)
    accuracy = db.Column(db.Float)
    f1_score = db.Column(db.Float)
    precision = db.Column(db.Float)
    recall = db.Column(db.Float)
    results = db.Column(db.JSON)
    trained_by = db.Column(db.Integer)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    trained_at = db.Column(db.DateTime, default=datetime.now)


class SecurityAudit(db.Model):
    """安全审计日志"""

    __tablename__ = "security_audits"

    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(50), nullable=False, index=True)
    severity = db.Column(db.String(20), default="info", index=True)
    user_id = db.Column(db.Integer, index=True)
    user_type = db.Column(db.String(30))
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    request_path = db.Column(db.String(500))
    request_method = db.Column(db.String(10))
    response_status = db.Column(db.Integer)
    event_details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class FrontendPerfMetric(db.Model):
    """前端性能/错误上报落库（运维中心可查）"""

    __tablename__ = "frontend_perf_metrics"

    id = db.Column(db.Integer, primary_key=True)
    metric_type = db.Column(db.String(30), default="web_vital", index=True)  # web_vital / api / custom
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
    error_type = db.Column(db.String(30), default="js_error", index=True)  # js_error / api_error / resource_error
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
    metric_name = db.Column(db.String(50), nullable=False, index=True)  # cpu_percent / memory_percent / disk_percent / net_sent / net_recv
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


class LoginAttempt(db.Model):
    """登录尝试记录"""

    __tablename__ = "login_attempts"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), index=True)
    ip_address = db.Column(db.String(45), index=True)
    attempt_count = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime)
    last_attempt_at = db.Column(db.DateTime)
    success = db.Column(db.Boolean, default=False)
    user_agent = db.Column(db.Text)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class AdminNotification(db.Model):
    """管理员通知"""

    __tablename__ = "admin_notifications"

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, index=True)
    title = db.Column(db.String(200))
    message = db.Column(db.Text)
    type = db.Column(db.String(50), index=True)
    priority = db.Column(db.String(20))
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    extra_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, index=True)


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
    device_id = db.Column(db.Integer)
    topic = db.Column(db.String(500))
    template_id = db.Column(db.Integer, index=True)
    status = db.Column(db.String(20), default="sent")
    sent_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class StudentCluster(db.Model):
    """学生聚类分组"""

    __tablename__ = "student_clusters"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    cluster_label = db.Column(db.String(50), nullable=False, index=True)
    cluster_score = db.Column(db.Float)
    features = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class CompositeScore(db.Model):
    """综合评分记录"""

    __tablename__ = "composite_scores"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    composite_score = db.Column(db.Float, default=0)
    academic_score = db.Column(db.Float, default=0)
    behavior_score = db.Column(db.Float, default=0)
    attendance_score = db.Column(db.Float, default=0)
    social_score = db.Column(db.Float, default=0)
    weights = db.Column(db.JSON)
    computed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class RiskWarning(db.Model):
    """风险预警"""

    __tablename__ = "risk_warnings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    risk_type = db.Column(db.String(50), nullable=False, index=True)
    risk_level = db.Column(db.String(20), index=True)
    risk_score = db.Column(db.Float, default=0)
    description = db.Column(db.Text)
    recommended_action = db.Column(db.Text)
    status = db.Column(db.String(20), default="active", index=True)
    acknowledged_at = db.Column(db.DateTime)
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class WarningConfig(db.Model):
    """预警配置"""

    __tablename__ = "warning_configs"

    id = db.Column(db.Integer, primary_key=True)
    risk_type = db.Column(db.String(50), index=True)
    threshold_low = db.Column(db.Float)
    threshold_medium = db.Column(db.Float)
    threshold_high = db.Column(db.Float)
    enabled = db.Column(db.Boolean, default=True)
    notification_enabled = db.Column(db.Boolean, default=True)
    config_key = db.Column(db.Text)
    config_value = db.Column(db.Text)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class OperationLogArchive(db.Model):
    """操作日志归档"""

    __tablename__ = "operation_log_archives"

    id = db.Column(db.Integer, primary_key=True)
    original_id = db.Column(db.Integer, index=True)
    admin_id = db.Column(db.Integer, index=True)
    action = db.Column(db.String(100))
    details = db.Column(db.JSON)
    archived_at = db.Column(db.DateTime, default=datetime.now, index=True)


class NLPCorrection(db.Model):
    """NLP纠错记录"""

    __tablename__ = "nlp_corrections"

    id = db.Column(db.Integer, primary_key=True)
    input_text = db.Column(db.String(500), nullable=False)
    original_result = db.Column(db.JSON)
    corrected_result = db.Column(db.JSON)
    corrected_by = db.Column(db.Integer)
    is_validated = db.Column(db.Boolean, default=False)
    validated_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    # 自学习纠错相关字段（与 api/nlp_routes.py、services/nlp_enhanced_service.py 对齐）
    original_text = db.Column(db.String(1000), nullable=True)   # 被纠正的原始输入文本
    field_type = db.Column(db.String(50), nullable=True)        # name / intent / score
    original_value = db.Column(db.String(500), nullable=True)    # 原预测值
    corrected_value = db.Column(db.String(500), nullable=True)   # 用户纠正后的值
    status = db.Column(db.String(50), default="pending")         # pending / approved / learned / rejected
    confidence_after = db.Column(db.Float, nullable=True)        # 纠正后置信度
    learn_count = db.Column(db.Integer, default=0)               # 被归纳学习引用的次数
    last_learned_at = db.Column(db.DateTime, nullable=True)      # 最近一次被归纳学习的时间
    verified_at = db.Column(db.DateTime, nullable=True)          # 审核/确认时间


# 班主任工作台 - 座次表
from models.seating import SeatingChart, SeatingSeat  # noqa: E402,F401

# 班主任工作台 - 值日生表
from models.duty import DutyGroup, DutyAssignment  # noqa: E402,F401

# 班主任工作台 - 班委名单
from models.committee import ClassCommittee, CommitteeTerm  # noqa: E402,F401

# 班主任工作台 - 家长联系
from models.parent import ParentContact, ContactLog  # noqa: E402,F401

# 班主任工作台 - 作业检查
from models.homework import HomeworkAssignment, HomeworkSubmission  # noqa: E402,F401

# 班主任工作台 - 考勤管理
from models.attendance import Attendance, LeaveApplication  # noqa: E402,F401

# 班主任工作台 - 学习小组
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupScore  # noqa: E402,F401

# 班主任工作台 - 心理健康
from models.mental_health import MentalHealthRecord, MentalHealthAlert  # noqa: E402,F401

# 班主任工作台 - 文体活动
from models.activity import Activity, ActivityRegistration  # noqa: E402,F401

# 班主任工作台 - 班级文化
from models.culture import CultureRecord, CultureItem  # noqa: E402,F401

# 班主任工作台 - 学法指导
from models.study_guide import StudyGuide, ImprovementPlan  # noqa: E402,F401
