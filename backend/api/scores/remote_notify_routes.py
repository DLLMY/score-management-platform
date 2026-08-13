from flask_restx import Namespace, Resource, fields
from services.mqtt_service import publish_mqtt
from services.class_time_checker import ClassTimeChecker
from utils.permission import requires_permission, has_permission
from models import Device
from flask import g
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

ns_remote_notify = Namespace("remote_notify", description="远程通知相关操作")

# 通知消息模型
notify_model = ns_remote_notify.model(
    "RemoteNotify",
    {
        "text": fields.String(required=True, description="通知文本内容"),
        "type": fields.String(
            description="通知类型: normal(普通), score_change(积分变化), class_reminder(课程提醒)",
            enum=["normal", "score_change", "class_reminder"],
        ),
        "volume": fields.Float(description="系统音量 (0.0-1.0)", min=0.0, max=1.0),
        "speak": fields.Boolean(default=True, description="是否语音播报"),
        "popup": fields.Boolean(default=True, description="是否显示弹窗"),
        "timeout_sec": fields.Integer(default=8, description="弹窗自动关闭时间(秒)"),
        "urgent": fields.Boolean(default=False, description="是否紧急通知"),
        "topic": fields.String(default="phonebox/remote/notify", description="MQTT主题"),
        "force_send": fields.Boolean(
            default=False, description="是否强制发送（需 notification.force_send 权限，跳过上课时间检查）"
        ),
    },
)

notify_response = ns_remote_notify.model(
    "NotifyResponse",
    {
        "success": fields.Boolean(description="是否成功"),
        "message": fields.String(description="提示信息"),
        "topic": fields.String(description="发布的MQTT主题"),
        "timestamp": fields.String(description="发送时间"),
    },
)

# 积分变化通知模型
score_change_model = ns_remote_notify.model(
    "ScoreChangeNotify",
    {
        "student_name": fields.String(required=True, description="学生姓名"),
        "score_change": fields.Integer(required=True, description="积分变化（正数加分，负数扣分）"),
        "reason": fields.String(required=True, description="变动原因"),
        "course": fields.String(description="课程名称（可选）"),
        "device_id": fields.String(description="指定设备ID（可选，不指定则广播）"),
        "force_send": fields.Boolean(
            default=False, description="是否强制发送（需 notification.force_send 权限，跳过上课时间检查）"
        ),
    },
)


def _resolve_class_from_device(device_id):
    """根据设备ID（MQTT客户端标识）反查所属班级"""
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


def _block_if_not_allowed(force_send, target_class_info_id=None, broadcast=False,
                          audit_type="remote_notify", audit_payload=None):
    """
    统一上课时间拦截校验。
    返回 None 表示允许发送；返回 dict 表示应直接作为响应返回的拦截结果（topic 由调用方补全）。
    """
    if force_send and not has_permission(g.current_user, "notification.force_send"):
        return {
            "success": False,
            "message": "无强制发送权限（需 notification.force_send）",
            "topic": None,
            "timestamp": datetime.now().isoformat(),
        }

    if broadcast:
        blocked, message, reason_code = ClassTimeChecker.is_broadcast_blocked(force_send=force_send)
        allowed = not blocked
    else:
        allowed, message, reason_code, _ = ClassTimeChecker.is_notification_allowed(
            target_class_info_id=target_class_info_id, force_send=force_send
        )

    if not allowed:
        admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        ClassTimeChecker.log_notify_audit(
            audit_type,
            target_class_info_id,
            admin_id,
            audit_payload or {},
            reason_code or "GLOBAL_TIME_RULE",
            message,
            force_send=False,
        )
        return {
            "success": False,
            "message": message,
            "topic": None,
            "timestamp": datetime.now().isoformat(),
        }
    return None


def _log_force(audit_type, target_class_info_id, payload, note):
    admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
    ClassTimeChecker.log_notify_audit(
        audit_type, target_class_info_id, admin_id, payload or {}, "FORCE", note, force_send=True
    )


