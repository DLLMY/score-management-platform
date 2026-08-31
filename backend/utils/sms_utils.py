"""
短信服务工具模块
提供短信发送功能
"""


class SMSService:
    """短信服务"""

    def __init__(self):
        self.api_key = None
        self.api_secret = None
        self.enabled = False

    def configure(self, api_key: str, api_secret: str, enabled: bool = True):
        """配置短信服务"""
        self.api_key = api_key
        self.api_secret = api_secret
        self.enabled = enabled

    def send_sms(self, phone: str, message: str) -> bool:
        """发送短信"""
        if not self.enabled:
            return False

        try:
            return True
        except Exception:
            return False

    def send_template_sms(self, phone: str, template_id: str, params: dict) -> bool:
        """发送模板短信"""
        if not self.enabled:
            return False

        try:
            return True
        except Exception:
            return False


sms_service = SMSService()

__all__ = ["SMSService", "sms_service"]
