from flask_restx import Namespace, Resource, fields
from flask import g
from models import db, NotifyTemplate, NotifyHistory, Device
from services.class_time_checker import ClassTimeChecker
from utils.permission import requires_permission, has_permission
from utils.logger import log_operation
from datetime import datetime
from services.mqtt_service import publish_mqtt
from utils.response import APIResponse
import json

def _resolve_class_from_device(device_id):
    if not device_id:
        return None
    try:
        dev = Device.query.filter_by(device_id=str(device_id)).first()
        if dev and dev.class_info_id:
            return dev.class_info_id
    except Exception:
        pass
    return None


ns_notify_template = Namespace("notify_templates", description="通知模板管理")


def serialize_template(t):
    """统一序列化通知模板，处理 tags 字段的 JSON 转换"""
    tags_val = t.tags
    if isinstance(tags_val, str):
        try:
            tags_val = json.loads(tags_val)
        except (json.JSONDecodeError, ValueError):
            tags_val = []
    elif tags_val is None:
        tags_val = []
    return {
        "id": t.id,
        "name": t.name,
        "text": t.text,
        "volume": t.volume,
        "speak": t.speak,
        "popup": t.popup,
        "timeout_sec": t.timeout_sec,
        "urgent": t.urgent,
        "bg_color": t.bg_color,
        "text_color": t.text_color,
        "font_size": t.font_size,
        "language": t.language,
        "category": t.category,
        "tags": tags_val,
        "usage_count": t.usage_count,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


template_model = ns_notify_template.model(
    "NotifyTemplate",
    {
        "name": fields.String(required=True, description="模板名称"),
        "text": fields.String(required=True, description="通知文本"),
        "volume": fields.Float(default=0.7, description="音量"),
        "speak": fields.Boolean(default=True, description="语音播报"),
        "popup": fields.Boolean(default=True, description="弹窗显示"),
        "timeout_sec": fields.Integer(default=8, description="弹窗超时时间"),
        "urgent": fields.Boolean(default=False, description="紧急通知"),
        "bg_color": fields.String(default="#000000", description="背景颜色"),
        "text_color": fields.String(default="#FF0000", description="文字颜色"),
        "font_size": fields.Integer(default=48, description="字体大小"),
        "language": fields.String(default="zh", description="播报语言"),
        "category": fields.String(description="分类"),
        "tags": fields.List(fields.String, description="标签"),
    },
)
template_response = ns_notify_template.model(
    "TemplateResponse",
    {
        "id": fields.Integer(description="模板ID"),
        "name": fields.String(description="模板名称"),
        "text": fields.String(description="通知文本"),
        "volume": fields.Float(description="音量"),
        "speak": fields.Boolean(description="语音播报"),
        "popup": fields.Boolean(description="弹窗显示"),
        "timeout_sec": fields.Integer(description="弹窗超时时间"),
        "urgent": fields.Boolean(description="紧急通知"),
        "bg_color": fields.String(description="背景颜色"),
        "text_color": fields.String(description="文字颜色"),
        "font_size": fields.Integer(description="字体大小"),
        "language": fields.String(description="播报语言"),
        "category": fields.String(description="分类"),
        "tags": fields.List(fields.String, description="标签"),
        "usage_count": fields.Integer(description="使用次数"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.String(description="创建时间"),
    },
)


@ns_notify_template.route("/")
class TemplateList(Resource):
    @ns_notify_template.doc("list_templates")
    @ns_notify_template.marshal_list_with(template_response)
    @requires_permission("notification.view")
    def get(self):
        """获取所有模板列表"""
        templates = NotifyTemplate.query.filter_by(is_active=True).order_by(NotifyTemplate.usage_count.desc()).all()
        return [serialize_template(t) for t in templates]

    @ns_notify_template.expect(template_model)
    @ns_notify_template.marshal_with(template_response)
    @requires_permission("notification.send")
    def post(self):
        """创建新模板"""
        data = ns_notify_template.payload
        # tags 字段需要转换为 JSON 字符串存储
        tags_val = data.get("tags", [])
        if isinstance(tags_val, list):
            tags_val = json.dumps(tags_val, ensure_ascii=False)
        # 从 token 获取当前管理员，避免审计链丢失真实责任人；无 token 时兜底种子管理员
        _admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        template = NotifyTemplate(
            name=data.get("name"),
            text=data.get("text"),
            volume=data.get("volume", 0.7),
            speak=data.get("speak", True),
            popup=data.get("popup", True),
            timeout_sec=data.get("timeout_sec", 8),
            urgent=data.get("urgent", False),
            bg_color=data.get("bg_color", "#000000"),
            text_color=data.get("text_color", "#FF0000"),
            font_size=data.get("font_size", 48),
            language=data.get("language", "zh"),
            category=data.get("category"),
            tags=tags_val,
            created_by=_admin_id or 1,
        )
        db.session.add(template)
        db.session.commit()
        log_operation(
            "notify_template.create",
            "notify_template",
            template.id,
            f"创建通知模板: {template.name}",
            after_data=data,
        )
        return serialize_template(template)


@ns_notify_template.route("/<int:id>")
@ns_notify_template.doc(params={"id": "模板ID"})
class TemplateDetail(Resource):
    @ns_notify_template.doc("get_template")
    @ns_notify_template.marshal_with(template_response)
    @requires_permission("notification.view")
    def get(self, id):
        """获取单个模板详情"""
        template = NotifyTemplate.query.get_or_404(id)
        return serialize_template(template)

    @ns_notify_template.expect(template_model)
    @ns_notify_template.marshal_with(template_response)
    @requires_permission("notification.send")
    def put(self, id):
        """更新模板"""
        template = NotifyTemplate.query.get_or_404(id)
        data = ns_notify_template.payload
        template.name = data.get("name", template.name)
        template.text = data.get("text", template.text)
        template.volume = data.get("volume", template.volume)
        template.speak = data.get("speak", template.speak)
        template.popup = data.get("popup", template.popup)
        template.timeout_sec = data.get("timeout_sec", template.timeout_sec)
        template.urgent = data.get("urgent", template.urgent)
        template.bg_color = data.get("bg_color", template.bg_color)
        template.text_color = data.get("text_color", template.text_color)
        template.font_size = data.get("font_size", template.font_size)
        template.language = data.get("language", template.language)
        template.category = data.get("category", template.category)
        # tags 字段需要转换为 JSON 字符串存储
        if "tags" in data:
            tags_val = data.get("tags")
            if isinstance(tags_val, list):
                tags_val = json.dumps(tags_val, ensure_ascii=False)
            template.tags = tags_val
        template.updated_at = datetime.now()
        db.session.commit()
        return serialize_template(template)

    @requires_permission("notification.send")
    def delete(self, id):
        """删除模板（软删除）"""
        template = NotifyTemplate.query.get_or_404(id)
        template.is_active = False
        template.updated_at = datetime.now()
        db.session.commit()
        return APIResponse.success(message="模板已删除")


@ns_notify_template.route("/<int:id>/use")
@ns_notify_template.doc(params={"id": "模板ID"})
class TemplateUse(Resource):
    @ns_notify_template.doc("use_template")
    @requires_permission("notification.send")
    def post(self, id):
        """使用模板发送通知（支持 force_send 强制发送，需 notification.force_send 权限）"""
        template = NotifyTemplate.query.get_or_404(id)
        data = ns_notify_template.payload or {}
        force_send = bool(data.get("force_send", False))
        _admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        if force_send and not has_permission(g.current_user, "notification.force_send"):
            return APIResponse.error(message="无强制发送权限（需 notification.force_send）")
        # 构建消息
        message = {
            "text": template.text,
            "volume": template.volume,
            "speak": template.speak,
            "popup": template.popup,
            "timeout_sec": template.timeout_sec,
            "urgent": template.urgent,
            "bg_color": template.bg_color,
            "text_color": template.text_color,
            "font_size": template.font_size,
            "language": template.language,
            "timestamp": datetime.now().isoformat(),
        }
        # 发送模式
        send_mode = data.get("send_mode", "broadcast")
        device_id = data.get("device_id")
        topics = []
        if send_mode == "broadcast":
            topics = ["phonebox/remote/notify", "phonebox/remote/notify/all"]
        elif send_mode == "device" and device_id:
            topics = [f"phonebox/remote/notify/{device_id}"]
        else:
            topics = ["phonebox/remote/notify"]
        # 上课时间拦截（广播按全校+任意班级；指定设备按班级课表反查）
        cls_id = _resolve_class_from_device(device_id) if (send_mode == "device" and device_id) else None
        if cls_id:
            allowed, check_message, reason_code, _ = ClassTimeChecker.is_notification_allowed(
                target_class_info_id=cls_id, force_send=force_send
            )
        else:
            blocked, check_message, reason_code = ClassTimeChecker.is_broadcast_blocked(force_send=force_send)
            allowed = not blocked
        if not allowed:
            ClassTimeChecker.log_notify_audit(
                "notify_template", cls_id, _admin_id, {"id": id}, reason_code or "GLOBAL_TIME_RULE",
                check_message, force_send=False,
            )
            return APIResponse.error(message=f"上课时间，模板通知已暂停: {check_message}")
        if force_send:
            ClassTimeChecker.log_notify_audit(
                "notify_template", cls_id, _admin_id, {"id": id}, "FORCE", "强制发送模板通知", force_send=True
            )

        try:
            for topic in topics:
                publish_mqtt(topic, json.dumps(message))
            # 更新使用次数
            template.usage_count += 1
            template.updated_at = datetime.now()
            # 记录历史
            history = NotifyHistory(
                text=template.text,
                volume=template.volume,
                speak=template.speak,
                popup=template.popup,
                timeout_sec=template.timeout_sec,
                urgent=template.urgent,
                send_mode=send_mode,
                device_id=device_id,
                topic=",".join(topics),
                template_id=template.id,
                status="sent",
                sent_by=1,
            )
            db.session.add(history)
            db.session.commit()
            return {
                "success": True,
                "message": "通知已发送",
                "template_id": id,
                "topics": topics,
            }
        except Exception as e:
            return APIResponse.error(message=f"发送失败: {str(e)}")


@ns_notify_template.route("/categories")
class TemplateCategories(Resource):
    @ns_notify_template.doc("list_categories")
    @requires_permission("notification.view")
    def get(self):
        """获取模板分类列表"""
        categories = (
            db.session.query(NotifyTemplate.category)
            .filter(
                NotifyTemplate.category is not None,
            )
            .distinct()
            .all()
        )
        return [c[0] for c in categories if c[0]]