@ns_remote_notify.route("/send")
class RemoteNotifySend(Resource):

    @ns_remote_notify.expect(notify_model)
    @ns_remote_notify.marshal_with(notify_response)
    @requires_permission("notification.send")
    def post(self):
        """
        发送远程通知。需要通知发送权限。
        上课时间（全局 TimeRule 时段）系统自动通知会被拦截，可经 force_send 强制发送。
        """
        args = ns_remote_notify.payload
        force_send = args.get("force_send", False)

        blocked = _block_if_not_allowed(force_send, audit_type="remote_notify",
                                        audit_payload={"text": args.get("text")})
        if blocked is not None:
            blocked["topic"] = args.get("topic", "phonebox/remote/notify")
            return blocked

        message = {
            "text": args.get("text"),
            "type": args.get("type", "normal"),
            "volume": args.get("volume"),
            "speak": args.get("speak", True),
            "popup": args.get("popup", True),
            "timeout_sec": args.get("timeout_sec", 8),
            "urgent": args.get("urgent", False),
            "timestamp": datetime.now().isoformat(),
            "force_send": force_send,
        }
        message = {k: v for k, v in message.items() if v is not None}
        topic = args.get("topic", "phonebox/remote/notify")

        try:
            publish_mqtt(topic, json.dumps(message))
            if force_send:
                _log_force("remote_notify", None, {"text": args.get("text")}, "强制发送通知")
            return {
                "success": True,
                "message": "通知指令已发送",
                "topic": topic,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"发送失败: {str(e)}",
                "topic": topic,
                "timestamp": datetime.now().isoformat(),
            }


@ns_remote_notify.route("/broadcast")
class RemoteNotifyBroadcast(Resource):

    @ns_remote_notify.expect(notify_model)
    @ns_remote_notify.marshal_with(notify_response)
    @requires_permission("notification.send")
    def post(self):
        """
        广播通知到所有接收端。需要通知发送权限。
        上课时间（全局时段或任意班级在上课）会被拦截，可经 force_send 强制发送。
        """
        args = ns_remote_notify.payload
        force_send = args.get("force_send", False)

        blocked = _block_if_not_allowed(force_send, broadcast=True, audit_type="remote_notify",
                                        audit_payload={"text": args.get("text")})
        if blocked is not None:
            blocked["topic"] = ",".join(["phonebox/remote/notify", "phonebox/remote/notify/all", "remote/notify"])
            return blocked

        message = {
            "text": args.get("text"),
            "type": args.get("type", "normal"),
            "volume": args.get("volume"),
            "speak": args.get("speak", True),
            "popup": args.get("popup", True),
            "timeout_sec": args.get("timeout_sec", 8),
            "urgent": args.get("urgent", False),
            "timestamp": datetime.now().isoformat(),
            "force_send": force_send,
        }
        message = {k: v for k, v in message.items() if v is not None}
        message_json = json.dumps(message)
        topics = ["phonebox/remote/notify", "phonebox/remote/notify/all", "remote/notify"]

        try:
            for topic in topics:
                publish_mqtt(topic, message_json)
            if force_send:
                _log_force("remote_notify", None, {"text": args.get("text")}, "强制广播通知")
            return {
                "success": True,
                "message": f"已广播到 {len(topics)} 个主题",
                "topic": ",".join(topics),
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"发送失败: {str(e)}",
                "topic": ",".join(topics),
                "timestamp": datetime.now().isoformat(),
            }


@ns_remote_notify.route("/send_to_device/<device_id>")
@ns_remote_notify.doc(params={"device_id": "电脑客户端ID"})
class RemoteNotifySendToDevice(Resource):

    @ns_remote_notify.expect(notify_model)
    @ns_remote_notify.marshal_with(notify_response)
    @requires_permission("notification.send")
    def post(self, device_id):
        """
        向指定电脑客户端发送通知。需要通知发送权限。
        按设备反查班级，上课时间该班在上课会被拦截，可经 force_send 强制发送。
        """
        args = ns_remote_notify.payload
        force_send = args.get("force_send", False)
        cls_id = _resolve_class_from_device(device_id)

        blocked = _block_if_not_allowed(force_send, target_class_info_id=cls_id, audit_type="remote_notify",
                                        audit_payload={"device_id": device_id, "text": args.get("text")})
        if blocked is not None:
            blocked["topic"] = f"phonebox/remote/notify/{device_id}"
            return blocked

        message = {
            "text": args.get("text"),
            "type": args.get("type", "normal"),
            "volume": args.get("volume"),
            "speak": args.get("speak", True),
            "popup": args.get("popup", True),
            "timeout_sec": args.get("timeout_sec", 8),
            "urgent": args.get("urgent", False),
            "timestamp": datetime.now().isoformat(),
            "force_send": force_send,
        }
        message = {k: v for k, v in message.items() if v is not None}
        topic = f"phonebox/remote/notify/{device_id}"

        try:
            publish_mqtt(topic, json.dumps(message))
            if force_send:
                _log_force("remote_notify", cls_id, {"device_id": device_id}, f"强制发送（设备 {device_id}）")
            return {
                "success": True,
                "message": f"通知已发送到设备 {device_id}",
                "topic": topic,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"发送失败: {str(e)}",
                "topic": topic,
                "timestamp": datetime.now().isoformat(),
            }


