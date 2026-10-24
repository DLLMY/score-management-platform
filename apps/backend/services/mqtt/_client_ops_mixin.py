import json
import logging
import time

from services.mqtt._shared import MQTTConnectionState, record_mqtt_message

logger = logging.getLogger(__name__)

class _ClientOpsMixin:

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
                record_mqtt_message("published", "control")
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
