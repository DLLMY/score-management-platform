from flask import request
from flask_restx import Namespace, Resource, fields
from utils.permission import requires_permission
from utils.response import APIResponse
from flask import current_app

from datetime import datetime
from services.notification_service import NotificationService

ns_notification_config = Namespace("notification-config", description="通知配置管理")

notification_config_model = ns_notification_config.model(
    "NotificationConfig",
    {
        "wechat_appid": fields.String(description="微信AppID"),
        "wechat_secret": fields.String(description="微信AppSecret"),
        "template_unlock_success": fields.String(description="开锁成功模板ID"),
        "template_unlock_failure": fields.String(description="开锁失败模板ID"),
        "template_score_change": fields.String(description="积分变动模板ID"),
        "sms_provider": fields.String(description="短信服务商(aliyun/tencent)"),
        "sms_access_key_id": fields.String(description="短信AccessKeyId"),
        "sms_access_key_secret": fields.String(description="短信AccessKeySecret"),
        "sms_sign_name": fields.String(description="短信签名"),
        "sms_template_code": fields.String(description="短信模板CODE"),
        "enable_wechat_notification": fields.Boolean(description="是否启用微信通知"),
        "enable_sms_notification": fields.Boolean(description="是否启用短信通知"),
    },
)


@ns_notification_config.route("/")
class NotificationConfig(Resource):

    @ns_notification_config.doc("get_notification_config", description="获取通知配置")
    @ns_notification_config.response(200, "成功")
    @requires_permission("notification.view")
    def get(self):
        """
        获取通知配置

        返回当前的微信和短信通知配置。
        """
        config = {
            "wechat_appid": current_app.config.get("WECHAT_APPID", ""),
            "wechat_secret": "***" if current_app.config.get("WECHAT_SECRET") else "",
            "template_unlock_success": current_app.config.get("WECHAT_TEMPLATE_UNLOCK_SUCCESS", ""),
            "template_unlock_failure": current_app.config.get("WECHAT_TEMPLATE_UNLOCK_FAILURE", ""),
            "template_score_change": current_app.config.get("WECHAT_TEMPLATE_SCORE_CHANGE", ""),
            "sms_provider": current_app.config.get("SMS_CONFIG", {}).get("provider", ""),
            "sms_access_key_id": current_app.config.get("SMS_CONFIG", {}).get("access_key_id", ""),
            "sms_sign_name": current_app.config.get("SMS_CONFIG", {}).get("sign_name", ""),
            "sms_template_code": current_app.config.get("SMS_CONFIG", {}).get("template_code", ""),
            "enable_wechat_notification": current_app.config.get(
                "ENABLE_WECHAT_NOTIFICATION", True
            ),
            "enable_sms_notification": current_app.config.get("ENABLE_SMS_NOTIFICATION", False),
        }

        return APIResponse.success(data={"config": config})

    @ns_notification_config.doc("update_notification_config", description="更新通知配置")
    @ns_notification_config.expect(notification_config_model)
    @ns_notification_config.response(200, "成功")
    @requires_permission("notification.send")
    def put(self):
        """
        更新通知配置

        更新微信和短信通知的配置。
        """
        data = request.get_json(silent=True) or {}
        _apply_wechat_config(data)
        _apply_sms_config(data)
        if "enable_wechat_notification" in data:
            current_app.config["ENABLE_WECHAT_NOTIFICATION"] = data["enable_wechat_notification"]
        if "enable_sms_notification" in data:
            current_app.config["ENABLE_SMS_NOTIFICATION"] = data["enable_sms_notification"]
        _persist_notification_config(data)
        return APIResponse.success(message="通知配置已更新")
