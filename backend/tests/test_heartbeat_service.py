"""
Heartbeat Service Test Cases
"""
# 测试设备心跳服务的核心功能
"""
"""
import uuid
from datetime import datetime, timedelta
from models import Device, DeviceAlert
try:
    from services.heartbeat_service import update_device_heartbeat
except ImportError:
    pass

try:
    from services.heartbeat_service import check_heartbeat_timeout
except ImportError:
    pass

try:
    from services.heartbeat_service import get_device_heartbeat_status
except ImportError:
    pass


class TestHeartbeatService:
    """测试心跳服务"""

    def test_update_device_heartbeat_success(self, app, session):
        """测试更新设备心跳成功"""
        with app.app_context():
            device = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='测试设备',
                status='offline',
                last_error='心跳超时'
            )
            session.add(device)
            session.commit()

            from services.heartbeat_service import update_device_heartbeat

            result = update_device_heartbeat(device.device_id)

            assert result is True
            assert device.status == 'online'
            assert device.last_error is None
            assert device.last_heartbeat is not None

    def test_update_device_heartbeat_with_data(self, app, session):
        """测试更新设备心跳并携带数据"""
        with app.app_context():
            device = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='测试设备',
                status='offline'
            )
            session.add(device)
            session.commit()

            heartbeat_data = {
                'wifi_signal': -50,
                'battery_level': 85,
                'temperature': 25
            }
            result = update_device_heartbeat(device.device_id, heartbeat_data)

            assert result is True
            assert device.wifi_signal == -50
            assert device.battery_level == 85
            assert device.temperature == 25

    def test_update_device_heartbeat_not_found(self, app):
        """测试更新不存在设备的心跳"""
        with app.app_context():

            result = update_device_heartbeat('INVALID_DEVICE_ID')

            assert result is False

    def test_check_heartbeat_timeout_no_devices(self, app):
        """测试检查心跳超时（无设备）"""
        with app.app_context():
            from services.heartbeat_service import check_heartbeat_timeout

            result = check_heartbeat_timeout(60)

            assert 'total_timeout' in result
            assert 'alerts_created' in result

    def test_check_heartbeat_timeout_with_timeout(self, app, session):
        """测试检查心跳超时（有超时设备）"""
        with app.app_context():
            device = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='测试设备',
                status='online',
                last_heartbeat=datetime.now() - timedelta(seconds=120),
                alert_enabled=True,
                heartbeat_timeout=60
            )
            session.add(device)
            session.commit()

            result = check_heartbeat_timeout(60)

            assert result['total_timeout'] >= 1

    def test_check_heartbeat_timeout_existing_alert(self, app, session):
        """测试检查心跳超时（已有未解决告警）"""
        with app.app_context():
            device = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='测试设备',
                status='online',
                last_heartbeat=datetime.now() - timedelta(seconds=120),
                alert_enabled=True,
                heartbeat_timeout=60
            )
            session.add(device)

            alert = DeviceAlert(
                device_id=device.device_id,
                alert_type='heartbeat_timeout',
                severity='warning',
                message='心跳超时告警',
                is_resolved=False
            )
            session.add(alert)
            session.commit()

            result = check_heartbeat_timeout(60)

            assert result['alerts_created'] == 0

    def test_get_device_heartbeat_status_single(self, app, session):
        """测试获取单个设备心跳状态"""
        with app.app_context():
            device = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='测试设备',
                status='online',
                last_heartbeat=datetime.now(),
                alert_enabled=True,
                heartbeat_timeout=60
            )
            session.add(device)
            session.commit()

            from services.heartbeat_service import get_device_heartbeat_status

            result = get_device_heartbeat_status(device.device_id)

            assert result['total'] == 1
            assert result['devices'][0]['device_id'] == device.device_id

    def test_get_device_heartbeat_status_not_found(self, app):
        """测试获取不存在设备的心跳状态"""
        with app.app_context():

            result = get_device_heartbeat_status('INVALID_DEVICE_ID')

            assert result['total'] == 0
            assert len(result['devices']) == 0

    def test_get_device_heartbeat_status_no_heartbeat(self, app, session):
        """测试获取无心跳时间设备的状态"""
        with app.app_context():
            device = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='测试设备',
                status='online',
                last_heartbeat=None,
                alert_enabled=True,
                heartbeat_timeout=60
            )
            session.add(device)
            session.commit()

            result = get_device_heartbeat_status(device.device_id)

            assert result['total'] == 1
            assert result['devices'][0]['last_heartbeat'] is None
            assert result['devices'][0]['is_timeout'] is False

    def test_get_device_heartbeat_status_all(self, app, session):
        """测试获取所有设备心跳状态"""
        with app.app_context():
            device1 = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='在线设备',
                status='online',
                last_heartbeat=datetime.now(),
                alert_enabled=True,
                heartbeat_timeout=60
            )
            device2 = Device(
                device_id=f'{uuid.uuid4().hex}',
                name='离线设备',
                status='offline',
                last_heartbeat=datetime.now() - timedelta(seconds=120),
                alert_enabled=True,
                heartbeat_timeout=60
            )
            session.add(device1)
            session.add(device2)
            session.commit()

            result = get_device_heartbeat_status()

            assert result['total'] >= 2
            assert result['online'] >= 1
            assert result['offline'] >= 1
