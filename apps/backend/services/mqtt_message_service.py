"""MQTT 消息处理服务（组合层；原单体 1158 行按领域拆分至 services/mqtt_message/ 包）。

拆分结构（零行为变更）：
- _shared.py：模块级助手 + topic 派发表 + 6 个被测试 patch 的共享符号（单一来源，
  各 mixin 以 _shared.X 属性级访问，patch("services.mqtt_message._shared.X") 穿透生效）
- _base/_limits/_unlock/_heartbeat/_points/_score_mixin.py：31 个方法按领域收容

本类仅作多继承组合，__module__ 不变；消费者
 from services.mqtt_message_service import MQTTMessageService / mqtt_message_service
 的导入面保持不变。
"""

from services.mqtt_message._base_mixin import _BaseMixin
from services.mqtt_message._heartbeat_mixin import _HeartbeatMixin
from services.mqtt_message._limits_mixin import _LimitsMixin
from services.mqtt_message._points_mixin import _PointsMixin
from services.mqtt_message._score_mixin import _ScoreMixin
from services.mqtt_message._unlock_mixin import _UnlockMixin

__all__ = ["MQTTMessageService", "mqtt_message_service"]


class MQTTMessageService(
    _BaseMixin,
    _LimitsMixin,
    _UnlockMixin,
    _HeartbeatMixin,
    _PointsMixin,
    _ScoreMixin,
):
    """MQTT 消息处理服务（开锁 / 积分 / 心跳 / 限额 / 派发全链路）。

    原单体类（1158 行，31 方法）按领域拆分为 services/mqtt_message/ 下的 mixin
    子模块，本类仅作多继承组合，行为与拆分前完全一致。
    """


mqtt_message_service = MQTTMessageService()
