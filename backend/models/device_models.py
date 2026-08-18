from datetime import datetime
from models import db


class MQTTLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String(200))
    message = db.Column(db.Text)
    direction = db.Column(db.String(10))
    timestamp = db.Column(db.DateTime, default=datetime.now, index=True)


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


class ProcessedMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.String(100), unique=True, nullable=False)
    record_id = db.Column(db.Integer)
    new_score = db.Column(db.Integer)
    client_id = db.Column(db.String(100))
    processed_at = db.Column(db.DateTime, default=datetime.now)


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
    battery_level = db.Column(
        db.Float
    )  # R7/F8: 心跳上报电量（此前模型缺列 → 设备上报即 AttributeError）
    temperature = db.Column(db.Float)  # R7/F8: 心跳上报温度
    last_error = db.Column(db.String(500))
    error_count = db.Column(db.Integer, default=0)
    alert_enabled = db.Column(db.Boolean, default=True)
    heartbeat_timeout = db.Column(db.Integer, default=30)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    # ---- WOL (Wake-on-LAN) 专属字段（F10: WOLDevice 并入 Device）----
    mac_address = db.Column(db.String(20))
    subnet_mask = db.Column(db.String(45))
    broadcast_ip = db.Column(db.String(45))
    wake_on_lan_enabled = db.Column(db.Boolean, default=True)
    last_wake_time = db.Column(db.DateTime)
    wake_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)  # WOL 设备启用开关
    wol_port = db.Column(db.Integer, default=9)
    wol_description = db.Column(db.String(500))

    class_info = db.relationship("ClassInfo", backref=db.backref("devices", lazy=True))
    admin = db.relationship("Admin", backref=db.backref("devices", lazy=True))

    @property
    def is_online(self) -> bool:
        """是否在线：以 last_heartbeat 时效性为准（避免 status 陈旧导致「无心跳却显示在线」）。

        等价于 services.heartbeat_service.is_device_online(self)。
        """
        from services.heartbeat_service import is_device_online

        return is_device_online(self)


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
    device_id = db.Column(
        db.String(100), db.ForeignKey("device.device_id"), nullable=False, index=True
    )
    group_id = db.Column(db.Integer, db.ForeignKey("device_groups.id"), nullable=False, index=True)
    added_at = db.Column(db.DateTime, default=datetime.now)
