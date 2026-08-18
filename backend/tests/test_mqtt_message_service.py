"""MQTT消息服务单元测试"""
from unittest.mock import Mock, patch
import json
try:
    from services.mqtt_message_service import MQTTMessageService
except ImportError:
    pass

try:
    from models import ScoreRule, db
except ImportError:
    pass


class TestMQTTMessageService:
    """MQTT消息服务测试类"""

    @patch('models.TimeRule')
    def test_check_time_valid_no_rules(self, mock_time_rule):
        """测试无时间规则时返回True"""
        mock_time_rule.query.filter_by.return_value.all.return_value = []

        from services.mqtt_message_service import MQTTMessageService

        service = MQTTMessageService()
        result = service.check_time_valid('box1', 10, 30)

        assert result

    @patch('models.TimeRule')
    def test_check_time_valid_with_rules(self, mock_time_rule):
        """测试有时间规则时的时间检查"""
        mock_rule = Mock()
        mock_rule.day_of_week = -1
        mock_rule.start_hour = 9
        mock_rule.start_minute = 0
        mock_rule.end_hour = 18
        mock_rule.end_minute = 0
        mock_rule.allow_unlock = True
        mock_time_rule.query.filter_by.return_value.all.return_value = [mock_rule]

        service = MQTTMessageService()
        result = service.check_time_valid('box1', 10, 30)

        assert result

    @patch('models.TimeRule')
    def test_check_time_valid_not_in_time(self, mock_time_rule):
        """测试不在允许时间内"""
        mock_rule = Mock()
        mock_rule.day_of_week = -1
        mock_rule.start_hour = 9
        mock_rule.start_minute = 0
        mock_rule.end_hour = 12
        mock_rule.end_minute = 0
        mock_rule.allow_unlock = False
        mock_time_rule.query.filter_by.return_value.all.return_value = [mock_rule]

        service = MQTTMessageService()
        result = service.check_time_valid('box1', 14, 30)

        assert not result

    @patch('services.mqtt_message_service.get_by_id')
    def test_check_rule_limit_no_rule(self, mock_get_by_id):
        """测试规则不存在"""
        mock_get_by_id.return_value = None

        service = MQTTMessageService()
        result = service.check_rule_limit(1, 999)

        assert not result['allow']
        assert 'Rule not found' in result['message']

    @patch('services.mqtt_message_service.get_by_id')
    def test_check_rule_limit_no_daily_limit(self, mock_get_by_id):
        """测试无每日限制"""
        mock_rule = Mock()
        mock_rule.daily_limit = 0
        mock_get_by_id.return_value = mock_rule

        service = MQTTMessageService()
        result = service.check_rule_limit(1, 1)

        assert result['allow']

    def test_check_rule_limit_allowed(self, app):
        """测试规则检查通过"""
        with app.app_context():

            service = MQTTMessageService()

            from models import ScoreRule, db

            rule = ScoreRule(
                name='测试规则',
                description='测试',
                score=10,
                daily_limit=100,
                min_interval=0,
                is_active=True
            )
            db.session.add(rule)
            db.session.commit()
            db.session.refresh(rule)

            result = service.check_rule_limit(1, rule.id)

            assert result['allow']

    @patch('models.SystemConfig')
    def test_apply_score_limit_with_config(self, mock_config):
        """测试有配置时的分数限制"""
        mock_config.query.first.return_value = Mock(min_score=0, max_score=100)

        service = MQTTMessageService()

        assert service.apply_score_limit(150) == 100
        assert service.apply_score_limit(-10) == 0
        assert service.apply_score_limit(50) == 50

    @patch('models.SystemConfig')
    def test_apply_score_limit_no_config(self, mock_config):
        """测试无配置时的默认分数限制"""
        mock_config.query.first.return_value = None

        service = MQTTMessageService()

        assert service.apply_score_limit(150) == 100
        assert service.apply_score_limit(-10) == 0
        assert service.apply_score_limit(50) == 50

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.User')
    def test_handle_query_message_no_card(self, mock_user, mock_manager, mock_publish):
        """测试查询消息无card_id"""
        mock_manager.get_cached_user.return_value = None

        service = MQTTMessageService()
        service.handle_query_message({'box_id': 'A'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['result'] == 'false'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.User')
    def test_handle_query_message_user_not_found(self, mock_user, mock_manager, mock_publish):
        """测试查询消息用户不存在"""
        mock_manager.get_cached_user.return_value = None
        mock_user.query.filter_by.return_value.first.return_value = None

        service = MQTTMessageService()
        service.handle_query_message({'box_id': 'A', 'card_id': '123'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['result'] == 'false'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    def test_handle_query_message_success(self, mock_manager, mock_publish):
        """测试查询消息成功"""
        mock_user = Mock()
        mock_user.current_score = 85
        mock_manager.get_cached_user.return_value = mock_user

        service = MQTTMessageService()
        service.handle_query_message({'box_id': 'A', 'card_id': '123'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['result'] == 'true'
        assert payload['current_score'] == 85

    @patch('services.mqtt_message_service.publish_mqtt')
    def test_publish_unlock_result(self, mock_publish):
        """测试发布解锁结果"""

        service = MQTTMessageService()
        service.publish_unlock_result('box1', True, 'test_reason', 80)

        mock_publish.assert_called_once()
        assert mock_publish.call_args[0][0] == 'phonebox/unlock/box1'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    def test_handle_points_query_no_card(self, mock_manager, mock_publish):
        """测试积分查询无card_id"""

        service = MQTTMessageService()
        service.handle_points_query({'device_id': 'dev1', 'request_id': 'req001'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.User')
    def test_handle_points_query_user_not_found(self, mock_user, mock_manager, mock_publish):
        """测试积分查询用户不存在"""
        mock_manager.get_cached_user.return_value = None
        mock_user.query.filter_by.return_value.first.return_value = None

        service = MQTTMessageService()
        service.handle_points_query({'card_id': '123', 'device_id': 'dev1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    def test_handle_points_query_success(self, mock_manager, mock_publish):
        """测试积分查询成功"""
        mock_user = Mock()
        mock_user.current_score = 90
        mock_user.id = 1
        mock_user.name = 'Test User'
        mock_manager.get_cached_user.return_value = mock_user

        service = MQTTMessageService()
        service.handle_points_query({'card_id': '123', 'device_id': 'dev1', 'request_id': 'req001'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['success']
        assert payload.get('new_points') == 90

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.TimeRule')
    def test_handle_unlock_message_not_in_time(self, mock_time_rule, mock_manager, mock_publish):
        """测试解锁消息-不在允许时间内"""
        mock_rule = Mock()
        mock_rule.day_of_week = -1
        mock_rule.start_hour = 9
        mock_rule.start_minute = 0
        mock_rule.end_hour = 12
        mock_rule.end_minute = 0
        mock_rule.allow_unlock = False
        mock_time_rule.query.filter_by.return_value.all.return_value = [mock_rule]

        service = MQTTMessageService()
        service.handle_unlock_message({'box_id': 'A', 'card_id': '123', 'hour': 14, 'minute': 30})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['result'] == 'false'
        assert payload['reason'] == 'not_in_time'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.TimeRule')
    def test_handle_unlock_message_no_card(self, mock_time_rule, mock_manager, mock_publish):
        """测试解锁消息-无card_id"""
        mock_time_rule.query.filter_by.return_value.all.return_value = []

        service = MQTTMessageService()
        service.handle_unlock_message({'box_id': 'A', 'hour': 10, 'minute': 30})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['result'] == 'false'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.TimeRule')
    @patch('models.User')
    def test_handle_unlock_message_user_not_found(self, mock_user, mock_time_rule, mock_manager, mock_publish):
        """测试解锁消息-用户不存在"""
        mock_time_rule.query.filter_by.return_value.all.return_value = []
        mock_manager.get_cached_user.return_value = None
        mock_user.query.filter_by.return_value.first.return_value = None

        service = MQTTMessageService()
        service.handle_unlock_message({'box_id': 'A', 'card_id': '123', 'hour': 10, 'minute': 30})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['result'] == 'false'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.TimeRule')
    def test_handle_unlock_message_score_low(self, mock_time_rule, mock_manager, mock_publish, app):
        """测试解锁消息-积分不足（R2 起走 UnlockValidator 真实校验，需真实学生记录）"""
        mock_time_rule.query.filter_by.return_value.all.return_value = []
        from models import User, db
        with app.app_context():
            user = User(card_id="123", name="测试", current_score=50, is_active=True, daily_unlock_limit=5)
            db.session.add(user)
            db.session.commit()
            mock_manager.get_cached_user.return_value = user

            service = MQTTMessageService()
            service.handle_unlock_message({'box_id': 'A', 'card_id': '123', 'hour': 10, 'minute': 30})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['result'] == 'false'
        assert payload['reason'] == 'score_low'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.TimeRule')
    @patch('services.mqtt_message_service.db_session_scope')
    def test_handle_unlock_message_success(self, mock_db_scope, mock_time_rule, mock_manager, mock_publish, app):
        """测试解锁消息-成功（R2 起走 UnlockValidator 真实校验 + record_unlock 记账）"""
        mock_time_rule.query.filter_by.return_value.all.return_value = []
        from models import User, db
        with app.app_context():
            user = User(card_id="123", name="测试", current_score=80, is_active=True, daily_unlock_limit=5)
            db.session.add(user)
            db.session.commit()
            mock_manager.get_cached_user.return_value = user

            service = MQTTMessageService()
            service.handle_unlock_message({'box_id': 'A', 'card_id': '123', 'hour': 10, 'minute': 30})

            mock_publish.assert_called_once()
            payload = json.loads(mock_publish.call_args[0][1])
            assert payload['result'] == 'true'
            assert payload['reason'] == 'score_ok'
            # R2: 开锁后扣分+计数+流水
            db.session.expire_all()
            updated = db.session.query(User).filter_by(card_id="123").first()
            assert updated.current_score == 70
            assert updated.today_unlock_count == 1
            mock_manager.set_cached_user.assert_called_once()

    @patch('services.mqtt_message_service.publish_mqtt')
    def test_handle_points_add_no_card(self, mock_publish):
        """测试积分增加-无card_id"""

        service = MQTTMessageService()
        service.handle_points_add({'amount': 10, 'device_id': 'dev1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    def test_handle_points_add_invalid_amount(self, mock_publish):
        """测试积分增加-无效金额"""

        service = MQTTMessageService()
        service.handle_points_add({'card_id': '123', 'amount': 0, 'device_id': 'dev1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('models.User')
    def test_handle_points_add_user_not_found(self, mock_user, mock_manager, mock_publish):
        """测试积分增加-用户不存在"""
        mock_manager.get_cached_user.return_value = None
        mock_user.query.filter_by.return_value.first.return_value = None

        service = MQTTMessageService()
        service.handle_points_add({'card_id': '123', 'amount': 10, 'device_id': 'dev1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('services.mqtt_message_service.db_session_scope')
    def test_handle_points_add_success(self, mock_db_scope, mock_manager, mock_publish, app):
        """测试积分增加-成功"""
        mock_user = Mock()
        mock_user.current_score = 80
        mock_user.id = 1
        mock_user.name = 'Test User'
        mock_manager.get_cached_user.return_value = mock_user

        service = MQTTMessageService()
        with app.app_context():
            service.handle_points_add({'card_id': '123', 'amount': 10, 'device_id': 'dev1', 'request_id': 'req001'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    def test_handle_points_sub_no_card(self, mock_publish):
        """测试积分扣除-无card_id"""

        service = MQTTMessageService()
        service.handle_points_sub({'amount': 10, 'device_id': 'dev1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    def test_handle_points_sub_invalid_amount(self, mock_publish):
        """测试积分扣除-无效金额"""

        service = MQTTMessageService()
        service.handle_points_sub({'card_id': '123', 'amount': 0, 'device_id': 'dev1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.mqtt_manager')
    @patch('services.mqtt_message_service.db_session_scope')
    def test_handle_points_sub_success(self, mock_db_scope, mock_manager, mock_publish, app):
        """测试积分扣除-成功"""
        mock_user = Mock()
        mock_user.current_score = 80
        mock_user.id = 1
        mock_user.name = 'Test User'
        mock_manager.get_cached_user.return_value = mock_user

        service = MQTTMessageService()
        with app.app_context():
            service.handle_points_sub({'card_id': '123', 'amount': 5, 'device_id': 'dev1', 'request_id': 'req001'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.db_session_scope')
    def test_handle_heartbeat_message(self, mock_db_scope, mock_publish, app):
        """测试心跳消息处理"""

        service = MQTTMessageService()
        with app.app_context():
            service.handle_heartbeat_message({
                'device_id': 'dev001',
                'timestamp': '2024-01-01T10:00:00',
                'status': 'online',
                'wifi_signal': -50,
                'uptime': 3600,
                'box_a_status': 'closed',
                'box_b_status': 'open',
                'system_state': 'normal'
            })

        assert True

    @patch('services.mqtt_message_service.publish_mqtt')
    def test_handle_score_add_invalid_undo_code(self, mock_publish):
        """测试积分撤销-无效代码"""

        service = MQTTMessageService()
        service.handle_score_undo({'undo_code': 'INVALID', 'client_id': 'client1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.get_by_id')
    def test_handle_score_undo_record_not_found(self, mock_get_by_id, mock_publish):
        """测试积分撤销-记录不存在"""
        mock_get_by_id.return_value = None

        service = MQTTMessageService()
        service.handle_score_undo({'undo_code': 'UNDO_123', 'client_id': 'client1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.get_by_id')
    def test_handle_score_undo_already_undone(self, mock_get_by_id, mock_publish):
        """测试积分撤销-已撤销"""

        class MockRecord:
            description = 'Test [undone]'
            score_change = 10
            user_id = 1

        mock_get_by_id.return_value = MockRecord()

        service = MQTTMessageService()
        service.handle_score_undo({'undo_code': 'UNDO_123', 'client_id': 'client1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.db_session_scope')
    @patch('services.mqtt_message_service.get_by_id')
    def test_handle_score_undo_success(self, mock_get_by_id, mock_db_scope, mock_publish):
        """测试积分撤销-成功"""
        mock_record = Mock()
        mock_record.description = 'Test'
        mock_record.score_change = 10
        mock_record.student_id = 1

        mock_user = Mock(spec=['id', 'current_score'])
        mock_user.id = 1
        mock_user.current_score = 90

        def mock_get(model_class, id):
            if id == 123:
                return mock_record
            return mock_user

        mock_get_by_id.side_effect = mock_get

        service = MQTTMessageService()
        service.handle_score_undo({'undo_code': 'UNDO_123', 'client_id': 'client1'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['success']

    def test_handle_mqtt_message_invalid_json(self):
        """测试MQTT消息处理-无效JSON"""

        service = MQTTMessageService()
        result = service.handle_mqtt_message(None, 'test/topic', 'invalid json')

        assert result is None

    @patch('services.mqtt_message_service.mqtt_logs')
    def test_handle_mqtt_message_valid(self, mock_logs):
        """测试MQTT消息处理-有效消息"""

        service = MQTTMessageService()

        with patch.object(service, 'handle_query_message') as mock_query:
            service.handle_mqtt_message(None, 'phonebox/query', '{"card_id": "123"}')
            mock_query.assert_called_once()

    @patch('services.mqtt_message_service.mqtt_logs')
    def test_handle_mqtt_message_score_add(self, mock_logs):
        """测试MQTT消息处理-积分增加"""

        service = MQTTMessageService()

        with patch.object(service, 'handle_score_add') as mock_add:
            service.handle_mqtt_message(None, 'score/add', '{"user_id": 1, "score_change": 10}')
            mock_add.assert_called_once()

    @patch('services.mqtt_message_service.mqtt_logs')
    def test_handle_mqtt_message_score_undo(self, mock_logs):
        """测试MQTT消息处理-积分撤销"""

        service = MQTTMessageService()

        with patch.object(service, 'handle_score_undo') as mock_undo:
            service.handle_mqtt_message(None, 'score/undo', '{"undo_code": "UNDO_123"}')
            mock_undo.assert_called_once()

    @patch('services.mqtt_message_service.mqtt_logs')
    def test_handle_mqtt_message_heartbeat(self, mock_logs):
        """测试MQTT消息处理-心跳"""

        service = MQTTMessageService()

        with patch.object(service, 'handle_heartbeat_message') as mock_heartbeat:
            service.handle_mqtt_message(None, 'phonebox/heartbeat', '{"device_id": "dev001"}')
            mock_heartbeat.assert_called_once()

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.db_session_scope')
    @patch('models.ProcessedMessage')
    @patch('services.mqtt_message_service.get_by_id')
    def test_handle_score_add_idempotent(self, mock_get_by_id, mock_processed, mock_db_scope, mock_publish):
        """测试积分增加-幂等处理"""
        mock_processed.query.filter_by.return_value.first.return_value = Mock(new_score=80, record_id=123)

        service = MQTTMessageService()
        service.handle_score_add({'msg_id': 'msg001', 'client_id': 'client1', 'user_id': 1})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['success']
        assert 'already processed' in payload['message']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('models.ProcessedMessage')
    @patch('services.mqtt_message_service.get_by_id')
    def test_handle_score_add_user_not_found(self, mock_get_by_id, mock_processed, mock_publish):
        """测试积分增加-用户不存在"""
        mock_processed.query.filter_by.return_value.first.return_value = None
        mock_get_by_id.return_value = None

        service = MQTTMessageService()
        service.handle_score_add({'msg_id': 'msg001', 'client_id': 'client1', 'user_id': 1})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('services.mqtt_message_service.db_session_scope')
    @patch('models.ProcessedMessage')
    @patch('services.mqtt_message_service.get_by_id')
    @patch('models.ScoreRule')
    @patch('models.ScoreRecord')
    @patch('models.db')
    def test_handle_score_add_direct_score(
        self, mock_db, mock_score_record, mock_score_rule,
        mock_get_by_id, mock_processed, mock_db_scope,
        mock_publish, app
    ):
        """测试积分增加-直接指定分数"""
        mock_processed.query.filter_by.return_value.first.return_value = None

        class MockUser:
            id = 1
            current_score = 70

        class MockRecord:
            id = 123
            score_change = 10

        mock_get_by_id.return_value = MockUser()
        mock_score_rule.query.filter.return_value.first.return_value = None
        mock_score_record.return_value = MockRecord()

        service = MQTTMessageService()
        with app.app_context():
            service.handle_score_add({
                'msg_id': 'msg001',
                'client_id': 'client1',
                'user_id': 1,
                'score_change': 10,
                'description': 'Test'
            })

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['success']

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('models.ScoreRule')
    def test_handle_score_rules_query_success(self, mock_rule, mock_publish):
        """测试设备查询积分规则：返回启用规则列表"""
        mock_rule_obj = Mock()
        mock_rule_obj.id = 1
        mock_rule_obj.name = "课堂表现加分"
        mock_rule_obj.description = "积极发言"
        mock_rule_obj.score = 5
        mock_rule_obj.category = None
        mock_rule_obj.daily_limit = 0
        mock_rule_obj.min_interval = 0
        mock_rule_obj.score_type = "fixed"
        mock_rule_obj.start_time = None
        mock_rule_obj.end_time = None
        mock_rule.query.filter_by.return_value.order_by.return_value.all.return_value = [mock_rule_obj]

        service = MQTTMessageService()
        service.handle_score_rules_query({'request_id': 'req_rules_1'})

        mock_publish.assert_called_once()
        assert mock_publish.call_args[0][0] == 'score/rules/result'
        payload = json.loads(mock_publish.call_args[0][1])
        assert payload['success']
        assert payload['count'] == 1
        assert payload['rules'][0]['name'] == '课堂表现加分'
        assert payload['request_id'] == 'req_rules_1'

    @patch('services.mqtt_message_service.publish_mqtt')
    @patch('models.ScoreRule')
    def test_handle_score_rules_query_failure(self, mock_rule, mock_publish):
        """测试设备查询规则查询异常：诚实返回失败而非伪装空列表"""
        mock_rule.query.filter_by.side_effect = Exception('db error')

        service = MQTTMessageService()
        service.handle_score_rules_query({'request_id': 'req_rules_2'})

        mock_publish.assert_called_once()
        payload = json.loads(mock_publish.call_args[0][1])
        assert not payload['success']
        assert 'Failed to load' in payload['message']
