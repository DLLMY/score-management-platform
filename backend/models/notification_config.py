from datetime import datetime
from models import db


class NotificationConfig(db.Model):
    """通知配置（单行持久化，id 固定为 1）。

    解决原实现将微信/短信配置写入 current_app.config 内存导致重启丢失的问题：
    运行时仍同步进 current_app.config（NotificationService/routes 读取逻辑不变），
    写入时同时落库本表；应用启动时再从本表回灌 config。
    """

    __tablename__ = "notification_config"

    id = db.Column(db.Integer, primary_key=True)
    # 微信
    wechat_appid = db.Column(db.String(200))
    wechat_secret = db.Column(db.String(200))
    template_unlock_success = db.Column(db.String(100))
    template_unlock_failure = db.Column(db.String(100))
    template_score_change = db.Column(db.String(100))
    # 短信
    sms_provider = db.Column(db.String(50))
    sms_access_key_id = db.Column(db.String(200))
    sms_access_key_secret = db.Column(db.String(200))
    sms_sign_name = db.Column(db.String(100))
    sms_template_code = db.Column(db.String(100))
    # 开关
    enable_wechat_notification = db.Column(db.Boolean, default=True)
    enable_sms_notification = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    def to_config_dict(self):
        """将本行映射为 current_app.config 中的配置键值（与旧内存实现键名一致）。"""
        return {
            "WECHAT_APPID": self.wechat_appid,
            "WECHAT_SECRET": self.wechat_secret,
            "WECHAT_TEMPLATE_UNLOCK_SUCCESS": self.template_unlock_success,
            "WECHAT_TEMPLATE_UNLOCK_FAILURE": self.template_unlock_failure,
            "WECHAT_TEMPLATE_SCORE_CHANGE": self.template_score_change,
            "SMS_CONFIG": {
                "provider": self.sms_provider,
                "access_key_id": self.sms_access_key_id,
                "access_key_secret": self.sms_access_key_secret,
                "sign_name": self.sms_sign_name,
                "template_code": self.sms_template_code,
            },
            "ENABLE_WECHAT_NOTIFICATION": self.enable_wechat_notification,
            "ENABLE_SMS_NOTIFICATION": self.enable_sms_notification,
        }
