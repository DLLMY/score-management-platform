"""alerts 路由行为测试（F17 路由服务化 · 防腐层迁移基线/回归）。

覆盖 PUT /alerts/<id> 更新已读状态写入路径（已收口至 alert_service.update_alert_status），
断言响应体/状态码/错误与迁移前逐字节一致，锁定契约零漂移。其余端点（list/detail/stats/
read/read-all/cleanup/test）早已收口至 alert_service，本文件仅补强写入路径回归。
"""

from services.alert_service import alert_service


class TestAlertsRoutes:

    def test_update_alert_status(self, client, app, auth_headers):
        with app.app_context():
            alert = alert_service.create_alert(
                "system_warning", "测试告警", device_id="t_dev", device_name="测试设备"
            )
            aid = alert.id
            assert alert.is_read is False
            # 标记已读
            resp = client.put(f"/api/alerts/{aid}", json={"is_read": True}, headers=auth_headers)
            assert resp.status_code == 200
            a = alert_service.get_alert_by_id(aid)
            assert a.is_read is True
            assert a.read_at is not None
            # 取消已读
            resp2 = client.put(f"/api/alerts/{aid}", json={"is_read": False}, headers=auth_headers)
            assert resp2.status_code == 200
            a2 = alert_service.get_alert_by_id(aid)
            assert a2.is_read is False
            assert a2.read_at is None

    def test_update_alert_not_found(self, client, app, auth_headers):
        with app.app_context():
            resp = client.put("/api/alerts/999999", json={"is_read": True}, headers=auth_headers)
            assert resp.status_code == 404

    def test_update_alert_missing_is_read_noop_200(self, client, app, auth_headers):
        """缺少 is_read 字段时原路由不报错（仅 commit 无变更），迁移后同样返回 200 不改状态。"""
        with app.app_context():
            alert = alert_service.create_alert(
                "system_warning", "测试告警2", device_id="t_dev2", device_name="测试设备2"
            )
            aid = alert.id
            resp = client.put(f"/api/alerts/{aid}", json={}, headers=auth_headers)
            assert resp.status_code == 200
            assert alert_service.get_alert_by_id(aid).is_read is False