@ns_notification_config.route("/test-wechat")
class TestWechatNotification(Resource):

    @ns_notification_config.doc("test_wechat_notification", description="测试微信通知")
    @ns_notification_config.param("openid", "用户OpenID")
    @ns_notification_config.response(200, "成功")
    @requires_permission("notification.send")
    def post(self):
        """
        测试微信通知

        发送一条测试模板消息。
        """
        from services.notification_service import NotificationService

        openid = request.args.get("openid")
        if not openid:
            return APIResponse.error(message="请提供openid", status_code=400)

        template_id = current_app.config.get("WECHAT_TEMPLATE_UNLOCK_SUCCESS")
        if not template_id:
            return APIResponse.error(message="模板ID未配置", status_code=400)

        data = {
            "first": {"value": "这是一条测试消息", "color": "#173177"},
            "keyword1": {"value": "测试设备", "color": "#173177"},
            "keyword2": {"value": "A箱", "color": "#173177"},
            "keyword3": {"value": datetime.now().strftime("%Y-%m-%d %H:%M"), "color": "#173177"},
            "remark": {"value": "如果您收到这条消息，说明微信通知配置正确", "color": "#999999"},
        }

        result = NotificationService.send_wechat_notification(
            user_id=0, template_id=template_id, data=data
        )

        if result.get("success"):
            return APIResponse.success(data=result, message=result.get("message"))
        return APIResponse.error(message=result.get("message"), status_code=400)


@ns_notification_config.route("/test-sms")
class TestSmsNotification(Resource):

    @ns_notification_config.doc("test_sms_notification", description="测试短信通知")
    @ns_notification_config.param("phone", "手机号")
    @ns_notification_config.response(200, "成功")
    @requires_permission("notification.send")
    def post(self):
        """
        测试短信通知

        发送一条测试短信。
        """

        phone = request.args.get("phone")
        if not phone:
            return APIResponse.error(message="请提供手机号", status_code=400)

        result = NotificationService.send_sms_notification(
            phone=phone,
            message=f'【测试消息】这是一条测试短信，发送时间：{datetime.now().strftime("%Y-%m-%d %H:%M")}',
        )

        if result.get("success"):
            return APIResponse.success(data=result, message=result.get("message"))
        return APIResponse.error(message=result.get("message"), status_code=400)



_WECHAT_CONFIG_MAP = {
    "wechat_appid": "WECHAT_APPID",
    "wechat_secret": "WECHAT_SECRET",
    "template_unlock_success": "WECHAT_TEMPLATE_UNLOCK_SUCCESS",
    "template_unlock_failure": "WECHAT_TEMPLATE_UNLOCK_FAILURE",
    "template_score_change": "WECHAT_TEMPLATE_SCORE_CHANGE",
}
_SMS_CONFIG_MAP = {
    "sms_provider": "provider",
    "sms_access_key_id": "access_key_id",
    "sms_access_key_secret": "access_key_secret",
    "sms_sign_name": "sign_name",
    "sms_template_code": "template_code",
}
_SECRET_MASK = "***"


def _apply_wechat_config(data):
    """把请求中的微信相关配置写入 current_app.config（掩码值不覆盖真实密钥）。"""
    for data_key, cfg_key in _WECHAT_CONFIG_MAP.items():
        if data_key in data:
            val = data[data_key]
            if data_key.endswith("_secret") and val == _SECRET_MASK:
                continue
            current_app.config[cfg_key] = val


def _apply_sms_config(data):
    """把请求中的短信相关配置写入 current_app.config["SMS_CONFIG"]（掩码值不覆盖真实密钥）。"""
    sms_config = current_app.config.get("SMS_CONFIG", {})
    for data_key, cfg_key in _SMS_CONFIG_MAP.items():
        if data_key in data:
            val = data[data_key]
            if data_key.endswith("_secret") and val == _SECRET_MASK:
                continue
            sms_config[cfg_key] = val
    current_app.config["SMS_CONFIG"] = sms_config


def _persist_notification_config(data):
    """持久化到 notification_config 表（掩码值不落库，避免覆盖真实密钥）。"""
    from services.notification_config_store import save_notification_config

    updates = dict(data)
    if updates.get("wechat_secret") == _SECRET_MASK:
        updates.pop("wechat_secret", None)
    if updates.get("sms_access_key_secret") == _SECRET_MASK:
        updates.pop("sms_access_key_secret", None)
    save_notification_config(updates)