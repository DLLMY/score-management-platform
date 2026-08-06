import json
from unittest.mock import Mock, patch
try:
    from services.notification_service import NotificationService
except ImportError:
    pass

try:
    from services.notification_service import notify_unlock_success
except ImportError:
    pass

try:
    from services.notification_service import notify_score_change
except ImportError:
    pass

try:
    from services.notification_service import notify_device_offline
except ImportError:
    pass


class TestNotificationService:

    def test_send_wechat_notification_user_not_found(self, app):
        with app.app_context():
            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = None
                from services.notification_service import NotificationService

                result = NotificationService.send_wechat_notification(1, 'template_id', {})
                assert result['success'] is False
                assert '用户不存在' in result['message']

    def test_send_wechat_notification_no_parent_info(self, app):
        with app.app_context():
            mock_user = Mock()
            mock_user.parent_info = None

            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                result = NotificationService.send_wechat_notification(1, 'template_id', {})
                assert result['success'] is False
                assert '家长openid不存在' in result['message']

    def test_send_wechat_notification_no_openid(self, app):
        with app.app_context():
            mock_user = Mock()
            mock_user.parent_info = json.dumps({'name': 'test'})

            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                with patch.object(NotificationService, '_get_wechat_access_token', return_value='test_token'):
                    result = NotificationService.send_wechat_notification(1, 'template_id', {})
                    assert result['success'] is False
                    assert '家长openid不存在' in result['message']

    def test_send_wechat_notification_no_wechat_config(self, app):
        with app.app_context():
            app.config['WECHAT_APPID'] = None
            app.config['WECHAT_SECRET'] = None

            mock_user = Mock()
            mock_user.parent_info = json.dumps({'openid': 'test_openid'})

            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                result = NotificationService.send_wechat_notification(1, 'template_id', {})
                assert result['success'] is False
                assert '获取access_token失败' in result['message']

    def test_send_wechat_notification_success(self, app):
        with app.app_context():
            app.config['WECHAT_APPID'] = 'test_appid'
            app.config['WECHAT_SECRET'] = 'test_secret'

            mock_user = Mock()
            mock_user.parent_info = json.dumps({'openid': 'test_openid'})
            mock_user.id = 1

            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                with patch('services.notification_service.requests.get') as mock_get:
                    mock_get.return_value.json.return_value = {'access_token': 'test_token'}

                    with patch('services.notification_service.requests.post') as mock_post:
                        mock_post.return_value.json.return_value = {'errcode': 0, 'msgid': 'test_msgid'}

                        result = NotificationService.send_wechat_notification(1,
                            'template_id', {'key1': {'value': 'test'}})
                        assert result['success'] is True
                        assert '发送成功' in result['message']
                        assert 'msgid' in result

    def test_send_wechat_notification_failure(self, app):
        with app.app_context():
            app.config['WECHAT_APPID'] = 'test_appid'
            app.config['WECHAT_SECRET'] = 'test_secret'

            mock_user = Mock()
            mock_user.parent_info = json.dumps({'openid': 'test_openid'})

            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                with patch('services.notification_service.requests.get') as mock_get:
                    mock_get.return_value.json.return_value = {'access_token': 'test_token'}

                    with patch('services.notification_service.requests.post') as mock_post:
                        mock_post.return_value.json.return_value = {'errcode': 1, 'errmsg': '测试错误'}

                        result = NotificationService.send_wechat_notification(1, 'template_id', {})
                        assert result['success'] is False
                        assert '测试错误' in result['message']

    def test_send_sms_notification_no_config(self, app):
        with app.app_context():
            app.config['SMS_CONFIG'] = None

            result = NotificationService.send_sms_notification('13800138000', 'test message')
            assert result['success'] is False
            assert '短信服务未配置' in result['message']

    def test_send_sms_notification_unsupported_provider(self, app):
        with app.app_context():
            app.config['SMS_CONFIG'] = {'provider': 'unknown'}

            result = NotificationService.send_sms_notification('13800138000', 'test message')
            assert result['success'] is False
            assert '不支持的短信提供商' in result['message']

    def test_send_aliyun_sms_missing_config(self, app):
        with app.app_context():

            config = {'provider': 'aliyun', 'access_key_id': 'test'}
            result = NotificationService._send_aliyun_sms('13800138000', 'test', config)
            assert result['success'] is False
            assert '阿里云短信配置不完整' in result['message']

    def test_send_tencent_sms_not_implemented(self, app):
        with app.app_context():

            result = NotificationService._send_tencent_sms('13800138000', 'test', {})
            assert result['success'] is False
            assert '待实现' in result['message']

    def test_notify_unlock_success_user_not_found(self, app):
        with app.app_context():
            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = None
                from services.notification_service import notify_unlock_success

                result = notify_unlock_success(1, 'box1', 'device1')
                assert result['success'] is False
                assert '用户不存在' in result['message']

    def test_notify_unlock_success_no_template(self, app):
        with app.app_context():
            app.config['WECHAT_TEMPLATE_UNLOCK_SUCCESS'] = None

            mock_user = Mock()
            mock_user.name = '测试用户'
            mock_user.parent_info = json.dumps({'openid': 'test_openid'})

            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                result = notify_unlock_success(1, 'box1', 'device1')
                assert result['success'] is False
                assert '模板ID未配置' in result['message']

    def test_notify_score_change_user_not_found(self, app):
        with app.app_context():
            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = None
                from services.notification_service import notify_score_change

                result = notify_score_change(1, 10, '测试原因')
                assert result['success'] is False
                assert '用户不存在' in result['message']

    def test_notify_device_offline_no_admin_phone(self, app):
        with app.app_context():
            mock_admin = Mock()
            mock_admin.phone = None

            with patch('models.get_by_id') as mock_get_by_id:
                mock_get_by_id.return_value = mock_admin
                from services.notification_service import notify_device_offline

                result = notify_device_offline('device1', '设备1', [1])
                assert result['success'] is True
                assert len(result['results']) == 0
