import logging

import time
import json
import threading
import io
import openpyxl
from flask_restx import Namespace, Resource, fields
from models import Device, DeviceHeartbeat, ClassInfo, Admin, get_by_id
from sqlalchemy.orm import joinedload
from utils.permission import requires_permission, get_current_admin, get_admin_class_ids
from utils.response import APIResponse
from utils.decorators import safe_handle
from utils.pagination import get_pagination
from services.mqtt_service import publish_mqtt
from services.heartbeat_service import is_device_online
from services.device_service import (
    create_device,
    update_device,
    delete_device,
    bind_device_class,
    bind_device_admin,
    resolve_device_alert,
    update_device_settings,
    import_devices,
    revoke_device_secret,
)
from services.device_query_service import (
    get_device_list_view,
    get_device_alerts_view,
    get_device_stats_view,
    get_device_advanced_stats_view,
)

logger = logging.getLogger(__name__)
from utils.api_cache_middleware import cached_api, invalidate_cache
from datetime import datetime, timedelta

# 差异 #13：在线设备列表 SQL 粗筛需要 db.session 与聚合函数 func
from models import db
from sqlalchemy import func

from models import Alert

from flask import request

from flask import send_file
from flask import Response

ns_devices = Namespace("devices", description="设备管理相关操作")

def send_ota_upgrade_command(firmware_url, version="", force=False, device_id=None):
    """
    发送OTA升级指令的公共函数

    Args:
        firmware_url: 固件下载URL
        version: 目标固件版本
        force: 是否强制升级
        device_id: 指定设备ID（None表示广播到所有在线设备）

    Returns:
        APIResponse对象
    """
    if not firmware_url:
        return APIResponse.bad_request(message="需要提供固件下载URL")

    if device_id:
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return APIResponse.bad_request(message="设备不存在")

        ota_payload = {
            "action": "update",
            "url": firmware_url,
            "version": version,
            "force": force,
            "timestamp": int(datetime.now().timestamp()),
        }

        ota_topic = f"phonebox/ota/{device_id}"
        result = publish_mqtt(ota_topic, json.dumps(ota_payload))

        if result:
            return APIResponse.success(
                data={
                    "success": True,
                    "message": "OTA升级指令已发送，设备将自动下载并升级",
                    "device_id": device_id,
                    "firmware_url": firmware_url,
                    "version": version,
                    "force": force,
                }
            )
        return APIResponse.server_error(message="MQTT发送失败，请检查连接")
    # P3: 索引 filter 替代 all()+内存过滤（last_heartbeat 带 ix_device_last_heartbeat）
    online_devices = Device.query.filter(
        Device.last_heartbeat >= datetime.now() - timedelta(seconds=60)
    ).all()

    if not online_devices:
        return APIResponse.bad_request(message="没有在线设备")

    ota_payload = {
        "action": "update",
        "url": firmware_url,
        "version": version,
        "force": force,
        "timestamp": int(datetime.now().timestamp()),
    }

    ota_topic = "phonebox/ota"
    result = publish_mqtt(ota_topic, json.dumps(ota_payload))

    if result:
        return APIResponse.success(
            data={
                "success": True,
                "message": f"OTA升级指令已发送到 {len(online_devices)} 个在线设备",
                "online_count": len(online_devices),
                "firmware_url": firmware_url,
                "version": version,
                "force": force,
            }
        )
    return APIResponse.server_error(message="MQTT发送失败，请检查连接")

device_model = ns_devices.model(
    "Device",
    {
        "id": fields.Integer(readOnly=True, description="设备ID"),
        "device_id": fields.String(required=True, description="设备标识"),
        "name": fields.String(description="设备名称"),
        "status": fields.String(readOnly=True, description="状态（online/offline/error）"),
        "wifi_signal": fields.Integer(description="WiFi信号强度"),
        "uptime": fields.Integer(description="运行时间（秒）"),
    },
)

