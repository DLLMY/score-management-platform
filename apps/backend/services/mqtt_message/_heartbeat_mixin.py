"""心跳链路：设备心跳落库、离线感知与错误自动告警。"""

from models import db
from services.heartbeat_service import (
    apply_heartbeat_to_device,
    check_device_errors,
    extract_heartbeat_timestamp,
    is_safe_device_id,
    mark_device_offline_by_lwt,
)
from services.mqtt_message import _shared
from services.mqtt_message._shared import ensure_app_context
from utils.logger import log_warning


class _HeartbeatMixin:
    @ensure_app_context
    def handle_heartbeat_message(self, data):
        device_id = data.get("device_id")
        timestamp = extract_heartbeat_timestamp(data)
        status = data.get("status")
        wifi_signal = data.get("wifi_signal")
        uptime = data.get("uptime")
        box_a_status = data.get("box_a_status")
        box_b_status = data.get("box_b_status")
        system_state = data.get("system_state")

        # fw_version / platform / free_heap / last_error / error_count 不再在此逐个取局部变量，
        # 统一由 apply_heartbeat_to_device 按字段映射表写入（差异 #3）。
        # 差异 #15：宽松 device_id 兜底校验（仅拦截非法形态，不拒绝存量设备）
        if not is_safe_device_id(device_id):
            log_warning(f"[心跳] device_id 非法，已忽略: {device_id!r}")
            return

        with _shared.db_session_scope():
            from models import Device, DeviceHeartbeat

            device = Device.query.filter_by(device_id=device_id).first()

            # 差异 #4：白名单 + 签名准入（默认关闭/无密钥 ⇒ 放行，零行为变化）。
            # 与 mqtt_manager._process_heartbeat 共用同一门禁语义，避免两条心跳路径漂移。
            from services.mqtt_manager import MQTTManager

            if not MQTTManager._passes_device_auth_gate(device, data, device_id, kind="心跳"):
                return

            # G7: LWT 遗嘱（status=offline）— broker 断线后代发，设备确已离线。
            # 直接置 offline（不强制 online、不跑错误告警、不自动注册），实现秒级离线感知。
            if status == "offline":
                mark_device_offline_by_lwt(device)
                return

            heartbeat_record = DeviceHeartbeat(
                device_id=device_id,
                timestamp=timestamp,
                status=status,
                wifi_signal=wifi_signal,
                uptime=uptime,
                box_a_status=box_a_status,
                box_b_status=box_b_status,
                system_state=system_state,
            )
            db.session.add(heartbeat_record)

            if device:
                # 差异 #3：统一走 apply_heartbeat_to_device（键存在且非 None 才覆盖），
                # 不再无条件覆盖各字段——避免设备按需上报时把已有状态清空。
                apply_heartbeat_to_device(device, data, touch_status=True)
                # 差异 #11：设备错误自动告警（last_error / error_count 超阈值）
                check_device_errors(device, data)
            else:
                device = Device(
                    device_id=device_id,
                    name=f"Device {device_id}",
                    status=status,
                )
                db.session.add(device)
                # 新建设备同样走统一写入，保证首帧心跳与后续心跳字段语义一致
                apply_heartbeat_to_device(device, data, touch_status=True)
                # 差异 #11：新设备首帧即带上错误信息时也要告警
                check_device_errors(device, data)
