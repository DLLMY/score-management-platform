import json
import logging

logger = logging.getLogger(__name__)

class _HeartbeatMixin:

    def _process_heartbeat(self, topic, message):
        """处理心跳消息，更新设备状态"""
        try:
            data = json.loads(message)
            device_id = data.get("device_id")

            if device_id:
                from app import app
                from models import Device, DeviceHeartbeat, db

                # 差异 #3/#11：心跳统一写入 + 设备错误自动告警
                # 差异 #15：宽松 device_id 兜底校验
                from services.heartbeat_service import (
                    apply_heartbeat_to_device,
                    check_device_errors,
                    extract_heartbeat_timestamp,
                    is_safe_device_id,
                    mark_device_offline_by_lwt,
                )

                if not is_safe_device_id(device_id):
                    logger.warning(f"[心跳] device_id 非法，已忽略: {device_id!r}")
                    return

                with app.app_context():
                    # 检查Device表中是否存在该设备，不存在则自动创建
                    device = Device.query.filter_by(device_id=device_id).first()

                    # 差异 #4：白名单 + 签名准入（默认关闭/无密钥 ⇒ 放行，零行为变化）
                    if not self._passes_device_auth_gate(device, data, device_id, kind="心跳"):
                        return

                    # G7: LWT 遗嘱（status=offline）→ 设备确已离线，直接置 offline 后返回，
                    # 不自动注册、不强制 online。
                    if data.get("status") == "offline":
                        mark_device_offline_by_lwt(device)
                        db.session.commit()
                        return

                    if not device:
                        # 自动注册新设备
                        device = Device(
                            device_id=device_id, name=f"设备 {device_id}", status="online"
                        )
                        db.session.add(device)
                        logger.info(f"[设备注册] 新设备自动注册: {device_id}")

                    # 差异 #3：统一走 apply_heartbeat_to_device，与 mqtt_message_service
                    # 的心跳路径共享同一字段映射与「键存在且非 None 才覆盖」语义。
                    apply_heartbeat_to_device(device, data, touch_status=True)
                    # 差异 #11：设备错误自动告警（last_error / error_count 超阈值）
                    check_device_errors(device, data)

                    # 更新或创建心跳记录
                    heartbeat = DeviceHeartbeat.query.filter_by(device_id=device_id).first()
                    if heartbeat:
                        heartbeat.timestamp = extract_heartbeat_timestamp(data)
                        heartbeat.status = data.get("status")
                        heartbeat.wifi_signal = data.get("wifi_signal")
                        heartbeat.uptime = data.get("uptime")
                        heartbeat.box_a_status = data.get("box_a_status")
                        heartbeat.box_b_status = data.get("box_b_status")
                        heartbeat.system_state = data.get("system_state")
                    else:
                        heartbeat = DeviceHeartbeat(
                            device_id=device_id,
                            timestamp=extract_heartbeat_timestamp(data),
                            status=data.get("status"),
                            wifi_signal=data.get("wifi_signal"),
                            uptime=data.get("uptime"),
                            box_a_status=data.get("box_a_status"),
                            box_b_status=data.get("box_b_status"),
                            system_state=data.get("system_state"),
                        )
                        db.session.add(heartbeat)
                    db.session.commit()
                    logger.info(f"设备心跳更新成功: {device_id}")
                    # 版本协商 + 可能自动推送（无缝 OTA 闭环）
                    try:
                        from services.ota_negotiation_service import try_auto_negotiate

                        try_auto_negotiate(device)
                    except Exception as neg_e:
                        logger.warning(f"[OTA] 协商跳过（异常）: {neg_e}")

                    # 通过WebSocket发送设备状态更新
                    try:
                        from services.websocket_service import send_device_status

                        device_data = {
                            "device_id": device_id,
                            "status": device.status,
                            "wifi_signal": device.wifi_signal,
                            "uptime": device.uptime,
                            "box_a_status": device.box_a_status,
                            "box_b_status": device.box_b_status,
                            "system_state": device.system_state,
                            "last_heartbeat": (
                                device.last_heartbeat.isoformat() if device.last_heartbeat else None
                            ),
                        }
                        send_device_status(device_id, device_data)
                        logger.info(f"设备状态已通过WebSocket发送: {device_id}")
                    except Exception as ws_e:
                        logger.error(f"发送WebSocket消息失败: {ws_e}")
        except Exception as e:
            logger.error(f"处理心跳消息错误: {e}")
