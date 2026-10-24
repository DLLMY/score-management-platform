import logging

from services.mqtt._base_mixin import _BaseMixin
from services.mqtt._client_ops_mixin import _ClientOpsMixin
from services.mqtt._connection_mixin import _ConnectionMixin
from services.mqtt._heartbeat_mixin import _HeartbeatMixin
from services.mqtt._message_mixin import _MessageMixin
from services.mqtt._ota_mixin import _OtaMixin
from services.mqtt._shared import (
    MQTTConnectionState,
    record_mqtt_message,
    record_ota_update,
    set_mqtt_connection,
)

logger = logging.getLogger(__name__)


class MQTTManager(
    _BaseMixin,
    _ConnectionMixin,
    _MessageMixin,
    _OtaMixin,
    _HeartbeatMixin,
    _ClientOpsMixin,
):
    """MQTT 连接管理器（控制 + 遥测双连接分流）。

    原单体类（约 1247 行）按领域拆分为 services/mqtt/ 下的 mixin 子模块
    （基础 / 连接 / 消息 / OTA / 心跳 / 客户端操作），本类仅作多继承组合，
    行为与拆分前完全一致。

    消费者 `from services.mqtt_manager import MQTTManager, mqtt_manager,
    MQTTConnectionState` 的导入面保持不变。
    """


mqtt_manager = MQTTManager()
