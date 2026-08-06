import unittest
from unittest.mock import MagicMock, patch

from services.mqtt.mqtt_message_client import MQTTMessageClient


class TestMQTTMessageClient(unittest.TestCase):

    def test_init(self):
        """测试初始化"""
        client = MQTTMessageClient()

        assert client._message_processor is not None
        assert client._processing_lock is not None

    def test_set_app(self):
        """测试设置app"""
        client = MQTTMessageClient()
        mock_app = MagicMock()

        with patch.object(client, '_message_processor') as mock_processor:
            client.set_app(mock_app)

            assert client._app == mock_app
            mock_processor.set_app.assert_called_once_with(mock_app)

    def test_process_messages_batch(self):
        """测试批量处理消息"""
        client = MQTTMessageClient()
        mock_messages = [{"topic": "test", "message": "hello"}]

        with patch.object(client._message_processor, 'process_messages_batch') as mock_process:
            client._process_messages_batch(mock_messages)

            mock_process.assert_called_once_with(mock_messages)

    def test_process_messages_batch_exception(self):
        """测试批量处理消息异常"""
        client = MQTTMessageClient()
        mock_messages = [{"topic": "test", "message": "hello"}]

        with patch.object(client._message_processor, 'process_messages_batch', side_effect=Exception("Test error")):
            with patch('services.mqtt.mqtt_message_client.print'):
                client._process_messages_batch(mock_messages)

    def test_process_critical_message(self):
        """测试处理紧急消息"""
        client = MQTTMessageClient()
        topic = "phonebox/query"
        message = "test message"

        with patch.object(client._message_processor, 'process_critical_message') as mock_process:
            client._process_critical_message(topic, message)

            mock_process.assert_called_once_with(topic, message, [])

    def test_process_critical_message_exception(self):
        """测试处理紧急消息异常"""
        client = MQTTMessageClient()
        topic = "phonebox/query"
        message = "test message"

        with patch.object(client._message_processor, 'process_critical_message', side_effect=Exception("Test error")):
            with patch('services.mqtt.mqtt_message_client.print'):
                client._process_critical_message(topic, message)

    def test_on_message_normal(self):
        """测试处理普通消息"""
        client = MQTTMessageClient()
        mock_msg = MagicMock()
        mock_msg.topic = "phonebox/status"
        mock_msg.payload.decode.return_value = "{\"status\": \"online\"}"

        with patch.object(client, '_queue_message') as mock_queue:
            client._on_message(None, None, mock_msg)

            mock_queue.assert_called_once_with("phonebox/status", "{\"status\": \"online\"}")

    def test_on_message_critical_with_app(self):
        """测试处理紧急消息（有app上下文）"""
        client = MQTTMessageClient()
        client._app = MagicMock()
        mock_msg = MagicMock()
        mock_msg.topic = "phonebox/query"
        mock_msg.payload.decode.return_value = "query data"

        with patch.object(client, '_queue_message') as mock_queue, \
             patch.object(client, '_process_critical_message') as mock_process:
            client._on_message(None, None, mock_msg)

            mock_queue.assert_called_once_with("phonebox/query", "query data")
            mock_process.assert_called_once()

    def test_on_message_critical_without_app(self):
        """测试处理紧急消息（无app上下文）"""
        client = MQTTMessageClient()
        client._app = None
        mock_msg = MagicMock()
        mock_msg.topic = "phonebox/unlock/123"
        mock_msg.payload.decode.return_value = "unlock request"

        with patch.object(client, '_queue_message') as mock_queue, \
             patch.object(client, '_process_critical_message') as mock_process:
            client._on_message(None, None, mock_msg)

            mock_queue.assert_called_once_with("phonebox/unlock/123", "unlock request")
            mock_process.assert_called_once()

    def test_on_message_ota_topic(self):
        """测试处理OTA消息"""
        client = MQTTMessageClient()
        client._app = MagicMock()
        mock_msg = MagicMock()
        mock_msg.topic = "phonebox/ota/update"
        mock_msg.payload.decode.return_value = "ota data"

        with patch.object(client, '_queue_message') as mock_queue, \
             patch.object(client, '_process_critical_message') as mock_process:
            client._on_message(None, None, mock_msg)

            mock_queue.assert_called_once_with("phonebox/ota/update", "ota data")
            mock_process.assert_called_once()

    def test_on_message_exception(self):
        """测试消息处理异常"""
        client = MQTTMessageClient()
        mock_msg = MagicMock()
        mock_msg.payload.decode.side_effect = Exception("Decode error")

        with patch('services.mqtt.mqtt_message_client.print'):
            client._on_message(None, None, mock_msg)


if __name__ == '__main__':
    unittest.main()
