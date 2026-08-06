"""
WebSocket Service Test Cases
"""
# 测试WebSocket实时通信服务的核心功能
"""
"""
from unittest.mock import patch, MagicMock
try:
    from services.websocket_service import WebSocketService
except ImportError:
    pass

try:
    from services.websocket_service import register_handlers, websocket_service
except ImportError:
    pass

try:
    from services.websocket_service import send_notification
except ImportError:
    pass

try:
    from services.websocket_service import send_device_status
except ImportError:
    pass

try:
    from services.websocket_service import send_score_update
except ImportError:
    pass

try:
    from services.websocket_service import send_alert
except ImportError:
    pass

try:
    from services.websocket_service import broadcast_system_message
except ImportError:
    pass

try:
    from services.websocket_service import send_to_room
except ImportError:
    pass

try:
    from services.websocket_service import send_to_user
except ImportError:
    pass


class TestWebSocketService:
    """测试WebSocket服务"""

    def test_init(self):
        """测试初始化"""
        from services.websocket_service import WebSocketService

        service = WebSocketService()

        assert service.socketio is None
        assert service.client_rooms == {}
        assert service._connected_clients == set()
        assert service._handlers_registered is False

    def test_register_handlers(self):
        """测试注册事件处理器"""

        service = WebSocketService()
        mock_sio = MagicMock()

        service.register_handlers(mock_sio)

        assert service.socketio is mock_sio
        assert service._handlers_registered is True
        assert mock_sio.on.call_count >= 5

    def test_send_notification(self):
        """测试发送通知"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.send_notification("info", "test message", {"key": "value"})

        mock_sio.emit.assert_called_once_with(
            "notification",
            {"type": "info", "message": "test message", "data": {"key": "value"}},
            room="notifications",
        )

    def test_send_notification_no_socketio(self):
        """测试没有socketio时发送通知"""

        service = WebSocketService()
        service.socketio = None

        service.send_notification("info", "test message")

    def test_send_device_status(self):
        """测试发送设备状态"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.send_device_status("device1", {"status": "online"})

        mock_sio.emit.assert_called_once_with(
            "device_status",
            {"device_id": "device1", "status": {"status": "online"}},
            room="devices",
        )

    def test_send_score_update(self):
        """测试发送积分更新"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.send_score_update(1, {"score": 100})

        mock_sio.emit.assert_called_once_with(
            "score_update",
            {"user_id": 1, "score": {"score": 100}},
            room="user_1",
        )

    def test_send_alert(self):
        """测试发送告警"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.send_alert("warning", {"level": "high"})

        mock_sio.emit.assert_called_once_with(
            "alert",
            {"type": "warning", "data": {"level": "high"}},
            room="alerts",
        )

    def test_broadcast_system_message(self):
        """测试广播系统消息"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.broadcast_system_message("startup", "System started")

        mock_sio.emit.assert_called_once_with(
            "system",
            {"event": "startup", "message": "System started", "data": {}},
            room="system",
        )

    def test_send_to_room(self):
        """测试发送到指定房间"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.send_to_room("room1", "custom_event", {"data": "test"})

        mock_sio.emit.assert_called_once_with("custom_event", {"data": "test"}, room="room1")

    def test_send_to_user(self):
        """测试发送到指定用户"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.send_to_user(123, "private_event", {"msg": "hello"})

        mock_sio.emit.assert_called_once_with("private_event", {"msg": "hello"}, room="user_123")

    def test_broadcast(self):
        """测试广播消息"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.broadcast("global_event", {"all": "clients"})

        mock_sio.emit.assert_called_once_with("global_event", {"all": "clients"})

    def test_get_client_count(self):
        """测试获取客户端数量"""

        service = WebSocketService()
        service._connected_clients = {"client1", "client2", "client3"}

        count = service.get_client_count()

        assert count == 3

    def test_get_client_info(self):
        """测试获取客户端信息"""

        service = WebSocketService()
        service._connected_clients = {"client1", "client2"}
        service.client_rooms = {"client1": {"room1", "room2"}, "client2": {"room1"}}

        info = service.get_client_info()

        assert info["connected_clients"] == 2
        assert "client1" in info["rooms"]
        assert "client2" in info["rooms"]

    def test_is_connected(self):
        """测试检查客户端连接状态"""

        service = WebSocketService()
        service._connected_clients = {"client1", "client2"}

        assert service.is_connected("client1") is True
        assert service.is_connected("client3") is False

    def test_close_client(self):
        """测试关闭客户端连接"""

        service = WebSocketService()
        mock_sio = MagicMock()
        service.socketio = mock_sio

        service.close_client("client1")

        mock_sio.disconnect.assert_called_once_with("client1")

    def test_close_client_no_socketio(self):
        """测试没有socketio时关闭客户端"""

        service = WebSocketService()
        service.socketio = None

        service.close_client("client1")


class TestWebSocketServiceCompatibility:
    """测试WebSocket服务兼容旧接口"""

    def test_register_handlers(self):
        """测试兼容接口-注册处理器"""
        from services.websocket_service import register_handlers, websocket_service

        mock_sio = MagicMock()

        with patch.object(websocket_service, 'register_handlers') as mock_register:
            register_handlers(mock_sio)
            mock_register.assert_called_once_with(mock_sio)

    def test_send_notification(self):
        """测试兼容接口-发送通知"""
        from services.websocket_service import send_notification

        with patch.object(websocket_service, 'send_notification') as mock_send:
            send_notification("info", "test", {"data": "test"})
            mock_send.assert_called_once_with("info", "test", {"data": "test"})

    def test_send_device_status(self):
        """测试兼容接口-发送设备状态"""
        from services.websocket_service import send_device_status

        with patch.object(websocket_service, 'send_device_status') as mock_send:
            send_device_status("device1", {"status": "online"})
            mock_send.assert_called_once_with("device1", {"status": "online"})

    def test_send_score_update(self):
        """测试兼容接口-发送积分更新"""
        from services.websocket_service import send_score_update

        with patch.object(websocket_service, 'send_score_update') as mock_send:
            send_score_update(1, {"score": 100})
            mock_send.assert_called_once_with(1, {"score": 100})

    def test_send_alert(self):
        """测试兼容接口-发送告警"""
        from services.websocket_service import send_alert

        with patch.object(websocket_service, 'send_alert') as mock_send:
            send_alert("warning", {"level": "high"})
            mock_send.assert_called_once_with("warning", {"level": "high"})

    def test_broadcast_system_message(self):
        """测试兼容接口-广播系统消息"""
        from services.websocket_service import broadcast_system_message

        with patch.object(websocket_service, 'broadcast_system_message') as mock_send:
            broadcast_system_message("startup", "System started")
            mock_send.assert_called_once_with("startup", "System started", None)

    def test_send_to_room(self):
        """测试兼容接口-发送到房间"""
        from services.websocket_service import send_to_room

        with patch.object(websocket_service, 'send_to_room') as mock_send:
            send_to_room("room1", "event", {"data": "test"})
            mock_send.assert_called_once_with("room1", "event", {"data": "test"})

    def test_send_to_user(self):
        """测试兼容接口-发送到用户"""
        from services.websocket_service import send_to_user

        with patch.object(websocket_service, 'send_to_user') as mock_send:
            send_to_user(123, "event", {"data": "test"})
            mock_send.assert_called_once_with(123, "event", {"data": "test"})
