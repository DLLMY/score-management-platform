import json
import logging
from datetime import datetime

from flask import g, request
from flask_restx import Namespace, Resource, fields

from models import ScheduledNotify
from services.class_time_checker import ClassTimeChecker
from services.mqtt_service import publish_mqtt
from services.scheduled_notify_service import (
    _serialize_scheduled,
    cancel_scheduled_notify,
    create_scheduled_notify,
    delete_scheduled_notify,
    get_scheduled_detail_view,
    get_scheduled_list_view,
    record_scheduled_notify_sent,
    rollback_scheduled_session,
    update_scheduled_notify,
)
from utils.pagination import get_pagination
from utils.permission import has_permission, requires_permission
from utils.response import APIResponse

logger = logging.getLogger(__name__)


ns_scheduled_notify = Namespace("scheduled_notify", description="定时通知管理")
scheduled_model = ns_scheduled_notify.model(
    "ScheduledNotify",
    {
        "text": fields.String(required=True, description="通知文本"),
        "volume": fields.Float(default=0.7, description="音量"),
        "speak": fields.Boolean(default=True, description="语音播报"),
        "popup": fields.Boolean(default=True, description="弹窗显示"),
        "timeout_sec": fields.Integer(default=8, description="弹窗超时时间"),
        "urgent": fields.Boolean(default=False, description="紧急通知"),
        "send_mode": fields.String(default="broadcast", description="发送模式"),
        "device_id": fields.String(description="设备ID"),
        "scheduled_at": fields.String(required=True, description="定时发送时间"),
        "repeat_type": fields.String(default="once", description="重复类型"),
        "repeat_interval": fields.Integer(default=1, description="重复间隔"),
        "repeat_end_at": fields.String(description="重复结束时间"),
    },
)


@ns_scheduled_notify.route("/")
class ScheduledList(Resource):
    @ns_scheduled_notify.doc("list_scheduled")
    @ns_scheduled_notify.param("page", "Page number (default 1)")
    @ns_scheduled_notify.param("per_page", "Items per page (default 50)")
    @requires_permission("notification.send")
    def get(self):
        """获取定时通知列表（分页）"""
        page, per_page = get_pagination(default=50)
        return APIResponse.success(get_scheduled_list_view(page, per_page))

    @ns_scheduled_notify.expect(scheduled_model)
    @requires_permission("notification.send")
    def post(self):
        """创建定时通知"""
        data = ns_scheduled_notify.payload
        # 从 token 获取当前管理员，避免审计链丢失真实责任人；无 token 时兜底种子管理员
        _admin_id = (
            getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        )
        notify = create_scheduled_notify(data, _admin_id)
        return {
            "success": True,
            "message": "定时通知已创建",
            "id": notify.id,
        }


@ns_scheduled_notify.route("/<int:id>")
@ns_scheduled_notify.doc(params={"id": "定时通知ID"})
class ScheduledDetail(Resource):
    @ns_scheduled_notify.doc("get_scheduled")
    @requires_permission("notification.send")
    def get(self, id):
        """获取单个定时通知详情"""
        return _serialize_scheduled(get_scheduled_detail_view(id))

    @ns_scheduled_notify.expect(scheduled_model)
    @requires_permission("notification.send")
    def put(self, id):
        """更新定时通知"""
        notify = ScheduledNotify.query.get_or_404(id)
        data = ns_scheduled_notify.payload
        update_scheduled_notify(notify, data)
        return APIResponse.success(message="定时通知已更新")

    @requires_permission("notification.send")
    def delete(self, id):
        """删除定时通知"""
        notify = ScheduledNotify.query.get_or_404(id)
        delete_scheduled_notify(notify)
        return APIResponse.success(message="定时通知已删除")


@ns_scheduled_notify.route("/<int:id>/cancel")
@ns_scheduled_notify.doc(params={"id": "定时通知ID"})
class ScheduledCancel(Resource):
    @requires_permission("notification.send")
    def post(self, id):
        """取消定时通知"""
        notify = ScheduledNotify.query.get_or_404(id)
        cancel_scheduled_notify(notify)
        return APIResponse.success(message="定时通知已取消")


