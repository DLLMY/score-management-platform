import json
import logging
import time
from datetime import datetime

from services.mqtt._shared import record_mqtt_message

logger = logging.getLogger(__name__)

class _MessageMixin:

    def _on_message_control(self, client, userdata, msg):
        try:
            message = msg.payload.decode()
            topic = msg.topic
            record_mqtt_message("received", "control")
            # 控制消息写 MQTTLog（审计），并即时派发到业务回调。
            self._queue_message(topic, message)
            # score/add、score/undo、phonebox/query、phonebox/unlock/、phonebox/ota/、
            # phonebox/points/* 均只在控制连接订阅，绝不被 phonebox/# 遥测洪流淹没。
            if (
                topic == "phonebox/query"
                or topic.startswith("score/")
                or topic.startswith("phonebox/unlock/")
                or topic.startswith("phonebox/ota/")
                or topic.startswith("phonebox/points/")
                or topic.startswith("phonebox/control/restart/ack/")
                or topic.startswith("phonebox/leave/")
            ):
                self._process_critical_message(topic, message)
        except Exception as e:
            logger.error(f"[MQTTManager] 处理控制消息失败: {e}")

    def _on_message_telemetry(self, client, userdata, msg):
        try:
            message = msg.payload.decode()
            topic = msg.topic
            record_mqtt_message("received", "telemetry")
            # 控制类 topic 由控制连接处理，遥测连接收到则跳过，避免重复业务派发
            if topic in self._CONTROL_TOPIC_EXACT or topic.startswith(self._CONTROL_TOPIC_PREFIXES):
                return
            self._handle_telemetry(topic, message)
        except Exception as e:
            logger.error(f"[MQTTManager] 处理遥测消息失败: {e}")

    def _handle_telemetry(self, topic, message):
        """遥测消息（phonebox/# 高频）：心跳实时推 WS，DB 落库与审计日志异步入 Celery；
        Celery 不可用时同步兜底。控制类 topic 已在 _on_message_telemetry 过滤。"""
        try:
            data = json.loads(message)
        except Exception:
            data = None
        # 心跳：后端线程直接推 WS（设备状态实时刷新），DB 落库交给 Celery worker
        if topic == "phonebox/heartbeat" and isinstance(data, dict) and data.get("device_id"):
            try:
                from services.websocket_service import send_device_status

                device_data = {
                    "device_id": data.get("device_id"),
                    "status": data.get("status"),
                    "wifi_signal": data.get("wifi_signal"),
                    "uptime": data.get("uptime"),
                    "box_a_status": data.get("box_a_status"),
                    "box_b_status": data.get("box_b_status"),
                    "system_state": data.get("system_state"),
                    "last_heartbeat": data.get("timestamp"),
                }
                send_device_status(data.get("device_id"), device_data)
            except Exception as e:
                logger.error(f"[MQTTManager] 心跳WS推送失败: {e}")
        # 异步入 Celery（mqtt 队列），失败再同步兜底
        try:
            from tasks.mqtt_tasks import process_phonebox_telemetry

            process_phonebox_telemetry.delay(topic, message)
        except Exception as e:
            logger.error(f"[MQTTManager] 遥测入Celery失败, 同步兜底: {e}")
            self._process_telemetry_fallback(topic, message)

    def _process_telemetry_fallback(self, topic, message):
        """Celery 不可用时的同步兜底：写 MQTTLog 接收日志 + 处理心跳。"""
        try:
            data = json.loads(message)
        except Exception:
            data = None
        try:
            from app import app as flask_app
            from models import MQTTLog, db

            with flask_app.app_context():
                try:
                    db.session.add(
                        MQTTLog(
                            topic=topic,
                            message=message,
                            direction="receive",
                            timestamp=datetime.now(),
                        )
                    )
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    logger.exception("[MQTTManager] 遥测兜底落库失败（已回滚）")
                if topic == "phonebox/heartbeat" and isinstance(data, dict):
                    from services.mqtt_message_service import mqtt_message_service

                    mqtt_message_service.handle_heartbeat_message(data)
        except Exception as e:
            logger.error(f"[MQTTManager] 遥测兜底处理失败: {e}")

    def _queue_message(self, topic, message):
        """将消息加入队列，批量处理"""
        with self._queue_lock:
            self._message_queue.append(
                {"topic": topic, "message": message, "timestamp": time.time()}
            )

        # 检查是否需要立即刷新
        current_time = time.time()
        if (
            current_time - self._last_flush_time >= self._flush_interval
            or len(self._message_queue) >= 50
        ):
            self._flush_messages()

    def _flush_messages(self):
        """批量处理队列中的消息"""
        if self._queue_processing:
            return

        self._queue_processing = True
        try:
            messages = []
            with self._queue_lock:
                while self._message_queue:
                    messages.append(self._message_queue.popleft())

            if messages:
                self._process_messages_batch(messages)
                self._last_flush_time = time.time()
        finally:
            self._queue_processing = False

    def _process_messages_batch(self, messages):
        """批量处理消息"""
        from app import app
        from models import MQTTLog, db

        logs_to_insert = []
        heartbeat_data = []

        with app.app_context():
            for msg in messages:
                topic = msg["topic"]
                message = msg["message"]
                timestamp = datetime.fromtimestamp(msg["timestamp"])

                # 创建日志记录
                logs_to_insert.append(
                    MQTTLog(topic=topic, message=message, direction="receive", timestamp=timestamp)
                )

                # 心跳消息单独收集用于更新设备状态
                if topic == "phonebox/heartbeat":
                    heartbeat_data.append({"topic": topic, "message": message})

            # 批量插入日志
            if logs_to_insert:
                db.session.add_all(logs_to_insert)
                db.session.commit()
                logger.info(f"[MQTTManager] 批量写入 {len(logs_to_insert)} 条日志")

            # 处理心跳消息更新设备状态（逐条隔离：单条异常不影响其余心跳处理）
            for data in heartbeat_data:
                try:
                    self._process_heartbeat(data["topic"], data["message"])
                except Exception as e:
                    logger.warning(f"[MQTTManager] 心跳处理异常(已跳过本条): {e}")

    @staticmethod
    def _passes_device_auth_gate(device, data, device_id, kind="心跳"):
        """差异 #4 统一准入门禁：白名单（阶段 1）+ 签名（阶段 2）。

        返回 True 表示放行。所有判定集中在此，避免在各处理函数里重复分支
        （同时把圈复杂度挡在调用方之外）。

        默认行为与改造前完全一致：
          - 白名单开关默认关闭 ⇒ 未登记设备照旧允许「上报即注册」；
          - 设备无密钥 ⇒ 验签直接放行。
        """
        from utils.device_auth import should_register_unknown_device

        if not device and not should_register_unknown_device():
            logger.warning(f"[设备认证] 白名单已开启，拒绝未登记设备{kind}注册: {device_id}")
            return False

        # G7: LWT 遗嘱（broker 在设备断线后代发，payload 含 status=offline）。
        # broker 已做传输层认证（设备确实建立过连接），且设备无法在断线瞬间
        # 重新计算 HMAC 签名，故对离线遗嘱跳过应用层签名校验，直接放行以便秒级置 offline。
        # 仅对心跳类且 status=offline 的消息生效，其他门禁语义不变。
        if kind == "心跳" and isinstance(data, dict) and data.get("status") == "offline":
            return True

        from utils.device_auth import verify_device_signature

        sig_ok, sig_reason = verify_device_signature(device, data)
        if not sig_ok:
            logger.warning(f"[设备认证] {kind}签名校验失败 ({sig_reason})，已丢弃: {device_id}")
            return False
        return True

    def _process_critical_message(self, topic, message):
        """立即处理关键消息（如刷卡查询、OTA状态、重启回执）"""
        if topic.startswith("phonebox/control/restart/ack"):
            try:
                self._process_restart_ack(topic, message)
            except Exception as e:
                logger.error(f"[MQTTManager] 重启回执处理异常(已隔离): {e}")

        if topic.startswith("phonebox/ota/"):
            try:
                if topic.endswith("/status") or topic == "phonebox/ota/status":
                    self._process_ota_status(topic, message)
                elif topic.endswith("/register") or topic == "phonebox/ota/register":
                    self._process_ota_register(topic, message)
            except Exception as e:
                logger.error(f"[MQTTManager] OTA 消息处理异常(已隔离, 不影响其余回调): {e}")

        for callback in self._message_callbacks:
            try:
                callback(topic, message)
            except Exception as e:
                logger.error(f"[MQTTManager] 消息回调处理错误: {e}")

    def _process_restart_ack(self, topic, message):
        """处理设备重启回执（差异 #5 配套）：记录 MQTTLog 审计并刷新设备心跳时间。

        设备应在执行重启前上报 `phonebox/control/restart/ack` 或
        `phonebox/control/restart/ack/{device_id}`，payload 示例：
            {"device_id": "PB-01", "action": "restart", "result": "accepted"}
        处理策略为「只审计、不写业务状态」——重启会导致设备离线属预期行为，
        因此不在此把 device.status 置为 online，避免掩盖真实离线。
        """
        try:
            data = json.loads(message)
        except Exception:
            data = {}
        if not isinstance(data, dict):
            data = {}

        device_id = data.get("device_id")
        if not device_id and topic != "phonebox/control/restart/ack":
            parts = topic.split("/")
            # phonebox/control/restart/ack/{device_id}
            if len(parts) >= 6 and parts[5]:
                device_id = parts[5]
        if not device_id:
            logger.warning(f"[MQTTManager] 重启回执缺少 device_id，已忽略: topic={topic}")
            return

        from app import app
        from models import Device, MQTTLog, db

        with app.app_context():
            try:
                db.session.add(
                    MQTTLog(
                        topic=topic,
                        message=message,
                        direction="receive",
                        timestamp=datetime.now(),
                    )
                )
                # 仅刷新「最近一次通信时间」，不动 status（重启中设备应自然转为离线）
                device = Device.query.filter_by(device_id=device_id).first()
                if device:
                    device.last_heartbeat = datetime.now()
                    device.updated_at = datetime.now()
                db.session.commit()
                logger.info(
                    f"[MQTTManager] 收到重启回执: device_id={device_id}, "
                    f"result={data.get('result')}, action={data.get('action')}"
                )
            except Exception as e:
                db.session.rollback()
                logger.error(f"[MQTTManager] 重启回执落库失败（已回滚）: {e}")
