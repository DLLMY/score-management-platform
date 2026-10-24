import json
import logging
import time
from datetime import datetime, timedelta

from services.mqtt._shared import record_ota_update

logger = logging.getLogger(__name__)

class _OtaMixin:

    @staticmethod
    def _resolve_register_device_id(topic, data):
        """解析 OTA 注册的 device_id：payload 优先，其次从 topic 取（…/{device_id}/register）。"""
        device_id = data.get("device_id")
        if not device_id and topic != "phonebox/ota/register":
            parts = topic.split("/")
            if len(parts) >= 3:
                device_id = parts[2]
        return device_id

    @staticmethod
    def _apply_register_fields(device, data):
        """把注册上报的可选字段写入设备（仅非空才覆盖，避免清空已有值）。"""
        for field in ("fw_version", "platform", "device_type"):
            value = data.get(field)
            if value:
                setattr(device, field, value)

    def _process_ota_register(self, topic, message):
        """处理设备主动注册 / 类型上报（phonebox/ota/register 或 phonebox/ota/{device_id}/register）"""
        try:
            data = json.loads(message)
            device_id = self._resolve_register_device_id(topic, data)
            if not device_id:
                return

            # 差异 #15：宽松 device_id 兜底校验（仅拦截非法形态，不拒绝存量设备）
            from services.heartbeat_service import is_safe_device_id

            if not is_safe_device_id(device_id):
                logger.warning(f"[OTA] 设备注册 device_id 非法，已忽略: {device_id!r}")
                return

            device_type = data.get("device_type")
            fw_version = data.get("fw_version")

            from app import app
            from models import Device, db

            with app.app_context():
                device = Device.query.filter_by(device_id=device_id).first()

                # 差异 #4：白名单 + 签名准入（默认关闭/无密钥 ⇒ 放行，零行为变化）
                if not self._passes_device_auth_gate(device, data, device_id, kind="OTA 注册"):
                    return

                if not device:
                    device = Device(device_id=device_id, name=f"设备 {device_id}", status="online")
                    db.session.add(device)
                device.status = "online"
                device.last_heartbeat = datetime.now()
                self._apply_register_fields(device, data)
                db.session.commit()
                logger.info(
                    f"[OTA] 设备注册/类型上报: {device_id} type={device_type} fw={fw_version}"
                )
                # 版本协商 + 可能自动推送（无缝 OTA 闭环）
                try:
                    from services.ota_negotiation_service import try_auto_negotiate

                    try_auto_negotiate(device)
                except Exception as neg_e:
                    logger.warning(f"[OTA] 协商跳过（异常）: {neg_e}")
        except Exception as e:
            logger.error(f"[OTA] 处理设备注册失败: {e}")

    # S5-A-P1-1 修复: 固件失败状态码全集映射（原仅 failed/error → 其余失败码不落 failed、
    # device.ota_status 停 upgrading、can_auto_push 永久拒绝 → 自动推送死锁）
    _OTA_FAILURE_STATUSES = (
        "failed",
        "error",
        "download_failed",
        "space_insufficient",
        "begin_failed",
        "signature_failed",
        "version_check_failed",
        "resume_exhausted",
        "incomplete",
    )

    def _process_ota_status(self, topic, message):
        """处理OTA状态消息

        设备通过 phonebox/ota/status 或 phonebox/ota/{device_id}/status 主题
        上报OTA升级进度和结果。
        """
        try:
            data = json.loads(message)
            device_id = data.get("device_id")
            status = data.get("status")
            progress = data.get("progress", -1)
            from_version = data.get("from_version")
            to_version = data.get("to_version")
            error_message = data.get("error_message")

            logger.info(
                f"[OTA] 设备 {device_id} OTA状态更新: status={status}, progress={progress}%"
            )

            from app import app
            from models import Device, db

            with app.app_context():
                device = Device.query.filter_by(device_id=device_id).first()
                device_ota_status = None

                if status == "started":
                    device_ota_status = self._handle_ota_started(
                        device, device_id, from_version, to_version
                    )

                elif status == "downloading" or status == "updating":
                    device_ota_status = self._handle_ota_progress(
                        device, device_id, from_version, to_version, progress
                    )

                elif status == "success" or status == "completed":
                    device_ota_status = self._handle_ota_success(
                        device, device_id, from_version, to_version
                    )

                elif status in self._OTA_FAILURE_STATUSES:
                    device_ota_status = self._handle_ota_failure(
                        device, device_id, from_version, to_version, error_message
                    )

                # 回写设备 OTA 状态（无缝闭环自愈：升级成功/失败/进行中）
                if device is not None and device_ota_status is not None:
                    device.ota_status = device_ota_status
                    db.session.commit()

        except Exception as e:
            logger.error(f"[OTA] 处理OTA状态消息失败: {e}")

    def _find_in_progress_firmware_update(self, device_id, to_version):
        """查找该设备指定目标版本进行中的固件升级记录。"""
        from models import DeviceFirmwareUpdate

        return (
            DeviceFirmwareUpdate.query.filter_by(
                device_id=device_id, to_version=to_version, status="in_progress"
            )
            .order_by(DeviceFirmwareUpdate.started_at.desc())
            .first()
        )

    def _handle_ota_started(self, device, device_id, from_version, to_version):
        """开始升级：落一条 in_progress 记录，设备在线时置为 upgrading。

        G4: 同时开启 OTA 离线保护窗（now+10min），升级期间心跳中断不判离线/不告警。
        """
        from models import DeviceFirmwareUpdate, db

        record_ota_update(device.device_type if device else None, "started")
        record = DeviceFirmwareUpdate(
            device_id=device_id,
            from_version=from_version,
            to_version=to_version,
            status="in_progress",
            started_at=datetime.now(),
        )
        db.session.add(record)
        db.session.commit()
        logger.info(f"[OTA] 设备 {device_id} 开始升级: {from_version} -> {to_version}")

        if device:
            # G4: 开启离线保护窗，避免下载/重启期心跳中断被误判离线
            device.ota_protect_until = datetime.now() + timedelta(minutes=10)
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
            return "upgrading"
        return None

    def _handle_ota_progress(self, device, device_id, from_version, to_version, progress):
        """升级进度：记录进度日志；设备不存在时补一条 in_progress 记录。"""
        from models import DeviceFirmwareUpdate, db

        record = self._find_in_progress_firmware_update(device_id, to_version)

        if record:
            logger.info(f"[OTA] 设备 {device_id} 升级进度: {progress}%")
        if device:
            return "upgrading"

        record = DeviceFirmwareUpdate(
            device_id=device_id,
            from_version=from_version,
            to_version=to_version,
            status="in_progress",
            started_at=datetime.now(),
        )
        db.session.add(record)
        db.session.commit()
        return None

    def _handle_ota_success(self, device, device_id, from_version, to_version):
        """升级成功：关闭 in_progress 记录，回写设备版本并落操作日志。"""
        from models import OperationLog, db

        record = self._find_in_progress_firmware_update(device_id, to_version)

        if record:
            record.status = "completed"
            record.completed_at = datetime.now()
            db.session.commit()
            logger.info(f"[OTA] 设备 {device_id} 升级成功: {from_version} -> {to_version}")

        record_ota_update(device.device_type if device else None, "completed")
        device_ota_status = None
        if device:
            device_ota_status = "idle"
            if to_version:
                device.fw_version = to_version
            device.last_ota_push_at = None
            # G4: 升级结束，解除离线保护窗，恢复常规心跳判定
            device.ota_protect_until = None

        log = OperationLog(
            operation_type="firmware_upgrade_success",
            target_type="device",
            target_id=device_id,
            operator="OTA System",
            description=f"设备 {device_id} 固件升级成功: {from_version} -> {to_version}",
        )
        db.session.add(log)
        db.session.commit()
        return device_ota_status

    def _handle_ota_failure(self, device, device_id, from_version, to_version, error_message):
        """升级失败：标记记录为 failed，落操作日志，设备在线时置为 failed。"""
        from models import OperationLog, db

        record = self._find_in_progress_firmware_update(device_id, to_version)

        if record:
            record.status = "failed"
            record.completed_at = datetime.now()
            record.error_message = error_message
            db.session.commit()
            logger.error(f"[OTA] 设备 {device_id} 升级失败: {error_message}")

        record_ota_update(device.device_type if device else None, "failed")

        log = OperationLog(
            operation_type="firmware_upgrade_failed",
            target_type="device",
            target_id=device_id,
            operator="OTA System",
            description=f"设备 {device_id} 固件升级失败: {from_version} -> {to_version}, 错误: {error_message}",
        )
        db.session.add(log)
        db.session.commit()

        device_ota_status = None
        if device:
            device_ota_status = "failed"
            # G4: 升级失败，解除离线保护窗
            device.ota_protect_until = None
        return device_ota_status

    def publish_ota_command(self, device_id=None, payload=None):
        """发布OTA固件升级指令

        Args:
            device_id: 目标设备ID（可选，为None时向所有设备广播）
            payload: OTA指令内容，包含:
                - url: 固件下载URL
                - version: 目标版本
                - md5: MD5校验值（可选）
                - force: 是否强制升级（可选）

        Returns:
            bool: 发布是否成功
        """
        if payload is None:
            payload = {}

        topic = f"phonebox/ota/{device_id}" if device_id else "phonebox/ota"

        ota_payload = {"action": "update", "timestamp": int(time.time())}
        ota_payload.update(payload)

        logger.info(f"[OTA] 发送OTA指令到 {topic}: {json.dumps(ota_payload)}")
        return self.publish(topic, json.dumps(ota_payload), qos=1)
