from .mqtt_client import MQTTClient
from .mqtt_message_processor import MQTTMessageProcessor
import threading
import traceback


class MQTTMessageClient(MQTTClient):

    def __init__(self):
        super().__init__()
        self._message_processor = MQTTMessageProcessor()
        self._processing_lock = threading.Lock()

    def set_app(self, app):
        super().set_app(app)
        self._message_processor.set_app(app)

    def _process_messages_batch(self, messages):
        try:
            self._message_processor.process_messages_batch(messages)
        except Exception as e:
            print(f"[MQTTMessageClient] 批量处理消息失败: {e}")

            traceback.print_exc()

    def _process_critical_message(self, topic, message):
        try:
            callbacks = []
            for callback in self._message_callbacks:
                callbacks.append(callback)

            self._message_processor.process_critical_message(topic, message, callbacks)
        except Exception as e:
            print(f"[MQTTMessageClient] 处理紧急消息失败: {e}")

            traceback.print_exc()

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            message = msg.payload.decode()

            self._queue_message(topic, message)

            if topic == "phonebox/query" or topic.startswith("phonebox/unlock/") or topic.startswith("phonebox/ota/"):
                if self._app:
                    with self._app.app_context():
                        self._process_critical_message(topic, message)
                else:
                    self._process_critical_message(topic, message)

        except Exception as e:
            print(f"[MQTTMessageClient] 处理消息失败: {e}")

            traceback.print_exc()
