"""入口派发：__init__ + handle_mqtt_message（MQTT topic 派发总入口）。"""

import json
import logging

from services.mqtt_message import _shared
from services.mqtt_message._shared import _dispatch_mqtt_topic, ensure_app_context


class _BaseMixin:
    def __init__(self):
        pass

    @ensure_app_context
    def handle_mqtt_message(self, client, topic, message):
        _shared.mqtt_logs.append(
            {
                "topic": topic,
                "message": message,
                "direction": "receive",
                "timestamp": _shared.datetime.now().isoformat(),
            }
        )

        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            # 畸形负载静默丢弃会让设备业务请求无声消失——留痕
            import logging

            logging.getLogger(__name__).warning(
                f"MQTT消息JSON解析失败, topic={topic}, payload前120字={message[:120]}"
            )
            return

        _dispatch_mqtt_topic(self, topic, data)
