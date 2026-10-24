import logging
import os
import ssl
import time

import paho.mqtt.client as mqtt
from paho.mqtt.client import SubscribeOptions

from services.mqtt._shared import MQTTConnectionState, set_mqtt_connection

logger = logging.getLogger(__name__)

class _ConnectionMixin:

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
                set_mqtt_connection("control", True)
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
                # 关键修复：控制连接订阅启用 no_local。否则后端会收到自己发布的下行结果
                # （phonebox/unlock/A、/B、phonebox/ota/* 等），被当作上行请求再次派发，
                # 形成自循环——典型为 card_not_found 结果无 card_id → 再次下发 card_not_found
                # → 死循环，向设备灌入大量重复报文。no_local 由 MQTT 服务端阻断本端回环。
                client.subscribe(
                    topic, qos=qos, options=SubscribeOptions(qos=qos, noLocal=True)
                )
                self._subscribed_topics.append(topic)
            logger.info(
                f"[MQTTManager] 控制连接已订阅: {[t[0] for t in self.CONTROL_SUBSCRIPTIONS]}"
            )

    def _on_connect_telemetry(self, client, userdata, flags, rc):
        logger.info(f"[MQTTManager] 遥测连接 _on_connect, rc={rc}, flags={flags}")
        with self._state_lock:
            if rc == 0:
                self._telemetry_state = MQTTConnectionState.CONNECTED
                set_mqtt_connection("telemetry", True)
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
        set_mqtt_connection("control", False)
        logger.info(f"[MQTTManager] 控制连接断开, rc={rc}")
        if rc != 0 and self._should_reconnect:
            logger.warning("[MQTTManager] 控制连接意外断开，准备重连...")
            self._schedule_reconnect("control")

    def _on_disconnect_telemetry(self, client, userdata, rc):
        with self._state_lock:
            self._telemetry_state = MQTTConnectionState.DISCONNECTED
            self._telemetry_subscribed_topics = []
        set_mqtt_connection("telemetry", False)
        logger.info(f"[MQTTManager] 遥测连接断开, rc={rc}")
        if rc != 0 and self._should_reconnect:
            logger.warning("[MQTTManager] 遥测连接意外断开，准备重连...")
            self._schedule_reconnect("telemetry")

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

    @staticmethod
    def _dispose_client(client):
        """R9 连接泄漏修复：回收旧 paho 客户端。

        此前重连路径（_schedule_reconnect -> _connect_control/_connect_telemetry）直接
        覆盖 self._client / self._telemetry_client，旧客户端从不 disconnect/loop_stop：
        1) 旧客户端 paho 自带 auto-reconnect（reconnect_delay_set 1-30s）会自行重连，
           且 client_id 每次创建都带时间戳 -> broker 视为全新会话，永不替换旧会话；
        2) 每次网络抖动净增 1 条连接/类型，旧连接永久堆积在 broker 上
           （EMQX Cloud 连接数 954/1000 的根因）。
        显式 disconnect + loop_stop 阻断旧客户端的自动重连循环，连接数收敛。
        """
        if not client:
            return
        try:
            client.disconnect()
        except Exception:
            pass
        try:
            client.loop_stop()
        except Exception:
            pass

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

        # R9 连接泄漏修复：client_id 改为「进程内稳定」（原为每次连接都带 int(time.time())，
        # 同一进程每次重连产生不同 client_id，broker 侧无法做会话替换，旧会话永久残留）。
        # 稳定 id + clean_session=True：同进程重连时 broker 自动踢掉同 id 旧会话（自愈兜底）；
        # 跨进程（Werkzeug reloader 父子进程 / 多实例）因 pid 不同互不干扰。
        cid = f"{client_id}_{suffix}_{os.getpid()}"
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
        # R9 连接泄漏修复：重连前先回收旧客户端，阻断其 auto-reconnect 堆积连接
        self._dispose_client(self._client)
        self._client = None
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
        # R9 连接泄漏修复：重连前先回收旧客户端（含 service_init 遥测重试路径）
        self._dispose_client(self._telemetry_client)
        self._telemetry_client = None
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
