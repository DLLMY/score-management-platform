"""WebSocket路由配置

提供WebSocket连接端点和房间管理。
"""

from flask import Blueprint, request
from services.websocket_service import broadcast_system_message
from utils.response import APIResponse
from utils.permission import requires_permission
from models import User, Device, get_by_id

ws_bp = Blueprint("websocket", __name__)


@ws_bp.route("/ws/rooms", methods=["GET"])
def get_available_rooms():
    rooms = {
        "notifications": "Notifications",
        "devices": "Device Status",
        "alerts": "Alerts",
        "system": "System Messages",
        "scores": "Score Updates",
    }
    return APIResponse.success(data={"rooms": rooms})


@ws_bp.route("/ws/rooms/<room>/subscribe", methods=["POST"])
def subscribe_to_room(room):
    return APIResponse.success(data={"room": room})


@ws_bp.route("/ws/rooms/<room>/unsubscribe", methods=["POST"])
def unsubscribe_from_room(room):
    return APIResponse.success(data={"room": room})


@ws_bp.route("/ws/device/<device_id>/subscribe", methods=["POST"])
def subscribe_device(device_id):
    device = Device.query.filter_by(device_id=device_id).first()
    if not device:
        return (APIResponse.error(message="Device not found"), 404)
    return APIResponse.success(data={"room": f"device_{device_id}"})


@ws_bp.route("/ws/user/<int:user_id>/subscribe", methods=["POST"])
def subscribe_user(user_id):
    user = get_by_id(User, user_id)
    if not user:
        return (APIResponse.error(message="User not found"), 404)
    return APIResponse.success(data={"room": f"user_{user_id}"})


@ws_bp.route("/ws/status", methods=["GET"])
@requires_permission("system.settings")
def get_websocket_status():
    from services.websocket_service import client_rooms

    rooms_data = {str(sid): list(rooms) for sid, rooms in client_rooms.items()}
    return APIResponse.success(
        data={
            "active_connections": len(client_rooms),
            "rooms": rooms_data,
        }
    )


@ws_bp.route("/ws/broadcast", methods=["POST"])
@requires_permission("system.settings")
def broadcast_message():
    data = request.get_json()
    event_type = data.get("event", "system")
    message = data.get("message", "")
    data.get("room", "system")
    broadcast_system_message(event_type, message, data.get("data"))
    return APIResponse.success()