device_list_response = ns_devices.model(
    "DeviceListResponse",
    {
        "id": fields.Integer(description="设备ID"),
        "device_id": fields.String(description="设备标识"),
        "name": fields.String(description="设备名称"),
        "status": fields.String(description="状态"),
        "is_online": fields.Boolean(description="是否在线"),
        "last_heartbeat": fields.String(description="最后心跳时间"),
        "wifi_signal": fields.Integer(description="WiFi信号强度"),
        "uptime": fields.Integer(description="运行时间"),
        "box_a_status": fields.String(description="Box A状态"),
        "box_b_status": fields.String(description="Box B状态"),
        "system_state": fields.String(description="系统状态"),
        "class_info_id": fields.Integer(description="班级ID"),
        "class_name": fields.String(description="班级名称"),
        "admin_id": fields.Integer(description="管理员ID"),
        "admin_name": fields.String(description="管理员姓名"),
        "admin_username": fields.String(description="管理员用户名"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

device_stats_response = ns_devices.model(
    "DeviceStatsResponse",
    {
        "total_devices": fields.Integer(description="设备总数"),
        "online_devices": fields.Integer(description="在线设备数"),
        "offline_devices": fields.Integer(description="离线设备数"),
        "error_devices": fields.Integer(description="故障设备数"),
        "today_heartbeats": fields.Integer(description="今日心跳数"),
        "recent_activity": fields.List(fields.Raw, description="最近活动"),
    },
)

bind_class_model = ns_devices.model(
    "BindClassRequest", {"class_id": fields.Integer(description="班级ID（设为null可解绑）")}
)

bind_admin_model = ns_devices.model(
    "BindAdminRequest", {"admin_id": fields.Integer(description="管理员ID（设为null可解绑）")}
)

# 开锁指令：action -> (MQTT 主题, 载荷)
# 差异 #14：unlock_a 载荷由空字符串改为与 unlock_b 同构的 JSON（设备端只需一套解析）；
# 空字符串仍被 _decode_unlock_payload 兼容解析，旧固件不受影响。
_UNLOCK_SPECS = {
    "unlock_a": (
        "phonebox/unlock/A",
        '{"result": "true", "reason": "manual", "current_score": null}',
    ),
    "unlock_b": (
        "phonebox/unlock/B",
        '{"result": "true", "reason": "manual", "current_score": 999}',
    ),
}

def _restart_command_payload(device, action):
    """构造重启指令载荷（差异 #5）。

    统一携带 device_id，使设备端能够自校验「这条指令是不是发给我的」，
    避免历史广播载荷 `{"command": "restart"}` 导致任一设备被重启时全校设备同时重启。
    """
    return json.dumps(
        {
            "command": "restart",
            "action": action,
            "device_id": device.device_id,
            "timestamp": int(time.time()),
        }
    )

def _send_device_restart(device, action):
    """发送重启指令并返回对应的响应（差异 #5：定向发布，不再无差别广播）。

    发布两条：
    1) 定向 topic `phonebox/control/restart/{device_id}` —— 新固件按此主题接收，
       天然只影响目标设备；
    2) 旧广播 topic `phonebox/control/restart` —— 保持向后兼容（老固件仍只订阅该主题），
       载荷已带 device_id，固件升级后即可自行过滤。
    定向发布失败但广播成功时仍视为成功（兼容期以广播为准）。
    """
    payload = _restart_command_payload(device, action)
    directed_topic = f"phonebox/control/restart/{device.device_id}"
    directed_ok = publish_mqtt(directed_topic, payload)
    broadcast_ok = publish_mqtt("phonebox/control/restart", payload)

    if directed_ok or broadcast_ok:
        return APIResponse.success(
            message="重启指令已发送",
            data={
                "action": action,
                "device_id": device.device_id,
                "device_type": getattr(device, "device_type", None),
                "topic": directed_topic,
                "directed": directed_ok,
                "broadcast": broadcast_ok,
            },
        )
    return APIResponse.server_error(message="MQTT发送失败，请检查连接")

def _publish_unlock_retry(topic, payload):
    """多次发送开锁指令，确保设备在可接收状态时能收到。"""
    for attempt in range(3):
        publish_mqtt(topic, payload)
        if attempt < 2:
            time.sleep(0.5)  # 等待500ms后重试

def _start_smart_unlock(device, action):
    """在后台线程执行智能开锁流程，避免阻塞响应。"""
    unlock_topic, payload = _UNLOCK_SPECS[action]
    thread = threading.Thread(target=_publish_unlock_retry, args=(unlock_topic, payload))
    thread.daemon = True
    thread.start()

    box = "A" if action == "unlock_a" else "B"
    return APIResponse.success(
        message=f"{box}箱智能开锁指令已发送（后台执行，共发送3次）",
        data={
            "action": action,
            "device_id": device.device_id,
            "device_type": getattr(device, "device_type", None),
        },
    )

ota_upgrade_model = ns_devices.model(
    "OTAUpgrade",
    {
        "firmware_url": fields.String(required=True, description="固件下载URL"),
        "version": fields.String(description="目标固件版本"),
        "force": fields.Boolean(description="是否强制升级（忽略版本检查）", default=False),
    },
)

# === 差异 #4 阶段 3：设备密钥管理 ===

import api.devices._devices_part1
import api.devices._devices_part2
import api.devices._devices_part3
