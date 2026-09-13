import logging
import paho.mqtt.client as mqtt
import json
import threading
import time
import ssl
from datetime import datetime
from enum import Enum
from collections import deque

logger = logging.getLogger(__name__)


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
        # R2: 最近一次「已知好」配置（成功加载或成功连接时使用）。
        # 当数据库配置读取失败 / 重连时配置源异常，可回退到此，避免 MQTT 配置彻底丢失。
        self._last_known_good = None
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
            "username": "",
            "password": "",
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
        # 注意 EMQX 对单客户端订阅数有上限(~10)，新增订阅前先确认总数。
        self.CONTROL_SUBSCRIPTIONS = [
            ("score/#", 1),
            ("phonebox/query", 1),
            ("phonebox/unlock/#", 1),
            ("phonebox/ota/#", 1),
            ("phonebox/points/#", 1),
            # 差异 #5：重启回执（设备上报「已收到重启指令」）。这是新增订阅，用于解决
            # 重启指令此前无任何回执、下发成功与否不可观测的问题；覆盖
            # phonebox/control/restart/ack 与 phonebox/control/restart/ack/{device_id}。
            ("phonebox/control/restart/ack/#", 1),
        ]
        self.TELEMETRY_SUBSCRIPTIONS = [
            ("phonebox/#", 0),
        ]
        # 控制类 topic（遥测连接收到这些时跳过，交由控制连接处理，避免重复业务派发）
        self._CONTROL_TOPIC_EXACT = ("phonebox/query",)
        self._CONTROL_TOPIC_PREFIXES = (
            "score/",
            "phonebox/unlock/",
            "phonebox/ota/",
            "phonebox/points/",
            "phonebox/control/restart/ack/",
        )

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
                    # R2: 记录最近一次已知好配置，供重连 / DB 读取失败时回退
                    self._last_known_good = dict(self._config)
                    logger.info(
                        f"[MQTTManager] 配置已从数据库加载: broker={config.broker}, port={config.port}"
                    )
                    return True
        except Exception as e:
            logger.error(f"[MQTTManager] 从数据库加载配置失败: {e}")

        # DB 读取失败：若有最近一次已知好配置，则回退到它（避免 MQTT 配置彻底丢失）
        if self._last_known_good is not None:
            self._config = dict(self._last_known_good)
            logger.warning("[MQTTManager] 使用最近一次已知好配置（数据库读取失败回退）")
            return False

        self._config = self.DEFAULT_CONFIG.copy()
        logger.info("[MQTTManager] 使用默认配置")
        return False

    def _get_config(self):
        if self._config is None:
            self.load_config_from_db()
        return self._config or self.DEFAULT_CONFIG

    def _on_connect_control(self, client, userdata, flags, rc):
        logger.info(f"[MQTTManager] 控制连接 _on_connect, rc={rc}, flags={flags}")
        with self._state_lock:
            if rc == 0:
                self._state = MQTTConnectionState.CONNECTED
                self._reconnect_delay = 5
                self._should_reconnect = True
                # R2: 成功连上即视为「已知好」配置，记录以便后续回退
                if self._config:
                    self._last_known_good = dict(self._config)
                logger.info("[MQTTManager] 控制连接成功!")
            else:
                self._state = MQTTConnectionState.ERROR
                error_messages = {
                    1: "协议版本错误",
                    2: "客户端标识符无效",
                    3: "服务器不可用",
                    4: "用户名或密码错误",
                    5: "未授权",
                }
                logger.error(
                    f"[MQTTManager] 控制连接失败, rc={rc}: {error_messages.get(rc, '未知错误')}"
                )
        if self.is_connected:
            self._subscribed_topics = []
            for topic, qos in self.CONTROL_SUBSCRIPTIONS:
                client.subscribe(topic, qos=qos)
                self._subscribed_topics.append(topic)
            logger.info(
                f"[MQTTManager] 控制连接已订阅: {[t[0] for t in self.CONTROL_SUBSCRIPTIONS]}"
            )

    def _on_connect_telemetry(self, client, userdata, flags, rc):
        logger.info(f"[MQTTManager] 遥测连接 _on_connect, rc={rc}, flags={flags}")
        with self._state_lock:
            if rc == 0:
                self._telemetry_state = MQTTConnectionState.CONNECTED
                logger.info("[MQTTManager] 遥测连接成功!")
            else:
                self._telemetry_state = MQTTConnectionState.ERROR
                logger.error(f"[MQTTManager] 遥测连接失败, rc={rc}")
        if self._telemetry_state == MQTTConnectionState.CONNECTED:
            self._telemetry_subscribed_topics = []
            for topic, qos in self.TELEMETRY_SUBSCRIPTIONS:
                client.subscribe(topic, qos=qos)
                self._telemetry_subscribed_topics.append(topic)
            logger.info(
                f"[MQTTManager] 遥测连接已订阅: {[t[0] for t in self.TELEMETRY_SUBSCRIPTIONS]}"
            )

    def _on_disconnect_control(self, client, userdata, rc):
        with self._state_lock:
            self._state = MQTTConnectionState.DISCONNECTED
            self._subscribed_topics = []
        logger.info(f"[MQTTManager] 控制连接断开, rc={rc}")
        if rc != 0 and self._should_reconnect:
            logger.warning("[MQTTManager] 控制连接意外断开，准备重连...")
            self._schedule_reconnect("control")

    def _on_disconnect_telemetry(self, client, userdata, rc):
        with self._state_lock:
            self._telemetry_state = MQTTConnectionState.DISCONNECTED
            self._telemetry_subscribed_topics = []
        logger.info(f"[MQTTManager] 遥测连接断开, rc={rc}")
        if rc != 0 and self._should_reconnect:
            logger.warning("[MQTTManager] 遥测连接意外断开，准备重连...")
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
                or topic.startswith("phonebox/control/restart/ack/")
            ):
                self._process_critical_message(topic, message)
        except Exception as e:
            logger.error(f"[MQTTManager] 处理控制消息失败: {e}")

    def _on_message_telemetry(self, client, userdata, msg):
        try:
            message = msg.payload.decode()
            topic = msg.topic
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
            from models import db, MQTTLog

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
        from models import MQTTLog, Device, db

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
            from models import db, Device

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
            from models import db, Device

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
        """开始升级：落一条 in_progress 记录，设备在线时置为 upgrading。"""
        from models import DeviceFirmwareUpdate, db

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

        device_ota_status = None
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
        return device_ota_status

    def _process_heartbeat(self, topic, message):
        """处理心跳消息，更新设备状态"""
        try:
            data = json.loads(message)
            device_id = data.get("device_id")

            if device_id:
                from app import app
                from models import Device, DeviceHeartbeat, db

                # 差异 #3/#11：心跳统一写入 + 设备错误自动告警
                from services.heartbeat_service import apply_heartbeat_to_device, check_device_errors
                # 差异 #15：宽松 device_id 兜底校验
                from services.heartbeat_service import is_safe_device_id

                if not is_safe_device_id(device_id):
                    logger.warning(f"[心跳] device_id 非法，已忽略: {device_id!r}")
                    return

                with app.app_context():
                    # 检查Device表中是否存在该设备，不存在则自动创建
                    device = Device.query.filter_by(device_id=device_id).first()

                    # 差异 #4：白名单 + 签名准入（默认关闭/无密钥 ⇒ 放行，零行为变化）
                    if not self._passes_device_auth_gate(device, data, device_id, kind="心跳"):
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

    def _on_error(self, client, userdata, error):
        logger.error(f"[MQTTManager] 客户端错误: {error}")
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
                    logger.warning("[MQTTManager] 执行遥测连接延迟重连...")
                    self._connect_telemetry()
            else:
                if self._state != MQTTConnectionState.CONNECTED:
                    logger.warning("[MQTTManager] 执行控制连接延迟重连...")
                    self._connect_control()

        t = threading.Thread(target=delayed_reconnect, daemon=True)
        t.start()
        if client_type == "telemetry":
            self._telemetry_reconnect_thread = t
        else:
            self._reconnect_thread = t

    def _create_and_connect_client(
        self, suffix, subscriptions, on_connect, on_message, on_disconnect
    ):
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

        logger.info(f"[MQTTManager] 创建客户端({suffix}): {cid}, transport={transport}")
        try:
            client.loop_start()
            client.connect_async(broker, port, keepalive=keepalive)
        except Exception as e:
            logger.error(
                f"[MQTTManager] 客户端({suffix})连接异常: {type(e).__name__}: {e}",
                exc_info=True,
            )
            return None

        # M10: 连接确认等待上限收紧到 5s——connect_async + loop_start 已自带
        # paho 自动重连（reconnect_delay 1-30s），无需在调用线程同步等待太久；
        # 过长等待会拖慢 MQTT 就绪（tcp+ws 串行最坏曾达 15s+）。
        timeout = min(cfg.get("timeout", 15), 5)
        for i in range(timeout * 10):
            time.sleep(0.1)
            if i % 10 == 0:
                logger.info(f"[MQTTManager] 客户端({suffix})等待连接... {i // 10}秒")
            st = self._telemetry_state if suffix == "telemetry" else self._state
            if st == MQTTConnectionState.CONNECTED:
                logger.info(f"[MQTTManager] 客户端({suffix})已连接!")
                return client
        logger.error(f"[MQTTManager] 客户端({suffix})连接确认超时({timeout}秒)")
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
            logger.info("[MQTTManager] 双连接均已连接")
            return True
        if config:
            self._config = config
        # 控制连接（主）：score/# + phonebox 控制类 topic
        self._connect_control()
        # 遥测连接：phonebox/# 高频（QoS0，可容忍丢包）
        self._connect_telemetry()
        return self.is_connected

    def disconnect(self):
        logger.info("[MQTTManager] 断开连接请求")
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
                    logger.error(f"[MQTTManager] 断开连接时出错: {e}")
        self._client = None
        self._telemetry_client = None

    def publish(self, topic, payload, qos=1):
        if not self.is_connected or not self._client:
            logger.warning("[MQTTManager] 发布失败: 未连接")
            return False

        try:
            if isinstance(payload, dict):
                payload = json.dumps(payload)

            logger.info(
                f"[MQTTManager] 准备发布消息 - topic: {topic}, payload_length: {len(payload) if payload else 0}, qos: {qos}"
            )
            result = self._client.publish(topic, payload, qos=qos)

            # 检查发布结果
            if result.rc == 0:
                logger.info(f"[MQTTManager] 发布成功: {topic}")
                return True
            error_messages = {
                1: "协议错误",
                2: "无效主题",
                3: "消息太大",
                4: "权限不足",
                5: "服务器不可用",
            }
            logger.error(
                f"[MQTTManager] 发布失败, rc={result.rc}: {error_messages.get(result.rc, '未知错误')}"
            )
            return False
        except Exception as e:
            logger.error(
                f"[MQTTManager] 发布异常: {type(e).__name__}: {e}",
                exc_info=True,
            )
            return False

    def subscribe(self, topic, qos=1):
        if not self.is_connected or not self._client:
            logger.warning("[MQTTManager] 订阅失败: 未连接")
            return False

        try:
            self._client.subscribe(topic, qos=qos)
            if topic not in self._subscribed_topics:
                self._subscribed_topics.append(topic)
            logger.info(f"[MQTTManager] 订阅主题: {topic}")
            return True
        except Exception as e:
            logger.error(f"[MQTTManager] 订阅异常: {e}")
            return False

    def unsubscribe(self, topic):
        if not self.is_connected or not self._client:
            return False

        try:
            self._client.unsubscribe(topic)
            if topic in self._subscribed_topics:
                self._subscribed_topics.remove(topic)
            logger.info(f"[MQTTManager] 取消订阅: {topic}")
            return True
        except Exception as e:
            logger.error(f"[MQTTManager] 取消订阅异常: {e}")
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

        topic = f"phonebox/ota/{device_id}" if device_id else "phonebox/ota"

        ota_payload = {"action": "update", "timestamp": int(time.time())}
        ota_payload.update(payload)

        logger.info(f"[OTA] 发送OTA指令到 {topic}: {json.dumps(ota_payload)}")
        return self.publish(topic, json.dumps(ota_payload), qos=1)


mqtt_manager = MQTTManager()
