import logging
import requests
import json
from datetime import datetime
from typing import Optional, Dict, List
from flask import current_app
from utils.db_session import db_session_scope
from models import db, Notification, User

logger = logging.getLogger(__name__)


class NotificationService:
    WECHAT_TEMPLATE_URL = "https://api.weixin.qq.com/cgi-bin/message/template/send"

    @staticmethod
    def send_wechat_notification(user_id: int, template_id: str, data: Dict, jump_url: Optional[str] = None) -> Dict:
        """
        发送微信模板消息

        Args:
            user_id: 用户ID
            template_id: 模板消息ID
            data: 模板数据 {key: {value: xxx, color: xxx}}
            jump_url: 点击跳转的URL

        Returns:
            发送结果
        """
        try:
            from models import db, User, OperationLog, get_by_id

            user = get_by_id(User, user_id)
            if not user:
                return {"success": False, "message": "用户不存在"}

            if not user.parent_info:
                return {"success": False, "message": "家长openid不存在"}

            access_token = NotificationService._get_wechat_access_token()
            if not access_token:
                return {"success": False, "message": "获取access_token失败"}

            parent_info = json.loads(user.parent_info) if user.parent_info else {}
            openid = parent_info.get("openid")

            if not openid:
                return {"success": False, "message": "家长openid不存在"}

            message = {"touser": openid, "template_id": template_id, "data": data}

            if jump_url:
                message["url"] = jump_url

            response = requests.post(
                f"{NotificationService.WECHAT_TEMPLATE_URL}?access_token={access_token}", json=message, timeout=10
            )

            result = response.json()

            if result.get("errcode") == 0:
                log = OperationLog(
                    operation_type="wechat_notify",
                    target_type="user",
                    target_id=user_id,
                    operator="System",
                    description=f"微信模板消息发送成功: {template_id}",
                )
                db.session.add(log)
                db.session.commit()

                return {"success": True, "message": "发送成功", "msgid": result.get("msgid")}
            else:
                return {"success": False, "message": result.get("errmsg")}

        except Exception as e:
            logger.error(f"send_wechat_notification failed: {e}")
            return {"success": False, "message": str(e)}

    @staticmethod
    def _get_wechat_access_token() -> Optional[str]:
        try:
            appid = current_app.config.get("WECHAT_APPID")
            secret = current_app.config.get("WECHAT_SECRET")

            if not appid or not secret:
                return None

            url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={appid}&secret={secret}"
            response = requests.get(url, timeout=10)
            result = response.json()

            if "access_token" in result:
                return result["access_token"]
            return None

        except Exception as e:
            logger.error(f"_get_wechat_access_token failed: {e}")
            return None

    @staticmethod
    def send_sms_notification(phone: str, message: str) -> Dict:
        """
        发送短信通知

        Args:
            phone: 手机号
            message: 短信内容

        Returns:
            发送结果
        """
        try:

            sms_config = current_app.config.get("SMS_CONFIG")
            if not sms_config:
                return {"success": False, "message": "短信服务未配置"}

            if sms_config.get("provider") == "aliyun":
                return NotificationService._send_aliyun_sms(phone, message, sms_config)
            else:
                # P2-3 修复: 移除腾讯云 stub 分支（产品配置层无腾讯云凭据字段，该渠道不可达）；
                # 统一由下方兜底报错，避免"腾讯云短信功能待实现"误导
                return {"success": False, "message": "不支持的短信提供商（当前仅支持 aliyun，请设置 SMS_PROVIDER=aliyun）"}

        except Exception as e:
            logger.error(f"notification_service error: {e}")
            return {"success": False, "message": str(e)}

    @staticmethod
    def _send_aliyun_sms(phone: str, message: str, config: Dict) -> Dict:
        try:
            import uuid
            from datetime import timezone

            access_key_id = config.get("access_key_id")
            access_key_secret = config.get("access_key_secret")
            sign_name = config.get("sign_name")
            template_code = config.get("template_code")

            if not all([access_key_id, access_key_secret, sign_name, template_code]):
                return {"success": False, "message": "阿里云短信配置不完整"}

            params = {"message": message[:20]}

            import hashlib

            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            params_str = json.dumps(params)
            sorted_params = sorted(
                [
                    ("AccessKeyId", access_key_id),
                    ("Action", "SendSms"),
                    ("Format", "JSON"),
                    ("PhoneNumbers", phone),
                    ("SignName", sign_name),
                    ("SignatureMethod", "HMAC-SHA1"),
                    ("SignatureNonce", str(uuid.uuid4())),
                    ("SignatureVersion", "1.0"),
                    ("TemplateCode", template_code),
                    ("TemplateParam", params_str),
                    ("Timestamp", timestamp),
                    ("Version", "2017-05-25"),
                ]
            )

            canonicalized = "&".join([f"{k}={requests.utils.quote(v)}" for k, v in sorted_params])
            string_to_sign = f'GET&{requests.utils.quote("/")}&{requests.utils.quote(canonicalized)}'

            signature = hashlib.hmac.new(
                f"{access_key_secret}&".encode(), string_to_sign.encode(), hashlib.sha1
            ).b64decode()
            signature = requests.utils.quote(signature)

            url = f"https://dysmsapi.aliyuncs.com/?Signature={signature}{canonicalized}"

            response = requests.get(url, timeout=10)
            result = response.json()

            if result.get("Code") == "OK":
                return {"success": True, "message": "发送成功", "biz_id": result.get("BizId")}
            else:
                return {"success": False, "message": result.get("Message")}

        except Exception as e:
            logger.error(f"notification_service error: {e}")
            return {"success": False, "message": str(e)}


