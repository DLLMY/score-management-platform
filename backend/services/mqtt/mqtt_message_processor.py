import json
import traceback
from datetime import datetime

from .mqtt_interface import IMQTTMessageProcessor
from utils.db_session import db_session_scope
from models import db


class MQTTMessageProcessor(IMQTTMessageProcessor):

    def __init__(self):
        self._app = None

    def set_app(self, app):
        self._app = app

    def _get_app_context(self):
        from app import app as default_app

        return self._app or default_app

    def process_messages_batch(self, messages):
        from models import MQTTLog

        logs_to_insert = []
        heartbeat_data = []

        app = self._get_app_context()
        with app.app_context():
            for msg in messages:
                topic = msg["topic"]
                message = msg["message"]
                timestamp = datetime.fromtimestamp(msg["timestamp"])

                logs_to_insert.append(
                    MQTTLog(
                        topic=topic,
                        message=message,
                        direction="receive",
                        timestamp=timestamp,
                    )
                )

                if topic == "phonebox/heartbeat":
                    heartbeat_data.append({"topic": topic, "message": message})

            if logs_to_insert:
                from models import db

                with db_session_scope():
                    db.session.add_all(logs_to_insert)
                print(f"[MQTTMessageProcessor] 批量写入 {len(logs_to_insert)} 条日志")

            for data in heartbeat_data:
                self._process_heartbeat(data["topic"], data["message"])

    def process_critical_message(self, topic, message, callbacks=None):
        if topic.startswith("phonebox/ota/"):
            self._process_ota_status(topic, message)

        if callbacks:
            for callback in callbacks:
                try:
                    callback(topic, message)
                except Exception as e:
                    print(f"[MQTTMessageProcessor] 消息回调处理错误: {e}")

    def _process_ota_status(self, topic, message):
        try:
            data = json.loads(message)
            device_id = data.get("device_id")
            status = data.get("status")
            progress = data.get("progress", -1)
            from_version = data.get("from_version")
            to_version = data.get("to_version")
            error_message = data.get("error_message")

            print((f"[OTA] 设备 {device_id} OTA状态更新: " f"status={status}, progress={progress}%"))

            from models import DeviceFirmwareUpdate, OperationLog

            app = self._get_app_context()
            with app.app_context():
                with db_session_scope():
                    if status == "started":
                        record = DeviceFirmwareUpdate(
                            device_id=device_id,
                            from_version=from_version,
                            to_version=to_version,
                            status="in_progress",
                            started_at=datetime.now(),
                        )
                        db.session.add(record)
                        print((f"[OTA] 设备 {device_id} 开始升级: " f"{from_version} -> {to_version}"))

                    elif status == "downloading" or status == "updating":
                        record = (
                            DeviceFirmwareUpdate.query.filter_by(
                                device_id=device_id,
                                to_version=to_version,
                                status="in_progress",
                            )
                            .order_by(DeviceFirmwareUpdate.started_at.desc())
                            .first()
                        )

                        if record:
                            print(f"[OTA] 设备 {device_id} 升级进度: {progress}%")
                        else:
                            record = DeviceFirmwareUpdate(
                                device_id=device_id,
                                from_version=from_version,
                                to_version=to_version,
                                status="in_progress",
                                started_at=datetime.now(),
                            )
                            db.session.add(record)

                    elif status == "success" or status == "completed":
                        record = (
                            DeviceFirmwareUpdate.query.filter_by(
                                device_id=device_id,
                                to_version=to_version,
                                status="in_progress",
                            )
                            .order_by(DeviceFirmwareUpdate.started_at.desc())
                            .first()
                        )

                        if record:
                            record.status = "completed"
                            record.completed_at = datetime.now()
                            print((f"[OTA] 设备 {device_id} 升级成功: " f"{from_version} -> {to_version}"))

                        log = OperationLog(
                            operation_type="firmware_upgrade_success",
                            target_type="device",
                            target_id=device_id,
                            operator="OTA System",
                            description=(f"设备 {device_id} 固件升级成功: " f"{from_version} -> {to_version}"),
                        )
                        db.session.add(log)

                    elif status == "failed" or status == "error":
                        record = (
                            DeviceFirmwareUpdate.query.filter_by(
                                device_id=device_id,
                                to_version=to_version,
                                status="in_progress",
                            )
                            .order_by(DeviceFirmwareUpdate.started_at.desc())
                            .first()
                        )

                        if record:
                            record.status = "failed"
                            record.completed_at = datetime.now()
                            record.error_message = error_message
                            print(f"[OTA] 设备 {device_id} 升级失败: {error_message}")

                        log = OperationLog(
                            operation_type="firmware_upgrade_failed",
                            target_type="device",
                            target_id=device_id,
                            operator="OTA System",
                            description=(
                                f"设备 {device_id} 固件升级失败: "
                                f"{from_version} -> {to_version}, "
                                f"错误: {error_message}"
                            ),
                        )
                        db.session.add(log)

        except Exception as e:
            print(f"[OTA] 处理OTA状态消息失败: {e}")

            traceback.print_exc()

    def _process_heartbeat(self, topic, message):
        try:
            data = json.loads(message)
            device_id = data.get("device_id")

            if device_id:
                from models import Device, DeviceHeartbeat

                app = self._get_app_context()
                with app.app_context():
                    with db_session_scope():
                        device = Device.query.filter_by(device_id=device_id).first()
                        if not device:
                            device = Device(
                                device_id=device_id,
                                name=f"设备 {device_id}",
                                status="online",
                            )
                            db.session.add(device)
                            print(f"[设备注册] 新设备自动注册: {device_id}")

                        device.status = "online"
                        device.last_heartbeat = datetime.now()
                        device.wifi_signal = data.get("wifi_signal")
                        device.uptime = data.get("uptime")
                        device.box_a_status = data.get("box_a_status")
                        device.box_b_status = data.get("box_b_status")
                        device.system_state = data.get("system_state")
                        device.fw_version = data.get("fw_version")
                        device.platform = data.get("platform")
                        device.free_heap = data.get("free_heap")
                        device.updated_at = datetime.now()

                        heartbeat = DeviceHeartbeat.query.filter_by(device_id=device_id).first()
                        if heartbeat:
                            heartbeat.timestamp = data.get("timestamp")
                            heartbeat.status = data.get("status")
                            heartbeat.wifi_signal = data.get("wifi_signal")
                            heartbeat.uptime = data.get("uptime")
                            heartbeat.box_a_status = data.get("box_a_status")
                            heartbeat.box_b_status = data.get("box_b_status")
                            heartbeat.system_state = data.get("system_state")
                        else:
                            heartbeat = DeviceHeartbeat(
                                device_id=device_id,
                                timestamp=data.get("timestamp"),
                                status=data.get("status"),
                                wifi_signal=data.get("wifi_signal"),
                                uptime=data.get("uptime"),
                                box_a_status=data.get("box_a_status"),
                                box_b_status=data.get("box_b_status"),
                                system_state=data.get("system_state"),
                            )
                            db.session.add(heartbeat)

                        device_data = {
                            "device_id": device_id,
                            "status": device.status,
                            "wifi_signal": device.wifi_signal,
                            "uptime": device.uptime,
                            "box_a_status": device.box_a_status,
                            "box_b_status": device.box_b_status,
                            "system_state": device.system_state,
                            "last_heartbeat": (device.last_heartbeat.isoformat() if device.last_heartbeat else None),
                        }
                    print(f"设备心跳更新成功: {device_id}")

                    try:
                        from services.websocket_service import send_device_status

                        send_device_status(device_id, device_data)
                        print(f"设备状态已通过WebSocket发送: {device_id}")
                    except Exception as ws_e:
                        print(f"发送WebSocket消息失败: {ws_e}")
        except Exception as e:
            print(f"处理心跳消息错误: {e}")

            traceback.print_exc()
