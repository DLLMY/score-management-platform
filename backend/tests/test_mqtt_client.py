"""
MQTT Client Test Cases
"""
# 测试MQTT客户端的核心功能
"""
"""
from unittest.mock import patch, MagicMock
from services.mqtt.mqtt_client import MQTTClient, MQTTConnectionState


class TestMQTTClient:
    """测试MQTT客户端"""

    def test_init(self):
        """测试初始化"""
        client = MQTTClient()

        assert client._client is None
        assert client.state == MQTTConnectionState.DISCONNECTED
        assert client.is_connected is False
        assert client._subscribed_topics == []
        assert client._message_callbacks == []
        assert client._config is None

    def test_set_app(self):
        """测试设置应用"""
        client = MQTTClient()
        mock_app = MagicMock()

        client.set_app(mock_app)

        assert client._app is mock_app

    def test_set_config(self):
        """测试设置配置"""
        client = MQTTClient()
        config = {"broker": "test.broker.com", "port": 1883}

        client.set_config(config)

        assert client._config == config

    def test_subscribed_topics_property(self):
        """测试订阅主题属性"""
        client = MQTTClient()
        client._subscribed_topics = ["topic1", "topic2"]

        topics = client.subscribed_topics

        assert topics == ["topic1", "topic2"]
        assert topics is not client._subscribed_topics

    def test_is_connected_property(self):
        """测试连接状态属性"""
        client = MQTTClient()

        assert client.is_connected is False

        with patch.object(client, '_state', MQTTConnectionState.CONNECTED):
            assert client.is_connected is True

    def test_load_config_from_db(self):
        """测试从数据库加载配置"""
        client = MQTTClient()

        mock_config = MagicMock()
        mock_config.broker = "db.broker.com"
        mock_config.port = 8883
        mock_config.client_id = "db_client"
        mock_config.username = "db_user"
        mock_config.password = "db_pass"
        mock_config.ssl = True
        mock_config.timeout = 10
        mock_config.keepalive = 60

        with patch('models.MQTTConfig') as mock_mqtt_config, \
             patch('app.app') as mock_app:
            mock_mqtt_config.query.first.return_value = mock_config
            mock_app_ctx = MagicMock()
            mock_app.app_context.return_value.__enter__.return_value = mock_app_ctx

            result = client.load_config_from_db()

            assert result is True
            assert client._config['broker'] == "db.broker.com"
            assert client._config['port'] == 8883
            assert client._config['client_id'] == "db_client"

    def test_load_config_from_db_empty(self):
        """测试从数据库加载配置（无配置）"""
        client = MQTTClient()

        with patch('models.MQTTConfig') as mock_mqtt_config, \
             patch('app.app') as mock_app:
            mock_mqtt_config.query.first.return_value = None
            mock_app_ctx = MagicMock()
            mock_app.app_context.return_value.__enter__.return_value = mock_app_ctx

            result = client.load_config_from_db()

            assert result is False
            assert client._config is not None

    def test_add_message_callback(self):
        """测试添加消息回调"""
        client = MQTTClient()
        callback = MagicMock()

        client.add_message_callback(callback)

        assert callback in client._message_callbacks

    def test_remove_message_callback(self):
        """测试移除消息回调"""
        client = MQTTClient()
        callback = MagicMock()
        client._message_callbacks = [callback]

        client.remove_message_callback(callback)

        assert callback not in client._message_callbacks

    def test_remove_message_callback_not_found(self):
        """测试移除不存在的回调"""
        client = MQTTClient()
        callback1 = MagicMock()
        callback2 = MagicMock()
        client._message_callbacks = [callback1]

        client.remove_message_callback(callback2)

        assert callback1 in client._message_callbacks

    def test_publish(self):
        """测试发布消息"""
        client = MQTTClient()
        mock_paho_client = MagicMock()
        mock_result = MagicMock()
        mock_result.rc = 0
        mock_paho_client.publish.return_value = mock_result
        client._client = mock_paho_client
        client._state = MQTTConnectionState.CONNECTED

        result = client.publish("test/topic", "test message")

        assert result is True
        mock_paho_client.publish.assert_called_once()

    def test_publish_not_connected(self):
        """测试未连接时发布消息"""
        client = MQTTClient()
        client._state = MQTTConnectionState.DISCONNECTED

        result = client.publish("test/topic", "test message")

        assert result is False

    def test_publish_with_dict(self):
        """测试发布字典消息"""
        client = MQTTClient()
        mock_paho_client = MagicMock()
        mock_result = MagicMock()
        mock_result.rc = 0
        mock_paho_client.publish.return_value = mock_result
        client._client = mock_paho_client
        client._state = MQTTConnectionState.CONNECTED

        result = client.publish("test/topic", {"key": "value"})

        assert result is True

    def test_publish_failure(self):
        """测试发布失败"""
        client = MQTTClient()
        mock_paho_client = MagicMock()
        mock_result = MagicMock()
        mock_result.rc = 1
        mock_paho_client.publish.return_value = mock_result
        client._client = mock_paho_client
        client._state = MQTTConnectionState.CONNECTED

        result = client.publish("test/topic", "test message")

        assert result is False

    def test_subscribe(self):
        """测试订阅主题"""
        client = MQTTClient()
        mock_paho_client = MagicMock()
        client._client = mock_paho_client
        client._state = MQTTConnectionState.CONNECTED

        result = client.subscribe("test/topic", qos=1)

        assert result is True
        mock_paho_client.subscribe.assert_called_once_with("test/topic", qos=1)
        assert "test/topic" in client._subscribed_topics

    def test_subscribe_not_connected(self):
        """测试未连接时订阅"""
        client = MQTTClient()
        client._state = MQTTConnectionState.DISCONNECTED

        result = client.subscribe("test/topic")

        assert result is False

    def test_unsubscribe(self):
        """测试取消订阅"""
        client = MQTTClient()
        mock_paho_client = MagicMock()
        client._client = mock_paho_client
        client._state = MQTTConnectionState.CONNECTED
        client._subscribed_topics = ["test/topic"]

        result = client.unsubscribe("test/topic")

        assert result is True
        mock_paho_client.unsubscribe.assert_called_once_with("test/topic")
        assert "test/topic" not in client._subscribed_topics

    def test_unsubscribe_not_connected(self):
        """测试未连接时取消订阅"""
        client = MQTTClient()
        client._state = MQTTConnectionState.DISCONNECTED

        result = client.unsubscribe("test/topic")

        assert result is False

    def test_queue_message(self):
        """测试添加消息到队列"""
        client = MQTTClient()

        client._queue_message("test/topic", "test payload")

        assert len(client._message_queue) == 1

    def test_get_status(self):
        """测试获取状态信息"""
        client = MQTTClient()

        status = client.get_status()

        assert 'connected' in status
        assert 'state' in status
        assert 'subscribed_topics' in status
        assert 'config' in status

    def test_disconnect(self):
        """测试断开连接"""
        client = MQTTClient()
        mock_paho_client = MagicMock()
        client._client = mock_paho_client
        client._state = MQTTConnectionState.CONNECTED

        client.disconnect()

        assert client.state == MQTTConnectionState.DISCONNECTED
        assert client._subscribed_topics == []
        assert client._should_reconnect is False


class TestMQTTConnectionState:
    """测试MQTT连接状态枚举"""

    def test_enum_values(self):
        """测试枚举值"""
        assert MQTTConnectionState.DISCONNECTED.value == "disconnected"
        assert MQTTConnectionState.CONNECTING.value == "connecting"
        assert MQTTConnectionState.CONNECTED.value == "connected"
        assert MQTTConnectionState.ERROR.value == "error"

    def test_enum_comparison(self):
        """测试枚举比较"""
        assert MQTTConnectionState.CONNECTED != MQTTConnectionState.DISCONNECTED
        assert MQTTConnectionState.CONNECTED == MQTTConnectionState.CONNECTED
