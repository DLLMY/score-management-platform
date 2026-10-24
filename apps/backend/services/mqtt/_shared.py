import logging
from enum import Enum

logger = logging.getLogger(__name__)


class MQTTConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


def record_mqtt_message(direction, link):
    from app.metrics_exporter import record_mqtt_message as _metrics_impl
    _metrics_impl(direction, link)


def record_ota_update(device_type, status):
    from app.metrics_exporter import record_ota_update as _metrics_impl
    _metrics_impl(device_type, status)


def set_mqtt_connection(link, connected):
    from app.metrics_exporter import set_mqtt_connection as _metrics_impl
    _metrics_impl(link, connected)
