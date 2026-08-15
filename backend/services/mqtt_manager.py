import paho.mqtt.client as mqtt
import json
import threading
import time
import ssl
from datetime import datetime
from enum import Enum
from collections import deque


class MQTTConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class MQTTManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, instance_name="default"):
        # 单例模式，支持多个命名实例
        if cls._instance is None:
            cls._instance = {}
        if instance_name not in cls._instance:
            with cls._lock:
                if instance_name not in cls._instance:
                    cls._instance[instance_name] = super().__new__(cls)
                    cls._instance[instance_name]._initialized = False
                    cls._instance[instance_name]._instance_name = instance_name
        return cls._instance[instance_name]

    def __init__(self, instance_name="default"):
        if self._initialized:
            return

        self._initialized = True
        self._client = None
        self._telemetry_client = None
        self._state = MQTTConnectionState.DISCONNECTED
        self._telemetry_state = MQTTConnectionState.DISCONNECTED
        self._telemetry_subscribed_topics = []
        self._telemetry_reconnect_thread = None
        self._state_lock = threading.Lock()
        self._config = None
        self._subscribed_topics = []
        self._message_callbacks = []
        self._reconnect_thread = None
        self._reconnect_delay = 5
        self._max_reconnect_delay = 60
        self._should_reconnect = True
        self._connection_result = None

        # 性能优化：消息队列和批量处理
        self._message_queue = deque(maxlen=1000)
        self._queue_processing = False
        self._queue_lock = threading.Lock()
        self._flush_interval = 1.0  # 批量写入间隔（秒）
        self._last_flush_time = time.time()

        # 性能优化：缓存
        self._user_cache = {}
        self._cache_lock = threading.Lock()
        self._cache_ttl = 60  # 缓存有效期（秒）

        self.DEFAULT_CONFIG = {
            "broker": "nc5233fc.ala.cn-hangzhou.emqxsl.cn",
            "port": 8883,
            "client_id": "score_backend",
            "username": "phoneboxtest",
            "password": "123456",
            "ssl": True,
            "timeout": 10,
            "keepalive": 60,
            "transport": "tcp",
        }

        # 双连接分流（根治 phonebox/# ~5000msg/s 遥测洪流淹没 score/# 控制消息）：
        # - 控制连接（主 self._client）：只订阅 score/# + phonebox 控制类 topic（QoS1，即时业务派发），
        #   控制消息走独立 TCP 连接/缓冲区，永不被遥测洪流淹没。
        # - 遥测连接（self._telemetry_client）：只订阅 phonebox/#（QoS0，可容忍丢包），
        #   心跳/状态等异步入 Celery，不在请求路径处理。
        # 注意 EMQX 对单客户端订阅数有上限(~10)，两组订阅均在限额内。
        self.CONTROL_SUBSCRIPTIONS = [
            ("score/#", 1),
            ("phonebox/query", 1),
            ("phonebox/unlock/#", 1),
            ("phonebox/ota/#", 1),
            ("phonebox/points/#", 1),
        ]
        self.TELEMETRY_SUBSCRIPTIONS = [
            ("phonebox/#", 0),
        ]
        # 控制类 topic（遥测连接收到这些时跳过，交由控制连接处理，避免重复业务派发）
        self._CONTROL_TOPIC_EXACT = ("phonebox/query",)
        self._CONTROL_TOPIC_PREFIXES = ("score/", "phonebox/unlock/", "phonebox/ota/", "phonebox/points/")

    @property
    def state(self):
        with self._state_lock:
            return self._state

    @property
    def is_connected(self):
        return self.state == MQTTConnectionState.CONNECTED

    @property
    def subscribed_topics(self):
        return self._subscribed_topics.copy()

    def set_config(self, config):
        self._config = config

    def load_config_from_db(self):
        try:
            from models import MQTTConfig
            from app import app

            with app.app_context():
                config = MQTTConfig.query.first()
                if config:
                    self._config = {
                        "broker": config.broker,
                        "port": config.port,
                        "client_id": config.client_id,
                        "username": config.username,
                        "password": config.password,
                        "ssl": config.ssl,
                        "timeout": config.timeout,
                        "keepalive": config.keepalive,
                    }
                    print(f"[MQTTManager] 配置已从数据库加载: broker={config.broker}, port={config.port}")
                    return True
        except Exception as e:
            print(f"[MQTTManager] 从数据库加载配置失败: {e}")

        self._config = self.DEFAULT_CONFIG.copy()
        print("[MQTTManager] 使用默认配置")
        return False

    def _get_config(self):
        if self._config is None:
            self.load_config_from_db()
        return self._config or self.DEFAULT_CONFIG

    def _on_connect_control(self, client, userdata, flags, rc):
        print(f"[MQTTManager] 控制连接 _on_connect, rc={rc}, flags={flags}")
        with self._state_lock:
            if rc == 0:
                self._state = MQTTConnectionState.CONNECTED
                self._reconnect_delay = 5
                self._should_reconnect = True
                print("[MQTTManager] 控制连接成功!")
            else:
                self._state = MQTTConnectionState.ERROR
                error_messages = {
                    1: "协议版本错误",
                    2: "客户端标识符无效",
                    3: "服务器不可用",
                    4: "用户名或密码错误",
                    5: "未授权",
                }
                print(f"[MQTTManager] 控制连接失败, rc={rc}: {error_messages.get(rc, '未知错误')}")
        if self.is_connected:
            self._subscribed_topics = []
            for topic, qos in self.CONTROL_SUBSCRIPTIONS:
                client.subscribe(topic, qos=qos)
                self._subscribed_topics.append(topic)
            print(f"[MQTTManager] 控制连接已订阅: {[t[0] for t in self.CONTROL_SUBSCRIPTIONS]}")

    def _on_connect_telemetry(self, client, userdata, flags, rc):
        print(f"[MQTTManager] 遥测连接 _on_connect, rc={rc}, flags={flags}")
        with self._state_lock:
            if rc == 0:
                self._telemetry_state = MQTTConnectionState.CONNECTED
                print("[MQTTManager] 遥测连接成功!")
            else:
                self._telemetry_state = MQTTConnectionState.ERROR
                print(f"[MQTTManager] 遥测连接失败, rc={rc}")
        if self._telemetry_state == MQTTConnectionState.CONNECTED:
            self._telemetry_subscribed_topics = []
            for topic, qos in self.TELEMETRY_SUBSCRIPTIONS:
                client.subscribe(topic, qos=qos)
                self._telemetry_subscribed_topics.append(topic)
            print(f"[MQTTManager] 遥测连接已订阅: {[t[0] for t in self.TELEMETRY_SUBSCRIPTIONS]}")

    def _on_disconnect_control(self, client, userdata, rc):
        with self._state_lock:
            self._state = MQTTConnectionState.DISCONNECTED
            self._subscribed_topics = []
        print(f"[MQTTManager] 控制连接断开, rc={rc}")
        if rc != 0 and self._should_reconnect:
            print(f"[MQTTManager] 控制连接意外断开，准备重连...")
            self._schedule_reconnect("control")

    def _on_disconnect_telemetry(self, client, userdata, rc):
        with self._state_lock:
            self._telemetry_state = MQTTConnectionState.DISCONNECTED
            self._telemetry_subscribed_topics = []
        print(f"[MQTTManager] 遥测连接断开, rc={rc}")
        if rc != 0 and self._should_reconnect:
            print(f"[MQTTManager] 遥测连接意外断开，准备重连...")
            self._schedule_reconnect("telemetry")

    def _on_message_control(self, client, userdata, msg):
        try:
            message = msg.payload.decode()
            topic = msg.topic
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
            ):
                self._process_critical_message(topic, message)
        except Exception as e:
            print(f"[MQTTManager] 处理控制消息失败: {e}")

    def _on_message_telemetry(self, client, userdata, msg):
        try:
            message = msg.payload.decode()
            topic = msg.topic
            # 控制类 topic 由控制连接处理，遥测连接收到则跳过，避免重复业务派发
            if topic in self._CONTROL_TOPIC_EXACT or topic.startswith(self._CONTROL_TOPIC_PREFIXES):
                return
            self._handle_telemetry(topic, message)
        except Exception as e:
            print(f"[MQTTManager] 处理遥测消息失败: {e}")

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
                print(f"[MQTTManager] 心跳WS推送失败: {e}")
        # 异步入 Celery（mqtt 队列），失败再同步兜底
        try:
            from tasks.mqtt_tasks import process_phonebox_telemetry

            process_phonebox_telemetry.delay(topic, message)
        except Exception as e:
            print(f"[MQTTManager] 遥测入Celery失败, 同步兜底: {e}")
            self._process_telemetry_fallback(topic, message)

    def _process_telemetry_fallback(self, topic, message):
        """Celery 不可用时的同步兜底：写 MQTTLog 接收日志 + 处理心跳。"""
        try:
            data = json.loads(message)
        except Exception:
            data = None
        try:
            from app import app as flask_app
            from models import db, MQTTLog

            with flask_app.app_context():
                try:
                    db.session.add(
                        MQTTLog(topic=topic, message=message, direction="receive", timestamp=datetime.now())
                    )
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                if topic == "phonebox/heartbeat" and isinstance(data, dict):
                    from services.mqtt_message_service import mqtt_message_service

                    mqtt_message_service.handle_heartbeat_message(data)
        except Exception as e:
            print(f"[MQTTManager] 遥测兜底处理失败: {e}")

    def _queue_message(self, topic, message):
        """将消息加入队列，批量处理"""
        with self._queue_lock:
            self._message_queue.append({"topic": topic, "message": message, "timestamp": time.time()})

        # 检查是否需要立即刷新
        current_time = time.time()
        if current_time - self._last_flush_time >= self._flush_interval or len(self._message_queue) >= 50:
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
                logs_to_insert.append(MQTTLog(topic=topic, message=message, direction="receive", timestamp=timestamp))

                # 心跳消息单独收集用于更新设备状态
                if topic == "phonebox/heartbeat":
                    heartbeat_data.append({"topic": topic, "message": message})

            # 批量插入日志
            if logs_to_insert:
                db.session.add_all(logs_to_insert)
                db.session.commit()
                print(f"[MQTTManager] 批量写入 {len(logs_to_insert)} 条日志")

            # 处理心跳消息更新设备状态（逐条隔离：单条异常不影响其余心跳处理）
            for data in heartbeat_data:
                try:
                    self._process_heartbeat(data["topic"], data["message"])
                except Exception as e:
                    print(f"[MQTTManager] 心跳处理异常(已跳过本条): {e}")

    def _process_critical_message(self, topic, message):
        """立即处理关键消息（如刷卡查询、OTA状态）"""
        if topic.startswith("phonebox/ota/"):
            try:
                if topic.endswith("/status") or topic == "phonebox/ota/status":
                    self._process_ota_status(topic, message)
                elif topic.endswith("/register") or topic == "phonebox/ota/register":
                    self._process_ota_register(topic, message)
            except Exception as e:
                print(f"[MQTTManager] OTA 消息处理异常(已隔离, 不影响其余回调): {e}")

        for callback in self._message_callbacks:
            try:
                callback(topic, message)
            except Exception as e:
                print(f"[MQTTManager] 消息回调处理错误: {e}")

    def _process_ota_register(self, topic, message):
        """处理设备主动注册 / 类型上报（phonebox/ota/register 或 phonebox/ota/{device_id}/register）"""
        try:
            data = json.loads(message)
            # 优先取 payload 中的 device_id；否则从 topic 解析（phonebox/ota/{device_id}）
            device_id = data.get("device_id")
            if not device_id and topic != "phonebox/ota/register":
                parts = topic.split("/")
                if len(parts) >= 3:
                    device_id = parts[2]
            if not device_id:
                return

            device_type = data.get("device_type")
            fw_version = data.get("fw_version")
            platform = data.get("platform")

            from app import app
            from models import db, Device

            with app.app_context():
                device = Device.query.filter_by(device_id=device_id).first()
                if not device:
                    device = Device(device_id=device_id, name=f"设备 {device_id}", status="online")
                    db.session.add(device)
                device.status = "online"
                device.last_heartbeat = datetime.now()
                if fw_version:
                    device.fw_version = fw_version
                if platform:
                    device.platform = platform
                if device_type:
                    device.device_type = device_type
                db.session.commit()
                print(f"[OTA] 设备注册/类型上报: {device_id} type={device_type} fw={fw_version}")
                # 版本协商 + 可能自动推送（无缝 OTA 闭环）
                try:
                    from services.ota_negotiation_service import try_auto_negotiate
                    try_auto_negotiate(device)
                except Exception as neg_e:
                    print(f"[OTA] 协商跳过（异常）: {neg_e}")
        except Exception as e:
            print(f"[OTA] 处理设备注册失败: {e}")

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

            print(f"[OTA] 设备 {device_id} OTA状态更新: status={status}, progress={progress}%")

            from app import app
            from models import db, Device, DeviceFirmwareUpdate, OperationLog

            with app.app_context():
                device = Device.query.filter_by(device_id=device_id).first()
                device_ota_status = None

                if status == "started":
                    record = DeviceFirmwareUpdate(
                        device_id=device_id,
                        from_version=from_version,
                        to_version=to_version,
                        status="in_progress",
                        started_at=datetime.now(),
                    )
                    db.session.add(record)
                    db.session.commit()
                    print(f"[OTA] 设备 {device_id} 开始升级: {from_version} -> {to_version}")
                    if device:
                        device_ota_status = "upgrading"

                elif status == "downloading" or status == "updating":
                    record = (
                        DeviceFirmwareUpdate.query.filter_by(
                            device_id=device_id, to_version=to_version, status="in_progress"
                        )
                        .order_by(DeviceFirmwareUpdate.started_at.desc())
                        .first()
                    )

                    if record:
                        print(f"[OTA] 设备 {device_id} 升级进度: {progress}%")
                    if device:
                        device_ota_status = "upgrading"
                    else:
                        record = DeviceFirmwareUpdate(
                            device_id=device_id,
                            from_version=from_version,
                            to_version=to_version,
                            status="in_progress",
                            started_at=datetime.now(),
                        )
                        db.session.add(record)
                        db.session.commit()

                elif status == "success" or status == "completed":
                    record = (
                        DeviceFirmwareUpdate.query.filter_by(
                            device_id=device_id, to_version=to_version, status="in_progress"
                        )
                        .order_by(DeviceFirmwareUpdate.started_at.desc())
                        .first()
                    )

                    if record:
                        record.status = "completed"
                        record.completed_at = datetime.now()
                        db.session.commit()
                        print(f"[OTA] 设备 {device_id} 升级成功: {from_version} -> {to_version}")
                    if device:
                        device_ota_status = "idle"
                        if to_version:
                            device.fw_version = to_version
                        device.last_ota_push_at = None

                    log = OperationLog(
                        operation_type="firmware_upgrade_success",
                        target_type="device",
                        target_id=device_id,
                        operator="OTA System",
                        description=f"设备 {device_id} 固件升级成功: {from_version} -> {to_version}",
                    )
                    db.session.add(log)
                    db.session.commit()

                elif status == "failed" or status == "error":
                    record = (
                        DeviceFirmwareUpdate.query.filter_by(
                            device_id=device_id, to_version=to_version, status="in_progress"
                        )
                        .order_by(DeviceFirmwareUpdate.started_at.desc())
                        .first()
                    )

                    if record:
                        record.status = "failed"
                        record.completed_at = datetime.now()
                        record.error_message = error_message
                        db.session.commit()
                        print(f"[OTA] 设备 {device_id} 升级失败: {error_message}")
                    if device:
                        device_ota_status = "failed"

                    log = OperationLog(
                        operation_type="firmware_upgrade_failed",
                        target_type="device",
                        target_id=device_id,
                        operator="OTA System",
                        description=f"设备 {device_id} 固件升级失败: {from_version} -> {to_version}, 错误: {error_message}",
                    )
                    db.session.add(log)
                    db.session.commit()

                # 回写设备 OTA 状态（无缝闭环自愈：升级成功/失败/进行中）
                if device is not None and device_ota_status is not None:
                    device.ota_status = device_ota_status
                    db.session.commit()

        except Exception as e:
            print(f"[OTA] 处理OTA状态消息失败: {e}")

    def _process_heartbeat(self, topic, message):
        """处理心跳消息，更新设备状态"""
        try:
            data = json.loads(message)
            device_id = data.get("device_id")

            if device_id:
                from app import app
                from models import Device, DeviceHeartbeat, db

                with app.app_context():
                    # 检查Device表中是否存在该设备，不存在则自动创建
                    device = Device.query.filter_by(device_id=device_id).first()
                    if not device:
                        # 自动注册新设备
                        device = Device(device_id=device_id, name=f"设备 {device_id}", status="online")
                        db.session.add(device)
                        print(f"[设备注册] 新设备自动注册: {device_id}")

                    # 更新设备状态
                    device.status = "online"
                    device.last_heartbeat = datetime.now()
                    device.wifi_signal = data.get("wifi_signal")
                    device.uptime = data.get("uptime")
                    device.box_a_status = data.get("box_a_status")
                    device.box_b_status = data.get("box_b_status")
                    device.system_state = data.get("system_state")
                    device.fw_version = data.get("fw_version")
                    device.platform = data.get("platform")
                    if data.get("device_type") is not None:
                        device.device_type = data.get("device_type")
                    device.free_heap = data.get("free_heap")
                    device.updated_at = datetime.now()

                    # 更新或创建心跳记录
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
                    db.session.commit()
                    print(f"设备心跳更新成功: {device_id}")
                    # 版本协商 + 可能自动推送（无缝 OTA 闭环）
                    try:
                        from services.ota_negotiation_service import try_auto_negotiate
                        try_auto_negotiate(device)
                    except Exception as neg_e:
                        print(f"[OTA] 协商跳过（异常）: {neg_e}")

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
                            "last_heartbeat": device.last_heartbeat.isoformat() if device.last_heartbeat else None,
                        }
                        send_device_status(device_id, device_data)
                        print(f"设备状态已通过WebSocket发送: {device_id}")
                    except Exception as ws_e:
                        print(f"发送WebSocket消息失败: {ws_e}")
        except Exception as e:
            print(f"处理心跳消息错误: {e}")

    def _on_error(self, client, userdata, error):
        print(f"[MQTTManager] 客户端错误: {error}")
        with self._state_lock:
            self._state = MQTTConnectionState.ERROR

    def _schedule_reconnect(self, client_type="control"):
        if client_type == "telemetry":
            if self._telemetry_reconnect_thread and self._telemetry_reconnect_thread.is_alive():
                return
        elif self._reconnect_thread and self._reconnect_thread.is_alive():
            return

        self._reconnect_delay = min(self._reconnect_delay * 2, self._max_reconnect_delay)

        def delayed_reconnect():
            time.sleep(self._reconnect_delay)
            if not self._should_reconnect:
                return
            if client_type == "telemetry":
                if self._telemetry_state != MQTTConnectionState.CONNECTED:
                    print("[MQTTManager] 执行遥测连接延迟重连...")
                    self._connect_telemetry()
            else:
                if self._state != MQTTConnectionState.CONNECTED:
                    print("[MQTTManager] 执行控制连接延迟重连...")
                    self._connect_control()

        t = threading.Thread(target=delayed_reconnect, daemon=True)
        t.start()
        if client_type == "telemetry":
            self._telemetry_reconnect_thread = t
        else:
            self._reconnect_thread = t

    def _create_and_connect_client(self, suffix, subscriptions, on_connect, on_message, on_disconnect):
        """创建 paho 客户端、配置回调、异步连接并等待确认。返回 client（已 loop_start）。"""
        cfg = self._get_config()
        broker = cfg.get("broker", self.DEFAULT_CONFIG["broker"])
        port = cfg.get("port", self.DEFAULT_CONFIG["port"])
        client_id = cfg.get("client_id", self.DEFAULT_CONFIG["client_id"])
        username = cfg.get("username", self.DEFAULT_CONFIG["username"])
        password = cfg.get("password", self.DEFAULT_CONFIG["password"])
        ssl_enabled = cfg.get("ssl", self.DEFAULT_CONFIG["ssl"])
        keepalive = cfg.get("keepalive", self.DEFAULT_CONFIG["keepalive"])
        transport = cfg.get("transport", self.DEFAULT_CONFIG.get("transport", "tcp"))

        cid = f"{client_id}_{suffix}_{int(time.time())}"
        if transport == "websockets":
            client = mqtt.Client(client_id=cid, clean_session=True, transport="websockets")
            client.ws_set_options(path=cfg.get("ws_path", "/mqtt"))
        else:
            client = mqtt.Client(client_id=cid, clean_session=True)
        client.username_pw_set(username, password)
        if ssl_enabled:
            client.tls_set(
                ca_certs=None,
                certfile=None,
                keyfile=None,
                cert_reqs=ssl.CERT_NONE,
                tls_version=ssl.PROTOCOL_TLS,
                ciphers=None,
            )
            client.tls_insecure_set(True)
        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message
        client.on_error = self._on_error
        client.reconnect_delay_set(min_delay=1, max_delay=30)

        print(f"[MQTTManager] 创建客户端({suffix}): {cid}, transport={transport}")
        try:
            client.loop_start()
            client.connect_async(broker, port, keepalive=keepalive)
        except Exception as e:
            print(f"[MQTTManager] 客户端({suffix})连接异常: {type(e).__name__}: {e}")
            import traceback

            traceback.print_exc()
            return None

        timeout = cfg.get("timeout", 15)
        for i in range(timeout * 10):
            time.sleep(0.1)
            if i % 10 == 0:
                print(f"[MQTTManager] 客户端({suffix})等待连接... {i // 10}秒")
            st = self._telemetry_state if suffix == "telemetry" else self._state
            if st == MQTTConnectionState.CONNECTED:
                print(f"[MQTTManager] 客户端({suffix})已连接!")
                return client
        print(f"[MQTTManager] 客户端({suffix})连接确认超时({timeout}秒)")
        return client

    def _connect_control(self):
        with self._state_lock:
            if self._state == MQTTConnectionState.CONNECTED:
                return True
            self._state = MQTTConnectionState.CONNECTING
        self._client = self._create_and_connect_client(
            "control",
            self.CONTROL_SUBSCRIPTIONS,
            self._on_connect_control,
            self._on_message_control,
            self._on_disconnect_control,
        )
        return self.is_connected

    def _connect_telemetry(self):
        with self._state_lock:
            if self._telemetry_state == MQTTConnectionState.CONNECTED:
                return True
            self._telemetry_state = MQTTConnectionState.CONNECTING
        self._telemetry_client = self._create_and_connect_client(
            "telemetry",
            self.TELEMETRY_SUBSCRIPTIONS,
            self._on_connect_telemetry,
            self._on_message_telemetry,
            self._on_disconnect_telemetry,
        )
        return self._telemetry_state == MQTTConnectionState.CONNECTED

    def connect(self, config=None):
        if self.is_connected and self._telemetry_state == MQTTConnectionState.CONNECTED:
            print("[MQTTManager] 双连接均已连接")
            return True
        if config:
            self._config = config
        # 控制连接（主）：score/# + phonebox 控制类 topic
        self._connect_control()
        # 遥测连接：phonebox/# 高频（QoS0，可容忍丢包）
        self._connect_telemetry()
        return self.is_connected

    def disconnect(self):
        print("[MQTTManager] 断开连接请求")
        self._should_reconnect = False

        with self._state_lock:
            self._state = MQTTConnectionState.DISCONNECTED
            self._telemetry_state = MQTTConnectionState.DISCONNECTED
            self._subscribed_topics = []
            self._telemetry_subscribed_topics = []

        for c in (self._client, self._telemetry_client):
            if c:
                try:
                    c.disconnect()
                    c.loop_stop()
                except Exception as e:
                    print(f"[MQTTManager] 断开连接时出错: {e}")
        self._client = None
        self._telemetry_client = None

    def publish(self, topic, payload, qos=1):
        if not self.is_connected or not self._client:
            print("[MQTTManager] 发布失败: 未连接", flush=True)
            return False

        try:
            if isinstance(payload, dict):
                payload = json.dumps(payload)

            print(
                f"[MQTTManager] 准备发布消息 - topic: {topic}, payload_length: {len(payload) if payload else 0}, qos: {qos}",
                flush=True,
            )  # noqa: E501
            result = self._client.publish(topic, payload, qos=qos)

            # 检查发布结果
            if result.rc == 0:
                print(f"[MQTTManager] 发布成功: {topic}", flush=True)
                return True
            else:
                error_messages = {1: "协议错误", 2: "无效主题", 3: "消息太大", 4: "权限不足", 5: "服务器不可用"}
                print(
                    f"[MQTTManager] 发布失败, rc={result.rc}: {error_messages.get(result.rc, '未知错误')}", flush=True
                )
                return False
        except Exception as e:
            print(f"[MQTTManager] 发布异常: {type(e).__name__}: {e}", flush=True)
            import traceback

            traceback.print_exc()
            return False

    def subscribe(self, topic, qos=1):
        if not self.is_connected or not self._client:
            print("[MQTTManager] 订阅失败: 未连接")
            return False

        try:
            self._client.subscribe(topic, qos=qos)
            if topic not in self._subscribed_topics:
                self._subscribed_topics.append(topic)
            print(f"[MQTTManager] 订阅主题: {topic}")
            return True
        except Exception as e:
            print(f"[MQTTManager] 订阅异常: {e}")
            return False

    def unsubscribe(self, topic):
        if not self.is_connected or not self._client:
            return False

        try:
            self._client.unsubscribe(topic)
            if topic in self._subscribed_topics:
                self._subscribed_topics.remove(topic)
            print(f"[MQTTManager] 取消订阅: {topic}")
            return True
        except Exception as e:
            print(f"[MQTTManager] 取消订阅异常: {e}")
            return False

    def add_message_callback(self, callback):
        if callback not in self._message_callbacks:
            self._message_callbacks.append(callback)

    def set_app(self, app):
        self._app = app

    def remove_message_callback(self, callback):
        if callback in self._message_callbacks:
            self._message_callbacks.remove(callback)

    def get_status(self):
        return {
            "connected": self.is_connected,
            "state": self.state.value,
            "telemetry_connected": self._telemetry_state == MQTTConnectionState.CONNECTED,
            "telemetry_state": self._telemetry_state.value,
            "subscribed_topics": self.subscribed_topics,
            "telemetry_subscribed_topics": self._telemetry_subscribed_topics,
            "config": {
                "broker": self._get_config().get("broker"),
                "port": self._get_config().get("port"),
                "ssl": self._get_config().get("ssl"),
            },
        }

    def get_cached_user(self, card_id):
        """获取缓存的用户信息"""
        with self._cache_lock:
            if card_id in self._user_cache:
                cached = self._user_cache[card_id]
                if time.time() - cached["timestamp"] < self._cache_ttl:
                    return cached["user"]
                else:
                    del self._user_cache[card_id]
        return None

    def set_cached_user(self, card_id, user):
        """缓存用户信息"""
        with self._cache_lock:
            self._user_cache[card_id] = {"user": user, "timestamp": time.time()}

    def clear_cache(self):
        """清除所有缓存"""
        with self._cache_lock:
            self._user_cache.clear()

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

        if device_id:
            topic = f"phonebox/ota/{device_id}"
        else:
            topic = "phonebox/ota"

        ota_payload = {"action": "update", "timestamp": int(time.time())}
        ota_payload.update(payload)

        print(f"[OTA] 发送OTA指令到 {topic}: {json.dumps(ota_payload)}")
        return self.publish(topic, json.dumps(ota_payload), qos=1)


mqtt_manager = MQTTManager()