@ns_remote_notify.route("/score_change")
class ScoreChangeNotify(Resource):

    @ns_remote_notify.expect(score_change_model)
    @ns_remote_notify.marshal_with(notify_response)
    @requires_permission("notification.send")
    def post(self):
        """
        发送积分变化通知。需要通知发送权限。
        按设备反查班级，上课时间该班在上课会被拦截，可经 force_send 强制发送。
        """
        args = ns_remote_notify.payload
        force_send = args.get("force_send", False)
        device_id = args.get("device_id")
        cls_id = _resolve_class_from_device(device_id)

        blocked = _block_if_not_allowed(force_send, target_class_info_id=cls_id, audit_type="score_change",
                                        audit_payload={"student_name": args.get("student_name"),
                                                       "device_id": device_id})
        if blocked is not None:
            topic = f"phonebox/remote/notify/{device_id}" if device_id else "phonebox/remote/notify"
            blocked["topic"] = topic
            return blocked

        text_parts = [
            f"学生:{args.get('student_name')}",
            f"{args.get('score_change', 0):+d}分",
            f"原因:{args.get('reason')}",
        ]
        if args.get("course"):
            text_parts.append(f"课程:{args.get('course')}")
        text = ", ".join(text_parts)

        message = {
            "type": "score_change",
            "text": text,
            "popup": True,
            "timestamp": datetime.now().isoformat(),
            "force_send": force_send,
        }
        topic = f"phonebox/remote/notify/{device_id}" if device_id else "phonebox/remote/notify"

        try:
            publish_mqtt(topic, json.dumps(message))
            if force_send:
                _log_force("score_change", cls_id, {"student_name": args.get("student_name")},
                           "强制发送积分变化通知")
            return {
                "success": True,
                "message": f"积分变化通知已发送: {args.get('student_name')} {args.get('score_change', 0):+d}分",
                "topic": topic,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"发送失败: {str(e)}",
                "topic": topic,
                "timestamp": datetime.now().isoformat(),
            }


@ns_remote_notify.route("/test")
class RemoteNotifyTest(Resource):

    @ns_remote_notify.expect(notify_model)
    @ns_remote_notify.marshal_with(notify_response)
    @requires_permission("notification.send")
    def post(self):
        """
        发送测试通知。需要通知发送权限。
        与其他下发路径一致：默认 force_send=False（上课时间会被拦截）。
        注意不要默认 True —— 那会让没有 notification.force_send 权限的用户被"无强制发送权限"直接挡住。
        """
        args = ns_remote_notify.payload or {}
        force_send = args.get("force_send", False)

        blocked = _block_if_not_allowed(force_send, audit_type="remote_notify",
                                        audit_payload={"text": args.get("text", "测试通知")})
        if blocked is not None:
            blocked["topic"] = "phonebox/remote/notify"
            return blocked

        message = {
            "text": args.get("text", "测试通知 - 远程通知系统工作正常！"),
            "volume": args.get("volume", 0.7),
            "speak": args.get("speak", True),
            "popup": args.get("popup", True),
            "timeout_sec": args.get("timeout_sec", 5),
            "urgent": args.get("urgent", False),
            "timestamp": datetime.now().isoformat(),
            "force_send": force_send,
        }
        message = {k: v for k, v in message.items() if v is not None}

        try:
            publish_mqtt("phonebox/remote/notify", json.dumps(message))
            if force_send:
                _log_force("remote_notify", None, {"text": args.get("text")}, "强制发送测试通知")
            return {
                "success": True,
                "message": "测试通知已发送",
                "topic": "phonebox/remote/notify",
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"测试失败: {str(e)}",
                "topic": "phonebox/remote/notify",
                "timestamp": datetime.now().isoformat(),
            }
