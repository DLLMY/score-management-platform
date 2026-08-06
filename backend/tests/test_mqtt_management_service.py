"""MQTT管理服务单元测试"""
from unittest.mock import Mock, patch
from datetime import datetime
try:
    from services.mqtt_management_service import mqtt_management_service
except ImportError:
    pass


class TestMQTTManagementService:
    """MQTT管理服务测试类"""

    @patch('services.mqtt_management_service.db_session_scope')
    @patch('models.MQTTLog')
    def test_get_mqtt_logs(self, mock_log, mock_session_scope):
        """测试获取MQTT日志"""
        mock_log1 = Mock()
        mock_log1.id = 1
        mock_log1.topic = 'test/topic'
        mock_log1.message = 'test message'
        mock_log1.direction = 'in'
        mock_log1.timestamp = datetime(2026, 7, 1, 10, 0, 0)

        mock_log2 = Mock()
        mock_log2.id = 2
        mock_log2.topic = 'test/topic2'
        mock_log2.message = 'test message 2'
        mock_log2.direction = 'out'
        mock_log2.timestamp = datetime(2026, 7, 1, 11, 0, 0)

        mock_log.query.order_by.return_value.limit.return_value.all.return_value = [mock_log1, mock_log2]

        mock_session_scope.return_value.__enter__.return_value = Mock()

        from services.mqtt_management_service import mqtt_management_service

        logs = mqtt_management_service.get_mqtt_logs(limit=100)

        assert len(logs) == 2
        assert logs[0]['id'] == 1
        assert logs[0]['topic'] == 'test/topic'
        assert logs[1]['direction'] == 'out'

    @patch('services.mqtt_management_service.db_session_scope')
    @patch('models.MQTTConfig')
    def test_get_mqtt_config_exists(self, mock_config, mock_session_scope):
        """测试获取已存在的MQTT配置"""
        mock_config_instance = Mock()
        mock_config_instance.id = 1
        mock_config_instance.broker = 'test.broker.com'
        mock_config_instance.port = 8883
        mock_config_instance.client_id = 'test_client'
        mock_config_instance.username = 'test_user'
        mock_config_instance.password = 'test_password'
        mock_config_instance.ssl = True
        mock_config_instance.timeout = 10
        mock_config_instance.keepalive = 60
        mock_config_instance.updated_at = datetime(2026, 7, 1, 10, 0, 0)

        mock_config.query.first.return_value = mock_config_instance

        mock_session_scope.return_value.__enter__.return_value = Mock()

        config = mqtt_management_service.get_mqtt_config()

        assert config['broker'] == 'test.broker.com'
        assert config['port'] == 8883
        assert config['password'] == '******'
        assert config['ssl']

    @patch('services.mqtt_management_service.db_session_scope')
    @patch('services.mqtt_management_service.MQTTConfig')
    def test_update_mqtt_config_exists(self, mock_config, mock_session_scope):
        """测试更新已存在的MQTT配置"""
        mock_config_instance = Mock()
        mock_config_instance.id = 1
        mock_config_instance.broker = 'old.broker.com'
        mock_config_instance.port = 1883
        mock_config_instance.client_id = 'old_client'
        mock_config_instance.username = 'old_user'
        mock_config_instance.password = 'old_password'
        mock_config_instance.ssl = False
        mock_config_instance.timeout = 5
        mock_config_instance.keepalive = 30

        mock_config.query.first.return_value = mock_config_instance

        mock_session_scope.return_value.__enter__.return_value = Mock()

        mqtt_management_service.update_mqtt_config({
            'broker': 'new.broker.com',
            'port': 8883,
            'client_id': 'new_client',
            'username': 'new_user',
            'password': 'new_password',
            'ssl': True,
            'timeout': 10,
            'keepalive': 60
        })

        assert mock_config_instance.broker == 'new.broker.com'
        assert mock_config_instance.port == 8883
        assert mock_config_instance.ssl
        assert mock_config_instance.timeout == 10

    @patch('services.mqtt_management_service.db_session_scope')
    @patch('services.mqtt_management_service.MQTTConfig')
    def test_update_mqtt_config_not_exists(self, mock_config, mock_session_scope):
        """测试更新不存在的MQTT配置（创建新配置）"""
        mock_config.query.first.return_value = None
        mock_config_instance = Mock()
        mock_config.return_value = mock_config_instance

        mock_session_scope.return_value.__enter__.return_value = Mock()

        mqtt_management_service.update_mqtt_config({
            'broker': 'new.broker.com',
            'port': 8883
        })

        mock_config.assert_called_once()
        assert mock_config_instance.broker == 'new.broker.com'

    @patch('services.mqtt_management_service.db_session_scope')
    @patch('services.mqtt_management_service.MQTTConfig')
    def test_update_mqtt_config_password_masked(self, mock_config, mock_session_scope):
        """测试更新配置时密码掩码不更新实际密码"""
        mock_config_instance = Mock()
        mock_config_instance.id = 1
        mock_config_instance.password = 'original_password'

        mock_config.query.first.return_value = mock_config_instance

        mock_session_scope.return_value.__enter__.return_value = Mock()

        mqtt_management_service.update_mqtt_config({
            'broker': 'new.broker.com',
            'password': '******'
        })

        assert mock_config_instance.password == 'original_password'
