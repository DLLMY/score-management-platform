try:
    from services.alert_service import AlertService
except ImportError:
    pass

try:
    import json
except ImportError:
    pass

try:
    from services.alert_service import alert_service
except ImportError:
    pass



class TestAlertService:
    """告警服务测试"""

    def test_get_severity(self):
        """测试获取告警级别"""
        from services.alert_service import AlertService

        service = AlertService()

        assert service._get_severity("device_offline") == "warning"
        assert service._get_severity("device_online") == "info"
        assert service._get_severity("score_abnormal") == "error"
        assert service._get_severity("unknown_type") == "info"

    def test_should_suppress(self):
        """测试告警抑制"""

        service = AlertService()

        assert service._should_suppress("device_offline") is False

        service._update_last_alert_time("device_offline")
        assert service._should_suppress("device_offline") is True

    def test_should_suppress_with_device_id(self):
        """测试带设备ID的告警抑制"""

        service = AlertService()

        service._update_last_alert_time("device_offline", "device1")
        assert service._should_suppress("device_offline", "device1") is True
        assert service._should_suppress("device_offline", "device2") is False

    def test_update_last_alert_time(self):
        """测试更新最后告警时间"""

        service = AlertService()
        service._update_last_alert_time("test_type")

        assert "test_type" in service.last_alert_time

    def test_create_alert(self, app):
        """测试创建告警"""

        service = AlertService()

        with app.app_context():
            alert = service.create_alert(
                "device_offline",
                "测试设备离线",
                device_id="test_device",
                device_name="测试设备",
                suppress=False
            )

            assert alert is not None
            assert alert.alert_type == "device_offline"
            assert alert.severity == "warning"
            assert alert.message == "测试设备离线"
            assert alert.device_id == "test_device"
            assert alert.is_read is False

    def test_create_alert_with_extra_data(self, app):
        """测试创建带额外数据的告警"""
        import json

        service = AlertService()

        with app.app_context():
            alert = service.create_alert(
                "score_abnormal",
                "积分异常",
                extra_data={"user_id": 1, "score": 100},
                suppress=False
            )

            assert alert is not None
            assert alert.extra_data == json.dumps({"user_id": 1, "score": 100})

    def test_create_alert_suppressed(self, app):
        """测试创建被抑制的告警"""

        service = AlertService()

        with app.app_context():
            service._update_last_alert_time("device_offline")
            alert = service.create_alert("device_offline", "测试告警")

            assert alert is None

    def test_get_alerts(self, app):
        """测试获取告警列表"""
        from services.alert_service import alert_service

        with app.app_context():
            alert_service.create_alert(
                "device_offline",
                "测试告警1",
                suppress=False
            )
            alert_service.create_alert(
                "system_error",
                "测试告警2",
                suppress=False
            )

            alerts = alert_service.get_alerts(limit=10)

            assert len(alerts) >= 2

    def test_get_alerts_filter_severity(self, app):
        """测试按级别过滤告警"""

        with app.app_context():
            alerts = alert_service.get_alerts(severity="error")

            for alert in alerts:
                assert alert.severity == "error"

    def test_get_alerts_filter_read(self, app):
        """测试按已读状态过滤告警"""

        with app.app_context():
            alerts = alert_service.get_alerts(is_read=False)

            for alert in alerts:
                assert alert.is_read is False

    def test_get_alert_by_id(self, app):
        """测试根据ID获取告警"""

        with app.app_context():
            alert = alert_service.create_alert(
                "device_offline",
                "测试告警",
                suppress=False
            )

            found = alert_service.get_alert_by_id(alert.id)

            assert found is not None
            assert found.id == alert.id

    def test_mark_as_read(self, app):
        """测试标记告警为已读"""

        with app.app_context():
            alert = alert_service.create_alert(
                "device_offline",
                "测试告警",
                suppress=False
            )

            result = alert_service.mark_as_read(alert.id)

            assert result is True

            found = alert_service.get_alert_by_id(alert.id)
            assert found.is_read is True

    def test_mark_as_read_not_found(self, app):
        """测试标记不存在的告警"""

        with app.app_context():
            result = alert_service.mark_as_read(99999)

            assert result is False

    def test_mark_all_as_read(self, app):
        """测试标记所有告警为已读"""

        with app.app_context():
            alert_service.create_alert("device_offline", "告警1", suppress=False)
            alert_service.create_alert("device_offline", "告警2", suppress=False)

            count = alert_service.mark_all_as_read()

            assert count >= 2

    def test_delete_alert(self, app):
        """测试删除告警"""

        with app.app_context():
            alert = alert_service.create_alert(
                "device_offline",
                "测试告警",
                suppress=False
            )

            result = alert_service.delete_alert(alert.id)

            assert result is True

            found = alert_service.get_alert_by_id(alert.id)
            assert found is None

    def test_delete_alert_not_found(self, app):
        """测试删除不存在的告警"""

        with app.app_context():
            result = alert_service.delete_alert(99999)

            assert result is False

    def test_delete_old_alerts(self, app):
        """测试删除过期告警"""

        with app.app_context():
            count = alert_service.delete_old_alerts(days=365)

            assert isinstance(count, int)

    def test_get_alert_stats(self, app):
        """测试获取告警统计"""

        with app.app_context():
            stats = alert_service.get_alert_stats()

            assert "total" in stats
            assert "unread" in stats
            assert "by_severity" in stats
            assert "today_count" in stats

    def test_trigger_device_offline_alert(self, app):
        """测试触发设备离线告警"""

        with app.app_context():
            alert = alert_service.trigger_device_offline_alert(
                "device1",
                "测试设备",
            )

            assert alert is not None
            assert alert.alert_type == "device_offline"

    def test_trigger_device_online_alert(self, app):
        """测试触发设备上线告警"""

        with app.app_context():
            alert = alert_service.trigger_device_online_alert(
                "device1",
                "测试设备",
            )

            assert alert is not None
            assert alert.alert_type == "device_online"

    def test_trigger_score_abnormal_alert(self, app):
        """测试触发积分异常告警"""

        with app.app_context():
            alert = alert_service.trigger_score_abnormal_alert(
                1, "张三", 100, "测试原因"
            )

            assert alert is not None
            assert alert.alert_type == "score_abnormal"

    def test_trigger_score_threshold_alert(self, app):
        """测试触发积分阈值告警"""

        with app.app_context():
            alert = alert_service.trigger_score_threshold_alert(
                1, "张三", 50, "低于下限"
            )

            assert alert is not None
            assert alert.alert_type == "score_threshold"

    def test_trigger_system_error_alert(self, app):
        """测试触发系统错误告警"""

        service = AlertService()

        with app.app_context():
            alert = service.trigger_system_error_alert(
                "测试错误", "test"
            )

            assert alert is not None
            assert alert.alert_type == "system_error"

    def test_trigger_system_warning_alert(self, app):
        """测试触发系统警告告警"""

        with app.app_context():
            alert = alert_service.trigger_system_warning_alert(
                "测试警告"
            )

            assert alert is not None
            assert alert.alert_type == "system_warning"

    def test_trigger_mqtt_disconnect_alert(self, app):
        """测试触发MQTT断开告警"""

        with app.app_context():
            alert = alert_service.trigger_mqtt_disconnect_alert(
                "client1"
            )

            assert alert is not None
            assert alert.alert_type == "mqtt_disconnect"

    def test_trigger_high_memory_alert(self, app):
        """测试触发内存过高告警"""

        with app.app_context():
            alert = alert_service.trigger_high_memory_alert(95.5)

            assert alert is not None
            assert alert.alert_type == "high_memory"

    def test_trigger_high_cpu_alert(self, app):
        """测试触发CPU过高告警"""

        with app.app_context():
            alert = alert_service.trigger_high_cpu_alert(90.0)

            assert alert is not None
            assert alert.alert_type == "high_cpu"
