"""P0 硬件对接修复回归测试：G2 去重 / G1 下行 device_id / G8 服务器时钟。"""

import json
from datetime import datetime
from unittest.mock import Mock, patch

from services.mqtt_message_service import MQTTMessageService

# ---------------- G2：unlock msg_id 幂等去重 ----------------


@patch("services.mqtt_message_service.publish_mqtt")
@patch("services.mqtt_message_service.mqtt_manager")
@patch("models.TimeRule")
@patch("services.mqtt_message_service.db_session_scope")
def test_unlock_same_msg_id_only_deduct_once(
    mock_db_scope, mock_time_rule, mock_manager, mock_publish, app
):
    """同一 msg_id 两次上行：仅扣 1 次分、两次下发结果完全一致（G2）。"""
    mock_time_rule.query.filter_by.return_value.all.return_value = []
    from models import User, db

    with app.app_context():
        user = User(
            card_id="123", name="测试", current_score=80, is_active=True, daily_unlock_limit=5
        )
        db.session.add(user)
        db.session.commit()
        mock_manager.get_cached_user.return_value = user

        service = MQTTMessageService()
        data = {"box_id": "A", "card_id": "123", "hour": 10, "minute": 30, "msg_id": "m-same-1"}
        service.handle_unlock_message(data)  # 首次：扣分
        service.handle_unlock_message(data)  # 重复：重发缓存，不再扣分

        assert mock_publish.call_count == 2
        p1 = json.loads(mock_publish.call_args_list[0][0][1])
        p2 = json.loads(mock_publish.call_args_list[1][0][1])
        assert p1 == p2
        assert p1["result"] == "true"

        db.session.expire_all()
        updated = db.session.query(User).filter_by(card_id="123").first()
        assert updated.current_score == 70  # 仅扣一次
        assert updated.today_unlock_count == 1


@patch("services.mqtt_message_service.publish_mqtt")
@patch("services.mqtt_message_service.mqtt_manager")
@patch("models.TimeRule")
@patch("services.mqtt_message_service.db_session_scope")
def test_unlock_different_msg_id_deduct_twice(
    mock_db_scope, mock_time_rule, mock_manager, mock_publish, app
):
    """不同 msg_id：视为两次独立开锁，各扣 1 次（G2 不误伤正常多次开箱）。"""
    mock_time_rule.query.filter_by.return_value.all.return_value = []
    from models import User, db

    with app.app_context():
        # 起始 100：MIN_SCORE=80，两次开锁各扣 10 → 100→90→80（均 >=80 可开锁）
        user = User(
            card_id="123", name="测试", current_score=100, is_active=True, daily_unlock_limit=5
        )
        db.session.add(user)
        db.session.commit()
        mock_manager.get_cached_user.return_value = user

        service = MQTTMessageService()
        service.handle_unlock_message(
            {"box_id": "A", "card_id": "123", "hour": 10, "minute": 30, "msg_id": "m-a"}
        )
        service.handle_unlock_message(
            {"box_id": "A", "card_id": "123", "hour": 10, "minute": 30, "msg_id": "m-b"}
        )

        db.session.expire_all()
        updated = db.session.query(User).filter_by(card_id="123").first()
        assert updated.current_score == 80
        assert updated.today_unlock_count == 2


@patch("services.mqtt_message_service.publish_mqtt")
@patch("services.mqtt_message_service.mqtt_manager")
@patch("models.TimeRule")
@patch("services.mqtt_message_service.db_session_scope")
def test_unlock_empty_msg_id_no_dedup(
    mock_db_scope, mock_time_rule, mock_manager, mock_publish, app
):
    """旧设备 msg_id 为空：跳过去重，保持历史行为（每次都扣分，G2 向后兼容）。"""
    mock_time_rule.query.filter_by.return_value.all.return_value = []
    from models import User, db

    with app.app_context():
        # 起始 100：无 msg_id 跳过去重，两次独立开锁各扣 10 → 80
        user = User(
            card_id="123", name="测试", current_score=100, is_active=True, daily_unlock_limit=5
        )
        db.session.add(user)
        db.session.commit()
        mock_manager.get_cached_user.return_value = user

        service = MQTTMessageService()
        # 注意：无 msg_id
        service.handle_unlock_message({"box_id": "A", "card_id": "123", "hour": 10, "minute": 30})
        service.handle_unlock_message({"box_id": "A", "card_id": "123", "hour": 10, "minute": 30})

        db.session.expire_all()
        updated = db.session.query(User).filter_by(card_id="123").first()
        assert updated.current_score == 80  # 两次都扣分


# ---------------- G1：下行补 device_id ----------------


@patch("services.mqtt_message_service.publish_mqtt")
def test_publish_unlock_result_includes_device_id(mock_publish):
    """开锁结果下行 payload 含 device_id（G1 定向校验字段）。"""
    service = MQTTMessageService()
    service.publish_unlock_result("A", True, "score_ok", 80, device_id="dev-001")

    mock_publish.assert_called_once()
    payload = json.loads(mock_publish.call_args[0][1])
    assert payload["device_id"] == "dev-001"
    assert payload["result"] == "true"


