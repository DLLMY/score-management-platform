from flask_restx import Namespace, Resource, fields
from flask import request, g
from models import db, ScheduledNotify, NotifyHistory, Device
from utils.permission import requires_permission, has_permission
from utils.logger import log_operation
from datetime import datetime, timedelta
from services.mqtt_service import publish_mqtt
from services.class_time_checker import ClassTimeChecker
from utils.response import APIResponse
import json
import logging

logger = logging.getLogger(__name__)

def _resolve_class_from_device(device_id):
    if not device_id:
        return None
    try:
        dev = Device.query.filter_by(device_id=str(device_id)).first()
        if dev and dev.class_info_id:
            return dev.class_info_id
    except Exception as e:
        # 反查失败会导致上课时间拦截按"无班级"放行，须留痕
        logger.warning(f"设备班级反查失败(device_id={device_id}): {e}")
    return None


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
    @requires_permission("notification.send")
    def get(self):
        """获取定时通知列表"""
        scheduled = ScheduledNotify.query.order_by(ScheduledNotify.scheduled_at).all()
        return [
            {
                "id": s.id,
                "text": s.text,
                "volume": s.volume,
                "speak": s.speak,
                "popup": s.popup,
                "timeout_sec": s.timeout_sec,
                "urgent": s.urgent,
                "send_mode": s.send_mode,
                "device_id": s.device_id,
                "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
                "repeat_type": s.repeat_type,
                "repeat_interval": s.repeat_interval,
                "repeat_day_of_week": json.loads(s.repeat_day_of_week) if s.repeat_day_of_week else [],
                "repeat_end_at": s.repeat_end_at.isoformat() if s.repeat_end_at else None,
                "status": s.status,
                "last_sent_at": s.last_sent_at.isoformat() if s.last_sent_at else None,
                "next_send_at": s.next_send_at.isoformat() if s.next_send_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in scheduled
        ]

    @ns_scheduled_notify.expect(scheduled_model)
    @requires_permission("notification.send")
    def post(self):
        """创建定时通知"""
        data = ns_scheduled_notify.payload
        scheduled_at = datetime.fromisoformat(data.get("scheduled_at"))
        # 从 token 获取当前管理员，避免审计链丢失真实责任人；无 token 时兜底种子管理员
        _admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        notify = ScheduledNotify(
            text=data.get("text"),
            volume=data.get("volume", 0.7),
            speak=data.get("speak", True),
            popup=data.get("popup", True),
            timeout_sec=data.get("timeout_sec", 8),
            urgent=data.get("urgent", False),
            send_mode=data.get("send_mode", "broadcast"),
            device_id=data.get("device_id"),
            scheduled_at=scheduled_at,
            repeat_type=data.get("repeat_type", "once"),
            repeat_interval=data.get("repeat_interval", 1),
            repeat_day_of_week=(
                json.dumps(data.get("repeat_day_of_week", [])) if data.get("repeat_day_of_week") else None
            ),
            repeat_end_at=datetime.fromisoformat(data.get("repeat_end_at")) if data.get("repeat_end_at") else None,
            next_send_at=scheduled_at,
            status="pending",
            created_by=_admin_id or 1,
        )
        db.session.add(notify)
        db.session.commit()
        log_operation(
            "scheduled_notify.create",
            "scheduled_notify",
            notify.id,
            f"创建定时通知: {notify.text[:30]}",
            after_data=data,
        )
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
        notify = ScheduledNotify.query.get_or_404(id)
        return {
            "id": notify.id,
            "text": notify.text,
            "volume": notify.volume,
            "speak": notify.speak,
            "popup": notify.popup,
            "timeout_sec": notify.timeout_sec,
            "urgent": notify.urgent,
            "send_mode": notify.send_mode,
            "device_id": notify.device_id,
            "scheduled_at": notify.scheduled_at.isoformat() if notify.scheduled_at else None,
            "repeat_type": notify.repeat_type,
            "repeat_interval": notify.repeat_interval,
            "repeat_day_of_week": json.loads(notify.repeat_day_of_week) if notify.repeat_day_of_week else [],
            "repeat_end_at": notify.repeat_end_at.isoformat() if notify.repeat_end_at else None,
            "status": notify.status,
            "last_sent_at": notify.last_sent_at.isoformat() if notify.last_sent_at else None,
            "next_send_at": notify.next_send_at.isoformat() if notify.next_send_at else None,
            "created_at": notify.created_at.isoformat() if notify.created_at else None,
        }

    @ns_scheduled_notify.expect(scheduled_model)
    @requires_permission("notification.send")
    def put(self, id):
        """更新定时通知"""
        notify = ScheduledNotify.query.get_or_404(id)
        data = ns_scheduled_notify.payload
        notify.text = data.get("text", notify.text)
        notify.volume = data.get("volume", notify.volume)
        notify.speak = data.get("speak", notify.speak)
        notify.popup = data.get("popup", notify.popup)
        notify.timeout_sec = data.get("timeout_sec", notify.timeout_sec)
        notify.urgent = data.get("urgent", notify.urgent)
        notify.send_mode = data.get("send_mode", notify.send_mode)
        notify.device_id = data.get("device_id", notify.device_id)
        notify.scheduled_at = (
            datetime.fromisoformat(data.get("scheduled_at")) if data.get("scheduled_at") else notify.scheduled_at
        )
        notify.repeat_type = data.get("repeat_type", notify.repeat_type)
        notify.repeat_interval = data.get("repeat_interval", notify.repeat_interval)
        notify.repeat_end_at = (
            datetime.fromisoformat(data.get("repeat_end_at")) if data.get("repeat_end_at") else notify.repeat_end_at
        )
        notify.next_send_at = notify.scheduled_at
        notify.status = "pending"
        notify.updated_at = datetime.now()
        db.session.commit()
        return APIResponse.success(message="定时通知已更新")

    @requires_permission("notification.send")
    def delete(self, id):
        """删除定时通知"""
        notify = ScheduledNotify.query.get_or_404(id)
        db.session.delete(notify)
        db.session.commit()
        return APIResponse.success(message="定时通知已删除")


@ns_scheduled_notify.route("/<int:id>/cancel")
@ns_scheduled_notify.doc(params={"id": "定时通知ID"})
class ScheduledCancel(Resource):
    @requires_permission("notification.send")
    def post(self, id):
        """取消定时通知"""
        notify = ScheduledNotify.query.get_or_404(id)
        notify.status = "cancelled"
        db.session.commit()
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
        _admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
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
        topics = []
        if notify.send_mode == "broadcast":
            topics = ["phonebox/remote/notify", "phonebox/remote/notify/all"]
        elif notify.send_mode == "device" and notify.device_id:
            topics = [f"phonebox/remote/notify/{notify.device_id}"]
        else:
            topics = ["phonebox/remote/notify"]
        # 上课时间拦截（广播按全校+任意班级；指定设备按班级课表反查）
        cls_id = _resolve_class_from_device(notify.device_id) if (notify.send_mode == "device" and notify.device_id) else None
        if cls_id:
            allowed, check_message, reason_code, _ = ClassTimeChecker.is_notification_allowed(
                target_class_info_id=cls_id, force_send=force_send
            )
        else:
            blocked, check_message, reason_code = ClassTimeChecker.is_broadcast_blocked(force_send=force_send)
            allowed = not blocked
        if not allowed:
            ClassTimeChecker.log_notify_audit(
                "scheduled_notify", cls_id, _admin_id, {"id": id}, reason_code or "GLOBAL_TIME_RULE",
                check_message, force_send=False,
            )
            return APIResponse.error(message=f"上课时间，定时通知已暂停: {check_message}")
        if force_send:
            ClassTimeChecker.log_notify_audit(
                "scheduled_notify", cls_id, _admin_id, {"id": id}, "FORCE", "强制触发定时通知", force_send=True
            )

        try:
            # publish 结果校验：MQTT 断连时返回 False。此前忽略返回值 →
            # 失败也提示"通知已发送"+ 标 sent（假状态）。任一 topic 失败即诚实报错。
            publish_results = []
            for topic in topics:
                try:
                    ok = publish_mqtt(topic, json.dumps(message))
                except Exception as e:  # noqa: BLE001
                    ok = False
                publish_results.append((topic, bool(ok)))
            if not all(ok for _, ok in publish_results):
                db.session.rollback()
                failed_topics = [t for t, ok in publish_results if not ok]
                return APIResponse.error(message=f"MQTT发布失败（设备未连接），未标记已发送: {failed_topics}")
            notify.last_sent_at = datetime.now()
            if notify.repeat_type == "once":
                notify.status = "sent"
            else:
                notify.next_send_at = calculate_next_send(notify)
            history = NotifyHistory(
                text=notify.text,
                volume=notify.volume,
                speak=notify.speak,
                popup=notify.popup,
                timeout_sec=notify.timeout_sec,
                urgent=notify.urgent,
                send_mode=notify.send_mode,
                device_id=notify.device_id,
                topic=",".join(topics),
                status="sent",
                sent_by=1,
            )
            db.session.add(history)
            db.session.commit()
            return APIResponse.success(message="通知已发送")
        except Exception as e:
            db.session.rollback()  # 失败回滚，避免脏 session 污染后续请求
            return APIResponse.error(message=f"发送失败: {str(e)}")


def calculate_next_send(notify):
    """计算下次发送时间"""
    now = datetime.now()
    if notify.repeat_type == "daily":
        next_time = notify.scheduled_at + timedelta(days=notify.repeat_interval)
    elif notify.repeat_type == "weekly":
        if notify.repeat_day_of_week:
            try:
                day_of_week_list = json.loads(notify.repeat_day_of_week)
            except Exception:
                day_of_week_list = []
            if day_of_week_list:
                # 星期统一 0 基（0=周一…6=周日，与时间规则/话机策略一致）
                current_weekday = now.weekday()
                hours = notify.scheduled_at.hour
                minutes = notify.scheduled_at.minute
                days_ahead = []
                for day in day_of_week_list:
                    if day > current_weekday:
                        days_ahead.append(day - current_weekday)
                    else:
                        days_ahead.append(day - current_weekday + 7)
                days_ahead = sorted(days_ahead)
                next_day_offset = days_ahead[0]
                next_time = now.replace(hour=hours, minute=minutes, second=0, microsecond=0) + timedelta(
                    days=next_day_offset
                )
            else:
                next_time = notify.scheduled_at + timedelta(weeks=notify.repeat_interval)
        else:
            next_time = notify.scheduled_at + timedelta(weeks=notify.repeat_interval)
    elif notify.repeat_type == "monthly":
        next_time = notify.scheduled_at + timedelta(days=30 * notify.repeat_interval)
    else:
        return None
    if notify.repeat_end_at and next_time > notify.repeat_end_at:
        return None
    return next_time


def process_scheduled_notifications():
    """处理到期的定时通知（定时任务调用）"""
    now = datetime.now()
    pending_notifications = ScheduledNotify.query.filter(
        ScheduledNotify.status == "pending",
        ScheduledNotify.next_send_at <= now,
    ).all()
    for notify in pending_notifications:
        try:
            message = {
                "text": notify.text,
                "volume": notify.volume,
                "speak": notify.speak,
                "popup": notify.popup,
                "timeout_sec": notify.timeout_sec,
                "urgent": notify.urgent,
                "timestamp": datetime.now().isoformat(),
            }
            topics = []
            if notify.send_mode == "broadcast":
                topics = ["phonebox/remote/notify", "phonebox/remote/notify/all"]
            elif notify.send_mode == "device" and notify.device_id:
                topics = [f"phonebox/remote/notify/{notify.device_id}"]
            else:
                topics = ["phonebox/remote/notify"]
            # 上课时间拦截（执行那一刻才判）：广播按全校+任意班级；指定设备按班级课表
            cls_id = _resolve_class_from_device(notify.device_id) if (notify.send_mode == "device" and notify.device_id) else None
            if cls_id:
                allowed, _, reason_code, _ = ClassTimeChecker.is_notification_allowed(
                    target_class_info_id=cls_id, force_send=False
                )
            else:
                blocked, _, reason_code = ClassTimeChecker.is_broadcast_blocked(force_send=False)
                allowed = not blocked
            if not allowed:
                ClassTimeChecker.log_notify_audit(
                    "scheduled_notify", cls_id, None, {"id": notify.id},
                    reason_code or "GLOBAL_TIME_RULE", "上课时间，定时通知跳过发送", force_send=False,
                )
                continue  # 保持 pending，待非上课时段重试

            # publish 结果校验：MQTT 断连时 publish_mqtt 返回 False。
            # 此前忽略返回值 → 失败也标 sent + NotifyHistory=sent（假状态）。
            # 任一 topic 失败：不更新 last_sent_at/status，保持 pending 待下轮重试。
            publish_results = []
            for topic in topics:
                try:
                    ok = publish_mqtt(topic, json.dumps(message))
                except Exception as e:  # noqa: BLE001
                    ok = False
                publish_results.append((topic, bool(ok)))
            if not all(ok for _, ok in publish_results):
                failed_topics = [t for t, ok in publish_results if not ok]
                print(f"定时通知(id={notify.id}) MQTT发布失败，保持pending待重试: {failed_topics}")
                continue

            notify.last_sent_at = datetime.now()
            if notify.repeat_type == "once":
                notify.status = "sent"
            else:
                next_time = calculate_next_send(notify)
                if next_time:
                    notify.next_send_at = next_time
                else:
                    notify.status = "sent"
            history = NotifyHistory(
                text=notify.text,
                volume=notify.volume,
                speak=notify.speak,
                popup=notify.popup,
                timeout_sec=notify.timeout_sec,
                urgent=notify.urgent,
                send_mode=notify.send_mode,
                device_id=notify.device_id,
                topic=",".join(topics),
                status="sent",
                sent_by=1,
            )
            db.session.add(history)
        except Exception:
            db.session.rollback()  # 单条失败回滚，避免脏 session 影响下一条与最终 commit
            notify.status = "failed"
    db.session.commit()