@ns_scheduled_notify.route("/<int:id>/trigger")
@ns_scheduled_notify.doc(params={"id": "定时通知ID"})
class ScheduledTrigger(Resource):
    @requires_permission("notification.send")
    def post(self, id):
        """立即触发定时通知（支持 force_send 强制发送，需 notification.force_send 权限）"""
        notify = ScheduledNotify.query.get_or_404(id)
        _body = request.get_json(silent=True) or {}
        force_send = bool(_body.get("force_send", False))
        _admin_id = (
            getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        )
        if force_send and not has_permission(g.current_user, "notification.force_send"):
            return APIResponse.error(message="无强制发送权限（需 notification.force_send）")
        message = {
            "text": notify.text,
            "volume": notify.volume,
            "speak": notify.speak,
            "popup": notify.popup,
            "timeout_sec": notify.timeout_sec,
            "urgent": notify.urgent,
            "timestamp": datetime.now().isoformat(),
        }
        topics = _st_build_notify_topics(notify)
        cls_id, allowed, check_message, reason_code = _st_check_notify_allowed(notify, force_send)
        if not allowed:
            ClassTimeChecker.log_notify_audit(
                "scheduled_notify",
                cls_id,
                _admin_id,
                {"id": id},
                reason_code or "GLOBAL_TIME_RULE",
                check_message,
                force_send=False,
            )
            return APIResponse.error(message=f"上课时间，定时通知已暂停: {check_message}")
        if force_send:
            ClassTimeChecker.log_notify_audit(
                "scheduled_notify",
                cls_id,
                _admin_id,
                {"id": id},
                "FORCE",
                "强制触发定时通知",
                force_send=True,
            )

        try:
            publish_results = _st_publish_notify_topics(topics, message)
            if not all(ok for _, ok in publish_results):
                rollback_scheduled_session()
                failed_topics = [t for t, ok in publish_results if not ok]
                return APIResponse.error(
                    message=f"MQTT发布失败（设备未连接），未标记已发送: {failed_topics}"
                )
            record_scheduled_notify_sent(notify, topics)
            return APIResponse.success(message="通知已发送")
        except Exception as e:
            rollback_scheduled_session()  # 失败回滚，避免脏 session 污染后续请求
            logger.error("%s: %s", "发送失败", e, exc_info=True)
            return APIResponse.error(message="发送失败")
def _st_build_notify_topics(notify):
    """根据发送模式构造 MQTT topic 列表（保留原分支语义）。"""
    if notify.send_mode == "broadcast":
        return ["phonebox/remote/notify", "phonebox/remote/notify/all"]
    if notify.send_mode == "device" and notify.device_id:
        return [f"phonebox/remote/notify/{notify.device_id}"]
    return ["phonebox/remote/notify"]


def _st_check_notify_allowed(notify, force_send):
    """上课时间拦截判定（广播按全校；指定设备按班级课表反查）。"""
    cls_id = (
        ClassTimeChecker.resolve_class_from_device(notify.device_id)
        if (notify.send_mode == "device" and notify.device_id)
        else None
    )
    if cls_id:
        allowed, check_message, reason_code, _ = ClassTimeChecker.is_notification_allowed(
            target_class_info_id=cls_id, force_send=force_send
        )
    else:
        blocked, check_message, reason_code = ClassTimeChecker.is_broadcast_blocked(
            force_send=force_send
        )
        allowed = not blocked
    return cls_id, allowed, check_message, reason_code


def _st_publish_notify_topics(topics, message):
    """逐 topic 发布通知，任一失败即记录 False（MQTT 断连诚实报错）。"""
    publish_results = []
    for topic in topics:
        try:
            ok = publish_mqtt(topic, json.dumps(message))
        except Exception:
            ok = False
        publish_results.append((topic, bool(ok)))
    return publish_results