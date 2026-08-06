"""Tests for Notification Service"""

from unittest.mock import patch, MagicMock
import json
try:
    from services.notification_service import NotificationService
except ImportError:
    pass

try:
    from services.notification_service import notify_unlock_success
except ImportError:
    pass

try:
    from services.notification_service import notify_unlock_failure
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
    """测试通知服务"""

    def test_send_wechat_notification_user_not_found(self, app):
        """测试发送微信通知-用户不存在"""
        with app.app_context():
            from services.notification_service import NotificationService

            with patch("models.get_by_id", return_value=None):
                result = NotificationService.send_wechat_notification(
                    1, "template_id", {}
                )

                assert result["success"] is False
                assert "用户不存在" in result["message"]

    def test_send_wechat_notification_no_parent_info(self, app):
        """测试发送微信通知-无家长信息"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.parent_info = None

            with patch("models.get_by_id", return_value=mock_user):
                result = NotificationService.send_wechat_notification(
                    1, "template_id", {}
                )

                assert result["success"] is False
                assert "家长openid不存在" in result["message"]

    def test_send_wechat_notification_no_openid(self, app):
        """测试发送微信通知-无openid"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.parent_info = json.dumps({})

            with patch("models.get_by_id", return_value=mock_user):
                with patch.object(
                    NotificationService, "_get_wechat_access_token", return_value="test_token"
                ):
                    result = NotificationService.send_wechat_notification(
                        1, "template_id", {}
                    )

                    assert result["success"] is False
                    assert "家长openid不存在" in result["message"]

    def test_send_wechat_notification_access_token_fail(self, app):
        """测试发送微信通知-获取access_token失败"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.parent_info = json.dumps({"openid": "test_openid"})

            with patch("models.get_by_id", return_value=mock_user):
                with patch.object(
                    NotificationService, "_get_wechat_access_token", return_value=None
                ):
                    result = NotificationService.send_wechat_notification(
                        1, "template_id", {}
                    )

                    assert result["success"] is False
                    assert "获取access_token失败" in result["message"]

    def test_send_wechat_notification_success(self, app):
        """测试发送微信通知-成功"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.parent_info = json.dumps({"openid": "test_openid"})

            with patch("models.get_by_id", return_value=mock_user):
                with patch.object(
                    NotificationService,
                    "_get_wechat_access_token",
                    return_value="test_token",
                ):
                    with patch("services.notification_service.requests.post") as mock_post:
                        mock_response = MagicMock()
                        mock_response.json.return_value = {"errcode": 0, "msgid": 123}
                        mock_post.return_value = mock_response

                        with patch("services.notification_service.db_session_scope"):
                            result = NotificationService.send_wechat_notification(
                                1, "template_id", {"key": {"value": "test"}}
                            )

                            assert result["success"] is True
                            assert "发送成功" in result["message"]
                            assert result["msgid"] == 123

    def test_send_wechat_notification_failure(self, app):
        """测试发送微信通知-失败"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.parent_info = json.dumps({"openid": "test_openid"})

            with patch("models.get_by_id", return_value=mock_user):
                with patch.object(
                    NotificationService,
                    "_get_wechat_access_token",
                    return_value="test_token",
                ):
                    with patch("services.notification_service.requests.post") as mock_post:
                        mock_response = MagicMock()
                        mock_response.json.return_value = {
                            "errcode": 400,
                            "errmsg": "invalid template",
                        }
                        mock_post.return_value = mock_response

                        result = NotificationService.send_wechat_notification(
                            1, "template_id", {}
                        )

                        assert result["success"] is False
                        assert "invalid template" in result["message"]

    def test_get_wechat_access_token_no_config(self, app):
        """测试获取微信access_token-无配置"""
        with app.app_context():

            app.config["WECHAT_APPID"] = None
            app.config["WECHAT_SECRET"] = None

            result = NotificationService._get_wechat_access_token()

            assert result is None

    def test_get_wechat_access_token_success(self, app):
        """测试获取微信access_token-成功"""
        with app.app_context():

            app.config["WECHAT_APPID"] = "test_appid"
            app.config["WECHAT_SECRET"] = "test_secret"

            with patch("services.notification_service.requests.get") as mock_get:
                mock_response = MagicMock()
                mock_response.json.return_value = {"access_token": "test_token"}
                mock_get.return_value = mock_response

                result = NotificationService._get_wechat_access_token()

                assert result == "test_token"

    def test_send_sms_notification_no_config(self, app):
        """测试发送短信-无配置"""
        with app.app_context():

            app.config["SMS_CONFIG"] = None

            result = NotificationService.send_sms_notification("13800138000", "test")

            assert result["success"] is False
            assert "短信服务未配置" in result["message"]

    def test_send_sms_notification_unsupported_provider(self, app):
        """测试发送短信-不支持的提供商"""
        with app.app_context():

            app.config["SMS_CONFIG"] = {"provider": "unknown"}

            result = NotificationService.send_sms_notification("13800138000", "test")

            assert result["success"] is False
            assert "不支持的短信提供商" in result["message"]

    def test_send_aliyun_sms_incomplete_config(self, app):
        """测试阿里云短信-配置不完整"""
        with app.app_context():

            config = {"provider": "aliyun", "access_key_id": "test"}

            result = NotificationService._send_aliyun_sms(
                "13800138000", "test", config
            )

            assert result["success"] is False
            assert "阿里云短信配置不完整" in result["message"]

    def test_send_tencent_sms(self, app):
        """测试腾讯云短信"""
        with app.app_context():

            config = {"provider": "tencent"}

            result = NotificationService._send_tencent_sms(
                "13800138000", "test", config
            )

            assert result["success"] is False
            assert "待实现" in result["message"]


class TestNotificationFunctions:
    """测试通知函数"""

    def test_notify_unlock_success_user_not_found(self, app):
        """测试开锁成功通知-用户不存在"""
        with app.app_context():
            from services.notification_service import notify_unlock_success

            with patch("models.get_by_id", return_value=None):
                result = notify_unlock_success(1, "box1", "device1")

                assert result["success"] is False
                assert "用户不存在" in result["message"]

    def test_notify_unlock_success_no_template(self, app):
        """测试开锁成功通知-模板未配置"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.name = "张三"

            with patch("models.get_by_id", return_value=mock_user):
                app.config["WECHAT_TEMPLATE_UNLOCK_SUCCESS"] = None

                result = notify_unlock_success(1, "box1", "device1")

                assert result["success"] is False
                assert "模板ID未配置" in result["message"]

    def test_notify_unlock_success(self, app):
        """测试开锁成功通知"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.name = "张三"

            app.config["WECHAT_TEMPLATE_UNLOCK_SUCCESS"] = "template_id"

            with patch("models.get_by_id", return_value=mock_user):
                with patch(
                    "services.notification_service.NotificationService.send_wechat_notification",
                    return_value={"success": True, "message": "发送成功"},
                ):
                    result = notify_unlock_success(1, "box1", "device1")

                    assert result["success"] is True

    def test_notify_unlock_failure_user_not_found(self, app):
        """测试开锁失败通知-用户不存在"""
        with app.app_context():
            from services.notification_service import notify_unlock_failure

            with patch("models.get_by_id", return_value=None):
                result = notify_unlock_failure(1, "score_low", 50)

                assert result["success"] is False
                assert "用户不存在" in result["message"]

    def test_notify_unlock_failure_no_template(self, app):
        """测试开锁失败通知-模板未配置"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.name = "张三"

            with patch("models.get_by_id", return_value=mock_user):
                app.config["WECHAT_TEMPLATE_UNLOCK_FAILURE"] = None

                result = notify_unlock_failure(1, "score_low", 50)

                assert result["success"] is False
                assert "模板ID未配置" in result["message"]

    def test_notify_unlock_failure_reason_map(self, app):
        """测试开锁失败通知-原因映射"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.name = "张三"

            app.config["WECHAT_TEMPLATE_UNLOCK_FAILURE"] = "template_id"

            with patch("models.get_by_id", return_value=mock_user):
                with patch(
                    "services.notification_service.NotificationService.send_wechat_notification"
                ) as mock_send:
                    mock_send.return_value = {"success": True, "message": "发送成功"}

                    notify_unlock_failure(1, "score_low", 50)

                    call_args = mock_send.call_args
                    data = call_args[0][2]
                    assert "积分不足" in data["keyword1"]["value"]

    def test_notify_score_change_user_not_found(self, app):
        """测试积分变动通知-用户不存在"""
        with app.app_context():
            from services.notification_service import notify_score_change

            with patch("models.get_by_id", return_value=None):
                result = notify_score_change(1, 10, "奖励")

                assert result["success"] is False
                assert "用户不存在" in result["message"]

    def test_notify_score_change_no_template(self, app):
        """测试积分变动通知-模板未配置"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.name = "张三"
            mock_user.current_score = 100

            with patch("models.get_by_id", return_value=mock_user):
                app.config["WECHAT_TEMPLATE_SCORE_CHANGE"] = None

                result = notify_score_change(1, 10, "奖励")

                assert result["success"] is False
                assert "模板ID未配置" in result["message"]

    def test_notify_score_change_positive(self, app):
        """测试积分变动通知-正向变动"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.name = "张三"
            mock_user.current_score = 100

            app.config["WECHAT_TEMPLATE_SCORE_CHANGE"] = "template_id"

            with patch("models.get_by_id", return_value=mock_user):
                with patch(
                    "services.notification_service.NotificationService.send_wechat_notification",
                    return_value={"success": True, "message": "发送成功"},
                ):
                    result = notify_score_change(1, 10, "奖励")

                    assert result["success"] is True

    def test_notify_score_change_negative(self, app):
        """测试积分变动通知-负向变动"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.name = "张三"
            mock_user.current_score = 100

            app.config["WECHAT_TEMPLATE_SCORE_CHANGE"] = "template_id"

            with patch("models.get_by_id", return_value=mock_user):
                with patch(
                    "services.notification_service.NotificationService.send_wechat_notification",
                    return_value={"success": True, "message": "发送成功"},
                ):
                    result = notify_score_change(1, -5, "扣除")

                    assert result["success"] is True

    def test_notify_device_offline(self, app):
        """测试设备离线通知"""
        with app.app_context():
            from services.notification_service import notify_device_offline

            mock_admin = MagicMock()
            mock_admin.phone = "13800138000"

            with patch("models.get_by_id", return_value=mock_admin):
                with patch(
                    "services.notification_service.NotificationService.send_sms_notification",
                    return_value={"success": True, "message": "发送成功"},
                ):
                    result = notify_device_offline("device1", "设备1", [1])

                    assert result["success"] is True
                    assert len(result["results"]) == 1

    def test_notify_device_offline_no_admin(self, app):
        """测试设备离线通知-无管理员"""
        with app.app_context():

            with patch("models.get_by_id", return_value=None):
                result = notify_device_offline("device1", "设备1", [1])

                assert result["success"] is True
                assert len(result["results"]) == 0
