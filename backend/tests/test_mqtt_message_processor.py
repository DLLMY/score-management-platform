import json
from unittest.mock import patch, MagicMock
try:
    from services.mqtt.mqtt_message_processor import MQTTMessageProcessor
except ImportError:
    pass


class TestMQTTMessageProcessor:
    """MQTT消息处理器测试"""

    def test_init(self):
        """测试初始化"""
        from services.mqtt.mqtt_message_processor import MQTTMessageProcessor

        processor = MQTTMessageProcessor()
        assert processor._app is None

    def test_set_app(self):
        """测试设置应用上下文"""

        processor = MQTTMessageProcessor()
        mock_app = MagicMock()
        processor.set_app(mock_app)
        assert processor._app == mock_app

    def test_get_app_context(self):
        """测试获取应用上下文"""

        processor = MQTTMessageProcessor()
        mock_app = MagicMock()
        processor.set_app(mock_app)
        assert processor._get_app_context() == mock_app

    def test_process_messages_batch_empty(self, app):
        """测试处理空消息列表"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        with app.app_context():
            processor.process_messages_batch([])

    def test_process_messages_batch_with_heartbeat(self, app):
        """测试处理包含心跳消息的批量消息"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        messages = [
            {
                "topic": "phonebox/heartbeat",
                "message": json.dumps({
                    "device_id": "test_device",
                    "status": "online",
                    "wifi_signal": -50,
                    "uptime": 1000
                }),
                "timestamp": 1234567890.0
            }
        ]

        with app.app_context():
            with patch.object(processor, '_process_heartbeat') as mock_process:
                processor.process_messages_batch(messages)
                mock_process.assert_called_once()

    def test_process_messages_batch_with_regular_message(self, app):
        """测试处理普通消息"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        messages = [
            {
                "topic": "phonebox/log",
                "message": '{"level": "INFO", "content": "test log"}',
                "timestamp": 1234567890.0
            }
        ]

        with app.app_context():
            processor.process_messages_batch(messages)

    def test_process_critical_message_ota(self, app):
        """测试处理OTA关键消息"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        with patch.object(processor, '_process_ota_status') as mock_process:
            processor.process_critical_message(
                "phonebox/ota/test_device",
                '{"device_id": "test_device", "status": "started"}'
            )
            mock_process.assert_called_once()

    def test_process_critical_message_with_callback(self):
        """测试处理带回调的关键消息"""

        processor = MQTTMessageProcessor()

        mock_callback = MagicMock()
        processor.process_critical_message(
            "phonebox/test",
            "test message",
            callbacks=[mock_callback]
        )
        mock_callback.assert_called_once_with("phonebox/test", "test message")

    def test_process_critical_message_callback_error(self):
        """测试回调处理错误"""

        processor = MQTTMessageProcessor()

        def error_callback(topic, message):
            raise ValueError("test error")

        processor.process_critical_message(
            "phonebox/test",
            "test message",
            callbacks=[error_callback]
        )

    def test_process_ota_status_started(self, app):
        """测试处理OTA开始状态"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "test_device",
            "status": "started",
            "from_version": "1.0.0",
            "to_version": "2.0.0"
        })

        with app.app_context():
            processor._process_ota_status("phonebox/ota/test_device", message)

    def test_process_ota_status_downloading(self, app):
        """测试处理OTA下载状态"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "test_device",
            "status": "downloading",
            "from_version": "1.0.0",
            "to_version": "2.0.0",
            "progress": 50
        })

        with app.app_context():
            processor._process_ota_status("phonebox/ota/test_device", message)

    def test_process_ota_status_success(self, app):
        """测试处理OTA成功状态"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "test_device",
            "status": "success",
            "from_version": "1.0.0",
            "to_version": "2.0.0"
        })

        with app.app_context():
            processor._process_ota_status("phonebox/ota/test_device", message)

    def test_process_ota_status_failed(self, app):
        """测试处理OTA失败状态"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "test_device",
            "status": "failed",
            "from_version": "1.0.0",
            "to_version": "2.0.0",
            "error_message": "Update failed"
        })

        with app.app_context():
            processor._process_ota_status("phonebox/ota/test_device", message)

    def test_process_ota_status_update_in_progress(self, app):
        """测试处理OTA进行中状态"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "test_device",
            "status": "updating",
            "from_version": "1.0.0",
            "to_version": "2.0.0",
            "progress": 80
        })

        with app.app_context():
            processor._process_ota_status("phonebox/ota/test_device", message)

    def test_process_ota_status_invalid_json(self, app):
        """测试处理无效JSON的OTA消息"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        processor._process_ota_status("phonebox/ota/test_device", "invalid json")

    def test_process_heartbeat_new_device(self, app):
        """测试处理新设备心跳"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "new_device",
            "status": "online",
            "wifi_signal": -60,
            "uptime": 500,
            "box_a_status": "locked",
            "box_b_status": "unlocked",
            "system_state": "normal",
            "fw_version": "1.0.0",
            "platform": "esp32",
            "free_heap": 10000
        })

        with app.app_context():
            with patch('services.websocket_service.send_device_status'):
                processor._process_heartbeat("phonebox/heartbeat", message)

    def test_process_heartbeat_existing_device(self, app):
        """测试处理已有设备心跳"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "existing_device",
            "status": "online",
            "wifi_signal": -70,
            "uptime": 2000
        })

        with app.app_context():
            with patch('services.websocket_service.send_device_status'):
                processor._process_heartbeat("phonebox/heartbeat", message)

    def test_process_heartbeat_no_device_id(self, app):
        """测试处理没有设备ID的心跳消息"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({"status": "online"})
        processor._process_heartbeat("phonebox/heartbeat", message)

    def test_process_heartbeat_invalid_json(self, app):
        """测试处理无效JSON的心跳消息"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        processor._process_heartbeat("phonebox/heartbeat", "invalid json")

    def test_process_heartbeat_websocket_error(self, app):
        """测试处理心跳时WebSocket发送失败"""

        processor = MQTTMessageProcessor()
        processor.set_app(app)

        message = json.dumps({
            "device_id": "test_device",
            "status": "online"
        })

        with app.app_context():
            with patch('services.websocket_service.send_device_status') as mock_send:
                mock_send.side_effect = Exception("WebSocket error")
                processor._process_heartbeat("phonebox/heartbeat", message)
