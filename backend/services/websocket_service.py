#!/usr/bin/env python3
"""
WebSocket实时通信服务
使用Flask-SocketIO实现设备状态、通知等实时推送。
提供 WebSocketService 类（面向对象封装）与模块级兼容函数（委托给单例）。
"""
import json
from flask_socketio import emit, join_room, leave_room
from flask import request
from threading import Lock


NOTIFICATION_EVENT = "notification"
DEVICE_STATUS_EVENT = "device_status"
SCORE_UPDATE_EVENT = "score_update"
ALERT_EVENT = "alert"
SYSTEM_EVENT = "system"


class WebSocketService:
    """WebSocket 服务类（面向对象封装，便于测试与复用）。

    实例自行维护 socketio 与连接状态；发送类方法直接操作 self.socketio，
    注册处理器时完成实际事件绑定。测试契约要求 emit 调用不带 namespace 形参。
    """

    def __init__(self):
        self.socketio = None
        self.client_rooms = {}
        self._client_lock = Lock()
        self._connected_clients = set()
        self._handlers_registered = False

    def register_handlers(self, sio):
        """注册WebSocket事件处理器（供测试 mock 的 sio 调用）。"""
        self.socketio = sio
        self._handlers_registered = True

        @sio.on("connect")
        def handle_connect():
            client_id = request.sid
            print(f"Client connected: {client_id}")
            emit("connected", {"sid": client_id, "message": "Connected to WebSocket server"})

        @sio.on("disconnect")
        def handle_disconnect():
            client_id = request.sid
            with self._client_lock:
                if client_id in self.client_rooms:
                    for room in self.client_rooms[client_id]:
                        leave_room(room)
                    del self.client_rooms[client_id]
            print(f"Client disconnected: {client_id}")

        @sio.on("subscribe")
        def handle_subscribe(data):
            room = data.get("room")
            if room:
                join_room(room)
                with self._client_lock:
                    if request.sid not in self.client_rooms:
                        self.client_rooms[request.sid] = set()
                    self.client_rooms[request.sid].add(room)
                emit("subscribed", {"room": room})
                print(f"Client {request.sid} subscribed to {room}")

        @sio.on("unsubscribe")
        def handle_unsubscribe(data):
            room = data.get("room")
            if room:
                leave_room(room)
                with self._client_lock:
                    if request.sid in self.client_rooms and room in self.client_rooms[request.sid]:
                        self.client_rooms[request.sid].remove(room)
                emit("unsubscribed", {"room": room})

        @sio.on("ping")
        def handle_ping():
            emit("pong", {"timestamp": json.dumps({"server_time": None})})

        print("WebSocket事件处理器已注册")

    def send_notification(self, notification_type, message, data=None):
        if self.socketio:
            self.socketio.emit(
                NOTIFICATION_EVENT,
                {"type": notification_type, "message": message, "data": data or {}},
                room="notifications",
            )

    def send_device_status(self, device_id, status_data):
        if self.socketio:
            self.socketio.emit(
                DEVICE_STATUS_EVENT,
                {"device_id": device_id, "status": status_data},
                room="devices",
            )

    def send_score_update(self, user_id, score_data):
        if self.socketio:
            self.socketio.emit(
                SCORE_UPDATE_EVENT,
                {"user_id": user_id, "score": score_data},
                room=f"user_{user_id}",
            )

    def send_alert(self, alert_type, alert_data):
        if self.socketio:
            self.socketio.emit(ALERT_EVENT, {"type": alert_type, "data": alert_data}, room="alerts")

    def broadcast_system_message(self, event_type, message, data=None):
        if self.socketio:
            self.socketio.emit(
                SYSTEM_EVENT,
                {"event": event_type, "message": message, "data": data or {}},
                room="system",
            )

    def send_to_room(self, room, event, data):
        if self.socketio:
            self.socketio.emit(event, data, room=room)

    def send_to_user(self, user_id, event, data):
        if self.socketio:
            self.socketio.emit(event, data, room=f"user_{user_id}")

    def broadcast(self, event, data):
        if self.socketio:
            self.socketio.emit(event, data)

    def get_client_count(self):
        return len(self._connected_clients)

    def get_client_info(self):
        return {
            "connected_clients": len(self._connected_clients),
            "rooms": {c: list(self.client_rooms.get(c, set())) for c in self._connected_clients},
        }

    def is_connected(self, client_id):
        return client_id in self._connected_clients

    def close_client(self, client_id):
        if self.socketio:
            self.socketio.disconnect(client_id)


# 单例实例 + 模块级兼容函数（委托给单例，供旧接口调用）
websocket_service = WebSocketService()


def register_handlers(sio):
    websocket_service.register_handlers(sio)


def send_notification(notification_type, message, data=None):
    websocket_service.send_notification(notification_type, message, data)


def send_device_status(device_id, status_data):
    websocket_service.send_device_status(device_id, status_data)


def send_score_update(user_id, score_data):
    websocket_service.send_score_update(user_id, score_data)


def send_alert(alert_type, alert_data):
    websocket_service.send_alert(alert_type, alert_data)


def broadcast_system_message(event_type, message, data=None):
    websocket_service.broadcast_system_message(event_type, message, data)


def send_to_room(room, event, data):
    websocket_service.send_to_room(room, event, data)


def send_to_user(user_id, event, data):
    websocket_service.send_to_user(user_id, event, data)
