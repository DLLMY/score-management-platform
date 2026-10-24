import logging
import threading
import time
from collections import deque

from services.mqtt._shared import MQTTConnectionState

logger = logging.getLogger(__name__)

class _BaseMixin:

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
            # 请假（硬件端）三 topic：req/cancel/query，控制连接即时派发
            ("phonebox/leave/#", 1),
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
            "phonebox/leave/",
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
            from app import app
            from models import MQTTConfig

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
