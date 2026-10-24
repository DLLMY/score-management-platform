"""MQTT 消息服务共享叶子模块（无内部依赖，单向被各 mixin 导入）。

收容：4 个模块级助手（ensure_app_context / _build_policy_check_time /
_teacher_policy_reason / _dispatch_mqtt_topic）+ topic 派发表，以及 6 个被测试
 patch 的共享符号（publish_mqtt / mqtt_manager / mqtt_logs / db_session_scope /
 get_by_id / datetime）——单一来源，各 mixin 以 `_shared.X` 属性级访问，
 使 patch("services.mqtt_message._shared.X") 可穿透生效。
"""

from datetime import datetime
from functools import wraps

from flask import has_app_context

from models import get_by_id
from services.mqtt_service import mqtt_logs, mqtt_manager, publish_mqtt
from services.phonebox_policy import POLICY_ALLOW_OVERRIDE
from utils.db_session import db_session_scope


def ensure_app_context(func):
    """装饰器：确保被装饰的 MQTT 处理方法始终运行在 Flask app context 内。

    背景：本服务各处理方法（心跳/积分/开锁/查询/规则…）直接触碰 db.session /
    Model.query，但历史上完全依赖调用方包 app_context。MQTT paho 网络线程、
    部分同步兜底路径若漏包一层，就会高频抛 'Working outside of application
    context'，导致设备消息落库静默失败（日志 09-14 当天 101 次）。
    这里让每个公共 handler 自愈：已有 context 则透传，否则惰性导入 app 并
    push 一个，等价于调用方包 with app.app_context()，且可重入。
    """

    @wraps(func)
    def _wrapper(*args, **kwargs):
        if has_app_context():
            return func(*args, **kwargs)
        from app import app as _flask_app

        with _flask_app.app_context():
            return func(*args, **kwargs)

    return _wrapper

def _build_policy_check_time(hour, minute):
    """按 hour/minute 构造策略判定时刻；缺参或非法值返回 None。"""
    if hour is None or minute is None:
        return None
    try:
        return datetime.now().replace(
            hour=int(hour), minute=int(minute), second=0, microsecond=0
        )
    except (ValueError, TypeError):
        return None


def _teacher_policy_reason(decision):
    """班主任策略放行的审计原因码与说明。"""
    if decision == POLICY_ALLOW_OVERRIDE:
        return "PHONEBOX_TEACHER_OVERRIDE", "班主任一键放行，跳过上课时间拦截"
    return "PHONEBOX_TEACHER_WINDOW", "班主任预设时段内，允许开箱"


# MQTT topic -> 处理方法名 的派发表（与 handle_mqtt_message 原分支链等价）
_MQTT_TOPIC_HANDLERS = {
    "phonebox/query": "handle_query_message",
    "phonebox/heartbeat": "handle_heartbeat_message",
    "phonebox/points/query": "handle_points_query",
    "phonebox/points/add": "handle_points_add",
    "phonebox/points/sub": "handle_points_sub",
    "score/add": "handle_score_add",
    "score/undo": "handle_score_undo",
    "score/rules/query": "handle_score_rules_query",
}


def _dispatch_mqtt_topic(service, topic, data):
    """按 topic 派发到对应处理方法（分支抽离，零行为变更）。"""
    if topic == "phonebox/unlock" or topic.startswith("phonebox/unlock/"):
        # 订阅是 phonebox/unlock/+（实际主题 phonebox/unlock/{device_id}），
        # 此前精确匹配 topic == "phonebox/unlock" 永远不命中 → 开锁请求静默丢弃
        service.handle_unlock_message(data)
        return
    handler_name = _MQTT_TOPIC_HANDLERS.get(topic)
    if handler_name:
        getattr(service, handler_name)(data)
