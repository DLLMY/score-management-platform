import time
import json
import threading
import traceback
from enum import Enum
from collections import deque

from .mqtt_interface import IMQTTClient


import ssl
import paho.mqtt.client as mqtt


class MQTTConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class MQTTClient(IMQTTClient):

    def __init__(self):
        self._client = None
        self._state = MQTTConnectionState.DISCONNECTED
        self._state_lock = threading.Lock()
        self._config = None
        self._subscribed_topics = []
        self._message_callbacks = []
        self._reconnect_thread = None
        self._reconnect_delay = 5
        self._max_reconnect_delay = 60
        self._should_reconnect = True
        self._connection_result = None
        self._app = None

        self._message_queue = deque(maxlen=1000)
        self._queue_processing = False
        self._queue_lock = threading.Lock()
        self._flush_interval = 1.0
        self._last_flush_time = time.time()

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

        self.DEFAULT_SUBSCRIPTIONS = [
            ("phonebox/status", 1),
            ("phonebox/log", 1),
            ("phonebox/query", 1),
            ("phonebox/heartbeat", 1),
            ("phonebox/unlock/+", 1),
            ("phonebox/ota/status", 1),
            ("phonebox/ota/+/status", 1),
            ("score/add", 1),
            ("score/undo", 1),
            ("score/rules/query", 1),
        ]

    def set_app(self, app):
        self._app = app

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
                    print(f"[MQTTClient] 配置已从数据库加载: broker={config.broker}, port={config.port}")
                    return True
        except Exception as e:
            print(f"[MQTTClient] 从数据库加载配置失败: {e}")

        self._config = self.DEFAULT_CONFIG.copy()
        print("[MQTTClient] 使用默认配置")
        return False

    def _get_config(self):
        if self._config is None:
            self.load_config_from_db()
        return self._config or self.DEFAULT_CONFIG

    def _on_connect(self, client, userdata, flags, rc):
        print(f"[MQTTClient] _on_connect 被调用, rc={rc}, flags={flags}")
        with self._state_lock:
            if rc == 0:
                self._state = MQTTConnectionState.CONNECTED
                self._reconnect_delay = 5
                self._should_reconnect = True
                print("[MQTTClient] 连接成功!")
            else:
                self._state = MQTTConnectionState.ERROR
                error_messages = {
                    1: "协议版本错误",
                    2: "客户端标识符无效",
                    3: "服务器不可用",
                    4: "用户名或密码错误",
                    5: "未授权",
                }
                print((f"[MQTTClient] 连接失败, rc={rc}: " f"{error_messages.get(rc, '未知错误')}"))

        if self.is_connected:
            for topic, qos in self.DEFAULT_SUBSCRIPTIONS:
                client.subscribe(topic, qos=qos)
                self._subscribed_topics.append(topic)
            print(f"[MQTTClient] 已订阅主题: {[t[0] for t in self.DEFAULT_SUBSCRIPTIONS]}")

    def _on_disconnect(self, client, userdata, rc):
        with self._state_lock:
            self._state = MQTTConnectionState.DISCONNECTED
            self._subscribed_topics = []

        print(f"[MQTTClient] 断开连接, rc={rc}")

        if rc != 0 and self._should_reconnect:
            print(f"[MQTTClient] 意外断开，将在 {self._reconnect_delay} 秒后尝试重新连接...")
            self._schedule_reconnect()

    def _on_message(self, client, userdata, msg):
        try:
            message = msg.payload.decode()
            topic = msg.topic

            self._queue_message(topic, message)

            if topic == "phonebox/query" or topic.startswith("phonebox/unlock/") or topic.startswith("phonebox/ota/"):
                if self._app:
                    with self._app.app_context():
                        self._process_critical_message(topic, message)
                else:
                    self._process_critical_message(topic, message)

        except Exception as e:
            print(f"[MQTTClient] 处理消息失败: {e}")

            traceback.print_exc()

    def _on_error(self, client, userdata, error):
        print(f"[MQTTClient] 客户端错误: {error}")
        with self._state_lock:
            self._state = MQTTConnectionState.ERROR

    def _schedule_reconnect(self):
        if self._reconnect_thread and self._reconnect_thread.is_alive():
            return

        self._reconnect_delay = min(self._reconnect_delay * 2, self._max_reconnect_delay)

        def delayed_reconnect():
            time.sleep(self._reconnect_delay)
            if self._should_reconnect and not self.is_connected:
                print("[MQTTClient] 执行延迟重连...")
                self.connect()

        self._reconnect_thread = threading.Thread(target=delayed_reconnect, daemon=True)
        self._reconnect_thread.start()

    def connect(self, config=None):
        with self._state_lock:
            if self._state == MQTTConnectionState.CONNECTING:
                print("[MQTTClient] 连接正在进行中...")
                return False
            if self._state == MQTTConnectionState.CONNECTED:
                print("[MQTTClient] 已经连接")
                return True

            self._state = MQTTConnectionState.CONNECTING

        if config:
            self._config = config

        cfg = self._get_config()

        try:
            if self._client:
                try:
                    self._client.loop_stop()
                except Exception:
                    pass
                self._client = None

            broker = cfg.get("broker", self.DEFAULT_CONFIG["broker"])
            port = cfg.get("port", self.DEFAULT_CONFIG["port"])
            client_id = cfg.get("client_id", self.DEFAULT_CONFIG["client_id"])
            username = cfg.get("username", self.DEFAULT_CONFIG["username"])
            password = cfg.get("password", self.DEFAULT_CONFIG["password"])
            ssl_enabled = cfg.get("ssl", self.DEFAULT_CONFIG["ssl"])
            keepalive = cfg.get("keepalive", self.DEFAULT_CONFIG["keepalive"])
            transport = cfg.get("transport", self.DEFAULT_CONFIG.get("transport", "tcp"))

            client_id = f"{client_id}_{int(time.time())}"

            print(f"[MQTTClient] 创建客户端: {client_id}, transport={transport}")

            if transport == "websockets":
                self._client = mqtt.Client(
                    client_id=client_id,
                    clean_session=True,
                    transport="websockets",
                )
                ws_path = cfg.get("ws_path", "/mqtt")
                self._client.ws_set_options(path=ws_path)
                print(f"[MQTTClient] WebSocket路径: {ws_path}")
            else:
                self._client = mqtt.Client(client_id=client_id, clean_session=True)

            self._client.username_pw_set(username, password)

            if ssl_enabled:
                print("[MQTTClient] 配置TLS...")
                self._client.tls_set(
                    ca_certs=None,
                    certfile=None,
                    keyfile=None,
                    cert_reqs=ssl.CERT_NONE,
                    tls_version=ssl.PROTOCOL_TLS,
                    ciphers=None,
                )
                self._client.tls_insecure_set(True)
                print("[MQTTClient] TLS配置完成")

            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message
            self._client.on_error = self._on_error
            self._client.reconnect_delay_set(min_delay=1, max_delay=30)

            print(f"[MQTTClient] 连接到 {broker}:{port}...")
            print(f"[MQTTClient] ssl={ssl_enabled}, keepalive={keepalive}")

            try:
                self._client.loop_start()
                print("[MQTTClient] loop_start() 调用成功")
            except Exception as e:
                print(f"[MQTTClient] loop_start() 调用失败: {type(e).__name__}: {e}")
                with self._state_lock:
                    self._state = MQTTConnectionState.ERROR
                return False

            print("[MQTTClient] 准备调用 connect_async()...")
            try:
                self._client.connect_async(broker, port, keepalive=keepalive)
                print("[MQTTClient] connect_async() 调用成功")
            except Exception as e:
                print(f"[MQTTClient] connect_async() 调用失败: {type(e).__name__}: {e}")

                traceback.print_exc()
                with self._state_lock:
                    self._state = MQTTConnectionState.ERROR
                return False

            timeout = cfg.get("timeout", 15)
            print(f"[MQTTClient] 等待连接确认... (超时时间={timeout}秒)")
            for i in range(timeout * 10):
                time.sleep(0.1)
                if i % 10 == 0:
                    state_value = self._state.value if self._state else "None"
                    print((f"[MQTTClient] 等待连接... {i//10}秒, " f"当前状态: {state_value}"))
                if self.is_connected:
                    print("[MQTTClient] 检测到已连接!")
                    return True

            print(f"[MQTTClient] 连接确认超时({timeout}秒)")
            with self._state_lock:
                self._state = MQTTConnectionState.ERROR
            return False

        except Exception as e:
            print(f"[MQTTClient] 连接异常: {type(e).__name__}: {e}")

            traceback.print_exc()
            with self._state_lock:
                self._state = MQTTConnectionState.ERROR
            return False

    def disconnect(self):
        print("[MQTTClient] 断开连接请求")
        self._should_reconnect = False

        with self._state_lock:
            self._state = MQTTConnectionState.DISCONNECTED
            self._subscribed_topics = []

        if self._client:
            try:
                self._client.disconnect()
                self._client.loop_stop()
            except Exception as e:
                print(f"[MQTTClient] 断开连接时出错: {e}")
            self._client = None

    def publish(self, topic, payload, qos=1):
        if not self.is_connected or not self._client:
            print("[MQTTClient] 发布失败: 未连接", flush=True)
            return False

        try:
            if isinstance(payload, dict):
                payload = json.dumps(payload)

            payload_length = len(payload) if payload else 0
            print(
                (f"[MQTTClient] 准备发布消息 - topic: {topic}, " f"payload_length: {payload_length}, qos: {qos}"),
                flush=True,
            )
            result = self._client.publish(topic, payload, qos=qos)  # noqa: F841

            if result.rc == 0:
                print(f"[MQTTClient] 发布成功: {topic}", flush=True)
                return True
            else:
                error_messages = {
                    1: "协议错误",
                    2: "无效主题",
                    3: "消息太大",
                    4: "权限不足",
                    5: "服务器不可用",
                }
                print(
                    (f"[MQTTClient] 发布失败, rc={result.rc}: " f"{error_messages.get(result.rc, '未知错误')}"),
                    flush=True,
                )
                return False
        except Exception as e:
            print(f"[MQTTClient] 发布异常: {type(e).__name__}: {e}", flush=True)

            traceback.print_exc()
            return False

    def subscribe(self, topic, qos=1):
        if not self.is_connected or not self._client:
            print("[MQTTClient] 订阅失败: 未连接")
            return False

        try:
            self._client.subscribe(topic, qos=qos)
            if topic not in self._subscribed_topics:
                self._subscribed_topics.append(topic)
            print(f"[MQTTClient] 订阅主题: {topic}")
            return True
        except Exception as e:
            print(f"[MQTTClient] 订阅异常: {e}")
            return False

    def unsubscribe(self, topic):
        if not self.is_connected or not self._client:
            return False

        try:
            self._client.unsubscribe(topic)
            if topic in self._subscribed_topics:
                self._subscribed_topics.remove(topic)
            print(f"[MQTTClient] 取消订阅: {topic}")
            return True
        except Exception as e:
            print(f"[MQTTClient] 取消订阅异常: {e}")
            return False

    def add_message_callback(self, callback):
        if callback not in self._message_callbacks:
            self._message_callbacks.append(callback)

    def remove_message_callback(self, callback):
        if callback in self._message_callbacks:
            self._message_callbacks.remove(callback)

    def _queue_message(self, topic, message):
        with self._queue_lock:
            self._message_queue.append({"topic": topic, "message": message, "timestamp": time.time()})

        current_time = time.time()
        if current_time - self._last_flush_time >= self._flush_interval or len(self._message_queue) >= 50:
            self._flush_messages()

    def _flush_messages(self):
        if self._queue_processing:
            return

        self._queue_processing = True
        try:
            messages = []
            with self._queue_lock:
                while self._message_queue:
                    messages.append(self._message_queue.popleft())

            if messages:
                if self._app:
                    with self._app.app_context():
                        self._process_messages_batch(messages)
                else:
                    self._process_messages_batch(messages)
                self._last_flush_time = time.time()
        finally:
            self._queue_processing = False

    def _process_messages_batch(self, messages):
        raise NotImplementedError("子类必须实现此方法")

    def _process_critical_message(self, topic, message):
        raise NotImplementedError("子类必须实现此方法")

    def get_status(self):
        return {
            "connected": self.is_connected,
            "state": self.state.value,
            "subscribed_topics": self.subscribed_topics,
            "config": {
                "broker": self._get_config().get("broker"),
                "port": self._get_config().get("port"),
                "ssl": self._get_config().get("ssl"),
            },
        }
