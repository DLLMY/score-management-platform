"""MQTT服务单元测试"""

from unittest.mock import patch

try:
    from services.mqtt_manager import MQTTManager
except ImportError:
    pass

try:
    from services.mqtt_service import connect_mqtt
except ImportError:
    pass

try:
    from services.mqtt_service import publish_mqtt
except ImportError:
    pass

try:
    from services.mqtt_service import reconnect_mqtt
except ImportError:
    pass

try:
    from services.mqtt_service import get_mqtt_status
except ImportError:
    pass

try:
    import services.mqtt_service as mqtt_service
except ImportError:
    pass

try:
    from services.mqtt_service import publish_ota_command
except ImportError:
    pass


class TestMQTTService:
    """MQTT服务测试类"""

    def test_mqtt_manager_singleton(self):
        """测试MQTTManager单例模式"""
        from services.mqtt_manager import MQTTManager

        manager1 = MQTTManager("test_singleton")
        manager2 = MQTTManager("test_singleton")

        assert manager1 is manager2

    @patch("services.mqtt_service.mqtt_manager")
    def test_connect_mqtt_success(self, mock_manager):
        """测试MQTT连接成功"""
        mock_manager.connect.return_value = True

        from services.mqtt_service import connect_mqtt

        connect_mqtt({"broker": "test.broker.com", "port": 8883})

        mock_manager.set_config.assert_called_once()
        mock_manager.connect.assert_called_once()

    @patch("services.mqtt_service.mqtt_manager")
    def test_connect_mqtt_with_default_config(self, mock_manager):
        """测试MQTT使用默认配置连接"""
        mock_manager.connect.return_value = True

        result = connect_mqtt()

        assert result is not None

    @patch("services.mqtt_service.mqtt_manager")
    def test_publish_mqtt_dict_payload(self, mock_manager):
        """测试MQTT发布字典消息"""
        mock_manager.publish.return_value = True

        from services.mqtt_service import publish_mqtt

        payload = {"action": "add", "score": 5}
        publish_mqtt("test/topic", payload, qos=0)

        mock_manager.publish.assert_called_once()

    @patch("services.mqtt_service.mqtt_manager")
    def test_publish_mqtt_string_payload(self, mock_manager):
        """测试MQTT发布字符串消息"""
        mock_manager.publish.return_value = True

        payload = "test message"
        publish_mqtt("test/topic", payload, qos=1)

        mock_manager.publish.assert_called_once()

    @patch("services.mqtt_service.mqtt_manager")
    def test_publish_mqtt_failure(self, mock_manager):
        """测试MQTT发布失败"""
        mock_manager.publish.return_value = False

        result = publish_mqtt("test/topic", {"data": "test"})

        assert not result

    @patch("services.mqtt_service.mqtt_manager")
    def test_reconnect_mqtt(self, mock_manager):
        """测试MQTT重连"""
        mock_manager.connect.return_value = True

        from services.mqtt_service import reconnect_mqtt

        reconnect_mqtt()

        mock_manager.connect.assert_called_once()

    @patch("services.mqtt_service.mqtt_manager")
    def test_get_mqtt_status(self, mock_manager):
        """测试获取MQTT状态"""
        mock_manager.get_status.return_value = {
            "connected": True,
            "broker": "test.broker.com",
            "port": 8883,
        }

        from services.mqtt_service import get_mqtt_status

        status = get_mqtt_status()

        assert status["connected"]
        assert "broker" in status

    def test_clear_mqtt_logs(self):
        """测试清理MQTT日志"""
        import services.mqtt_service as mqtt_service

        mqtt_service.mqtt_logs.append({"topic": "test", "message": "test"})

        mqtt_service.clear_mqtt_logs()

        assert mqtt_service.mqtt_logs == []

    @patch("services.mqtt_service.publish_mqtt")
    def test_publish_ota_command_with_device_id(self, mock_publish):
        """测试发布OTA指令（指定设备ID）"""
        mock_publish.return_value = True

        from services.mqtt_service import publish_ota_command

        payload = {"url": "http://test.com/firmware.bin", "version": "1.0.0", "md5": "abc123"}
        publish_ota_command("device001", payload)

        mock_publish.assert_called_once()

    @patch("services.mqtt_service.publish_mqtt")
    def test_publish_ota_command_to_all(self, mock_publish):
        """测试发布OTA指令（广播）"""
        mock_publish.return_value = True

        payload = {"url": "http://test.com/firmware.bin", "version": "1.0.0", "md5": "abc123"}
        publish_ota_command(None, payload)

        mock_publish.assert_called_once()