def notify_unlock_success(user_id: int, box: str, device_name: str) -> Dict:
    """
    发送开锁成功通知给家长
    """
    try:
        from models import User, get_by_id

        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "message": "用户不存在"}

        template_id = current_app.config.get("WECHAT_TEMPLATE_UNLOCK_SUCCESS")
        if not template_id:
            return {"success": False, "message": "模板ID未配置"}

        data = {
            "first": {"value": f"您的孩子 {user.name} 已取出手机", "color": "#173177"},
            "keyword1": {"value": device_name, "color": "#173177"},
            "keyword2": {"value": box, "color": "#173177"},
            "keyword3": {"value": datetime.now().strftime("%Y-%m-%d %H:%M"), "color": "#173177"},
            "remark": {"value": "如有疑问请联系班主任", "color": "#999999"},
        }

        return NotificationService.send_wechat_notification(user_id, template_id, data)

    except Exception as e:
        logger.error(f"notify_unlock_success failed: {e}")
        return {"success": False, "message": str(e)}


def notify_unlock_failure(user_id: int, reason: str, score: int) -> Dict:
    """
    发送开锁失败通知给家长
    """
    try:
        from models import User, get_by_id

        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "message": "用户不存在"}

        reason_text = {
            "score_low": "积分不足",
            "daily_limit_exceeded": "今日开锁次数已用完",
            "not_in_time_window": "非规定时间段",
            "user_blacklisted": "账号异常",
        }.get(reason, reason)

        template_id = current_app.config.get("WECHAT_TEMPLATE_UNLOCK_FAILURE")
        if not template_id:
            return {"success": False, "message": "模板ID未配置"}

        data = {
            "first": {"value": f"您的孩子 {user.name} 开锁失败", "color": "#FF0000"},
            "keyword1": {"value": reason_text, "color": "#FF0000"},
            "keyword2": {"value": f"{score}分", "color": "#FF0000"},
            "keyword3": {"value": "60分", "color": "#173177"},
            "remark": {"value": "请引导孩子遵守手机使用规定", "color": "#999999"},
        }

        return NotificationService.send_wechat_notification(user_id, template_id, data)

    except Exception as e:
        logger.error(f"notification helper failed: {e}")
        return {"success": False, "message": str(e)}


def notify_score_change(user_id: int, change: int, reason: str) -> Dict:
    """
    发送积分变动通知
    """
    try:
        from models import User, get_by_id

        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "message": "用户不存在"}

        template_id = current_app.config.get("WECHAT_TEMPLATE_SCORE_CHANGE")
        if not template_id:
            return {"success": False, "message": "模板ID未配置"}

        change_text = f"+{change}" if change > 0 else str(change)

        data = {
            "first": {"value": "积分变动提醒", "color": "#173177"},
            "keyword1": {"value": user.name, "color": "#173177"},
            "keyword2": {"value": change_text, "color": "#FF6600" if change < 0 else "#009900"},
            "keyword3": {"value": reason, "color": "#173177"},
            "keyword4": {"value": f"{user.current_score}分", "color": "#173177"},
            "remark": {"value": "如有疑问请联系班主任", "color": "#999999"},
        }

        return NotificationService.send_wechat_notification(user_id, template_id, data)

    except Exception as e:
        logger.error(f"notification_service error: {e}")
        return {"success": False, "message": str(e)}


def notify_device_offline(device_id: str, device_name: str, admin_ids: List[int]) -> Dict:
    """
    发送设备离线告警给管理员
    """
    try:
        from models import Admin, get_by_id

        results = []
        for admin_id in admin_ids:
            admin = get_by_id(Admin, admin_id)
            if not admin or not admin.phone:
                continue

            message = f"设备 [{device_name}] ({device_id}) 已离线，请及时检查"

            result = NotificationService.send_sms_notification(admin.phone, message)
            results.append({"admin_id": admin_id, "result": result})

        return {"success": True, "results": results}

    except Exception as e:
        logger.error(f"notification_service error: {e}")
        return {"success": False, "message": str(e)}