@patch("services.mqtt_message_service.publish_mqtt")
def test_publish_unlock_result_no_device_id_when_absent(mock_publish):
    """缺省 device_id 时 payload 不输出该字段（零破坏性）。"""
    service = MQTTMessageService()
    service.publish_unlock_result("A", True, "score_ok", 80)

    payload = json.loads(mock_publish.call_args[0][1])
    assert "device_id" not in payload


@patch("services.mqtt_message_service.publish_mqtt")
@patch("services.mqtt_message_service.mqtt_manager")
def test_query_downlink_includes_device_id(mock_manager, mock_publish):
    """query 下行结果同样透传 device_id（G1 镜像）。"""
    mock_user = Mock()
    mock_user.current_score = 85
    mock_manager.get_cached_user.return_value = mock_user

    service = MQTTMessageService()
    service.handle_query_message({"box_id": "A", "card_id": "123", "device_id": "dev-query"})

    mock_publish.assert_called_once()
    payload = json.loads(mock_publish.call_args[0][1])
    assert payload["device_id"] == "dev-query"


@patch("services.mqtt_message_service.publish_mqtt")
@patch("services.mqtt_message_service.mqtt_manager")
@patch("models.TimeRule")
@patch("services.mqtt_message_service.db_session_scope")
def test_unlock_downlink_device_id_isolated(
    mock_db_scope, mock_time_rule, mock_manager, mock_publish, app
):
    """多设备同 box_id（都叫 A）时，下行 payload 携带各自 device_id（防串开，G1）。"""
    mock_time_rule.query.filter_by.return_value.all.return_value = []
    from models import User, db

    with app.app_context():
        user = User(
            card_id="123", name="测试", current_score=80, is_active=True, daily_unlock_limit=5
        )
        db.session.add(user)
        db.session.commit()
        mock_manager.get_cached_user.return_value = user

        service = MQTTMessageService()
        service.handle_unlock_message(
            {"box_id": "A", "card_id": "123", "device_id": "dev-A1", "msg_id": "m-iso"}
        )

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload["device_id"] == "dev-A1"
        assert mock_publish.call_args[0][0] == "phonebox/unlock/A"


# ---------------- G8：强制服务器时钟 ----------------


@patch("services.mqtt_message_service.publish_mqtt")
@patch("services.mqtt_message_service.mqtt_manager")
@patch("models.TimeRule")
def test_unlock_server_clock_ignores_device_hour_block(
    mock_time_rule, mock_manager, mock_publish
):
    """G8：设备上行 hour=10（在 deny 窗口内）但服务器时钟 14:30 在窗口外 → 仍按服务器时钟 not_in_time 拦截。"""
    mock_rule = Mock()
    mock_rule.day_of_week = -1
    mock_rule.start_hour = 9
    mock_rule.start_minute = 0
    mock_rule.end_hour = 12
    mock_rule.end_minute = 0
    mock_rule.allow_unlock = False
    mock_time_rule.query.filter_by.return_value.all.return_value = [mock_rule]

    class _FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 1, 1, 14, 30, 0)

    with patch("services.mqtt_message_service.datetime", _FixedDateTime):
        service = MQTTMessageService()
        service.handle_unlock_message(
            {"box_id": "A", "card_id": "123", "hour": 10, "minute": 0}
        )

    mock_publish.assert_called_once()
    payload = json.loads(mock_publish.call_args[0][1])
    assert payload["result"] == "false"
    assert payload["reason"] == "not_in_time"


@patch("services.mqtt_message_service.publish_mqtt")
@patch("services.mqtt_message_service.mqtt_manager")
@patch("models.TimeRule")
@patch("services.mqtt_message_service.db_session_scope")
def test_unlock_server_clock_ignores_device_hour_allow(
    mock_db_scope, mock_time_rule, mock_manager, mock_publish, app
):
    """G8 正向：设备上行 hour=3（凌晨，若被误用会绕过）但服务器时钟 10:00 在 allow 窗口内 → 按服务器时钟放行。"""
    mock_rule = Mock()
    mock_rule.day_of_week = -1
    mock_rule.start_hour = 9
    mock_rule.start_minute = 0
    mock_rule.end_hour = 18
    mock_rule.end_minute = 0
    mock_rule.allow_unlock = True
    mock_time_rule.query.filter_by.return_value.all.return_value = [mock_rule]

    from models import User, db

    with app.app_context():
        # 起始 100，单次开锁扣 10 → 90（>=80 可开锁）
        user = User(
            card_id="123", name="测试", current_score=100, is_active=True, daily_unlock_limit=5
        )
        db.session.add(user)
        db.session.commit()
        mock_manager.get_cached_user.return_value = user

        class _FixedDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                return datetime(2026, 1, 1, 10, 0, 0)

        with patch("services.mqtt_message_service.datetime", _FixedDateTime):
            service = MQTTMessageService()
            service.handle_unlock_message(
                {"box_id": "A", "card_id": "123", "hour": 3, "minute": 0, "msg_id": "m-g8-allow"}
            )

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        # 关键断言：未被设备 hour=3 误判，按服务器时钟 10:00 正常放行
        assert payload["result"] == "true"
        assert payload["reason"] == "score_ok"
        db.session.expire_all()
        updated = db.session.query(User).filter_by(card_id="123").first()
        assert updated.current_score == 90
