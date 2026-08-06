"""
WebSocket路由配置
提供WebSocket连接端点和房间管理
"""

from flask import Blueprint, request, jsonify
from services.websocket_service import broadcast_system_message
from utils.permission import requires_admin
from models import User, Device

ws_bp = Blueprint("websocket", __name__)


@ws_bp.route("/ws/rooms", methods=["GET"])
def get_available_rooms():
    rooms = {
        "notifications": "通知推送",
        "devices": "设备状态",
        "alerts": "告警信息",
        "system": "系统消息",
        "scores": "积分更新",
    }
    return jsonify({"success": True, "rooms": rooms})


@ws_bp.route("/ws/rooms/<room>/subscribe", methods=["POST"])
def subscribe_to_room(room):
    return jsonify({"success": True, "room": room})


@ws_bp.route("/ws/rooms/<room>/unsubscribe", methods=["POST"])
def unsubscribe_from_room(room):
    return jsonify({"success": True, "room": room})


@ws_bp.route("/ws/device/<device_id>/subscribe", methods=["POST"])
def subscribe_device(device_id):
    device = Device.query.filter_by(device_id=device_id).first()
    if not device:
        return (jsonify({"success": False, "message": "设备不存在"}), 404)
    return jsonify({"success": True, "room": f"device_{device_id}"})


@ws_bp.route("/ws/user/<int:user_id>/subscribe", methods=["POST"])
def subscribe_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return (jsonify({"success": False, "message": "用户不存在"}), 404)
    return jsonify({"success": True, "room": f"user_{user_id}"})


@ws_bp.route("/ws/status", methods=["GET"])
@requires_admin
def get_websocket_status():
    from services.websocket_service import client_rooms

    return jsonify(
        {
            "success": True,
            "active_connections": len(client_rooms),
            "rooms": {str(sid): list(rooms) for sid, rooms in client_rooms.items()},
        }
    )


@ws_bp.route("/ws/broadcast", methods=["POST"])
@requires_admin
def broadcast_message():
    data = request.get_json()
    event_type = data.get("event", "system")
    message = data.get("message", "")
    _target_room = data.get("room", "system")  # noqa: F841
    broadcast_system_message(event_type, message, data.get("data"))
    return jsonify({"success": True})