# ============================================================================
# F17 防腐层：notifications 域 DB-CRUD 模块（写入/事务收口）
# ----------------------------------------------------------------------------
# 仅收口 notifications_routes 中 6 个写入路径的 db.session 操作；路由保留：
# - get_or_404（404 语义）
# - 请求级校验（title/content 非空、user_ids/class_id 至少一、空参数 400）
# - 权限/时段拦截（force_send 权限、ClassTimeChecker 上课时段拦截）
# - 数据隔离（班级过滤由路由 join User 完成）
# - 响应构造
# 所有函数逐字节复刻原路由事务逻辑，行为完全等价；只读 query 暂缓不动。
# 注：Notification.recipient_type 默认 "user"，写入路径不显式设也落 "user"（契约兼容）。
# ============================================================================


def create_user_notification(data):
    """创建用户通知并落库。返回新建的 Notification 对象。

    校验（user_id 非空等）由路由负责，service 只做写入。
    """
    notification = Notification(
        student_id=data.get("user_id"),
        title=data.get("title"),
        content=data.get("content"),
        type=data.get("type", "info"),
        phone=data.get("phone"),
    )
    db.session.add(notification)
    db.session.commit()
    return notification


def create_approval_result_notification(user_id, title, content):
    """审批结果写入学生通知中心（recipient_type='user', status='sent'）。

    与审批路由原内联 Notification(...) + commit/rollback 行为完全等价；
    F17 防腐层：该写入路径从 approvals_routes 收口至此，路由仅保留跨切面副作用
    （MQTT/缓存/管理员通知）与响应构造。异常由路由 try/except 吞掉，不阻断审批主流程。
    """
    notification = Notification(
        student_id=user_id,
        type="approval_result",
        title=title,
        content=content,
        status="sent",
        recipient_type="user",
    )
    db.session.add(notification)
    db.session.commit()
    return notification


def update_notification(notification, data):
    """更新通知字段并提交。

    status 置为 sent 且原 sent_at 为空时自动补 sent_at（与原路由一致）。
    """
    notification.title = data.get("title", notification.title)
    notification.content = data.get("content", notification.content)
    notification.type = data.get("type", notification.type)
    notification.status = data.get("status", notification.status)
    if notification.status == "sent" and not notification.sent_at:
        notification.sent_at = datetime.now()
    db.session.commit()
    return None


def delete_notification(notification):
    """删除通知并提交。"""
    db.session.delete(notification)
    db.session.commit()
    return None


def mark_notification_read(notification):
    """标记通知为已读（status=read / is_read=True / read_at=now）并提交。"""
    notification.status = "read"
    notification.is_read = True
    notification.read_at = datetime.now()
    db.session.commit()
    return None


def send_notification(data):
    """单发通知并落库（status 直接置 sent、sent_at=now）。返回新建的 Notification 对象。

    校验（user_id/title/content 非空）由路由负责，service 只做写入。
    """
    notification = Notification(
        student_id=data.get("user_id"),
        title=data.get("title"),
        content=data.get("content"),
        type=data.get("type", "info"),
        status="sent",
        phone=data.get("phone"),
        sent_at=datetime.now(),
    )
    db.session.add(notification)
    db.session.commit()
    return notification


def batch_send_notifications(title, content, notify_type, target_ids):
    """群发通知的核心事务：逐条 savepoint 写入，单条失败仅回滚该条。

    入参 target_ids 已去重保序、且至少含一个有效 uid（解析与校验由路由负责）。
    返回元组 (sent, errors, total)：
        sent   - 成功条数
        errors - 失败明细列表 [{"user_id": int, "message": str}, ...]
        total  - 目标总数（=len(target_ids)）
    全部失败（sent==0）时路由据 errors 返回业务失败；部分成功返回成功信封。
    """
    sent = 0
    errors = []
    for uid in target_ids:
        try:
            # 每条独立 savepoint：单条 add/flush 失败仅回滚该条，不影响其他（避免整批 session 进入 failed 状态）
            with db.session.begin_nested():
                db.session.add(
                    Notification(
                        student_id=uid,
                        title=title,
                        content=content,
                        type=notify_type,
                        status="sent",
                        sent_at=datetime.now(),
                    )
                )
            sent += 1
        except Exception as e:  # noqa: BLE001
            errors.append({"user_id": uid, "message": str(e)})
    if sent:
        db.session.commit()
    return sent, errors, len(target_ids)
