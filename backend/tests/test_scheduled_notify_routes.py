"""定时通知路由行为测试（F17 防腐层迁移前后一致性基线）。

契约说明（基于当前未迁移实现）：
- GET  /api/scheduled_notify/          列表：status 200，返回定时通知 dict 列表
- POST /api/scheduled_notify/          创建：status 200，返回裸 dict {success,message,id}（无信封）
- GET  /api/scheduled_notify/<id>      详情：status 200，返回单个 dict（含 scheduled_at isoformat / repeat_day_of_week 列表）
- PUT  /api/scheduled_notify/<id>      更新：status 200，返回 APIResponse 信封 {success,code,message}
- DELETE /api/scheduled_notify/<id>    删除：status 200，返回 APIResponse 信封；删除后详情 404
- POST /api/scheduled_notify/<id>/cancel   取消：status 200，信封；status 变 'cancelled'
- POST /api/scheduled_notify/<id>/trigger  立即触发：成功 status 200 信封 {success,message:"通知已发送"}；
                                        被上课时间拦截 / 无强制发送权限 返回 APIResponse.error（status 400）
- 后台任务 process_scheduled_notifications：挑选 pending 且到点通知，MQTT 成功后落 NotifyHistory 并推进 status

迁移核心契约：trigger / process 成功后必须在库内创建 NotifyHistory 记录并推进 notify 状态。
跨切面依赖 publish_mqtt / ClassTimeChecker / has_permission 在测试中 mock 以保证确定性。
"""

from datetime import datetime, timedelta
from unittest.mock import patch

from models import ScheduledNotify, NotifyHistory, db


def _json(resp):
    return resp.get_json()


class TestScheduledNotifyRoutes:

    def test_list_scheduled(self, client, app, auth_headers):
        with app.app_context():
            resp = client.get("/api/scheduled_notify/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(_json(resp), list)

    def test_create_scheduled(self, client, app, auth_headers):
        payload = {
            "text": "午休提醒",
            "scheduled_at": "2026-08-17T20:00:00",
            "send_mode": "broadcast",
            "repeat_type": "once",
        }
        with app.app_context():
            resp = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["success"] is True
        assert "定时通知已创建" in body["message"]
        assert isinstance(body["id"], int)
        # 落库确认
        with app.app_context():
            assert ScheduledNotify.query.get(body["id"]) is not None

    def test_get_detail(self, client, app, auth_headers):
        payload = {"text": "详情通知", "scheduled_at": "2026-08-17T21:00:00", "repeat_day_of_week": [0, 2, 4]}
        with app.app_context():
            created = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
            nid = _json(created)["id"]
            resp = client.get("/api/scheduled_notify/%d" % nid, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["id"] == nid
        assert body["text"] == "详情通知"
        assert isinstance(body["repeat_day_of_week"], list)
        assert body["repeat_day_of_week"] == [0, 2, 4]
        assert body["scheduled_at"] == "2026-08-17T21:00:00"

    def test_update_scheduled(self, client, app, auth_headers):
        payload = {"text": "原文本", "scheduled_at": "2026-08-17T22:00:00"}
        with app.app_context():
            created = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
            nid = _json(created)["id"]
            resp = client.put(
                "/api/scheduled_notify/%d" % nid, json={"text": "改后文本"}, headers=auth_headers
            )
        assert resp.status_code == 200
        body = _json(resp)
        assert body["success"] is True
        assert "定时通知已更新" in body["message"]
        with app.app_context():
            assert ScheduledNotify.query.get(nid).text == "改后文本"

    def test_delete_scheduled(self, client, app, auth_headers):
        payload = {"text": "删除通知", "scheduled_at": "2026-08-17T23:00:00"}
        with app.app_context():
            created = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
            nid = _json(created)["id"]
            resp = client.delete("/api/scheduled_notify/%d" % nid, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["success"] is True
        assert "定时通知已删除" in body["message"]
        with app.app_context():
            assert ScheduledNotify.query.get(nid) is None

    def test_cancel_scheduled(self, client, app, auth_headers):
        payload = {"text": "取消通知", "scheduled_at": "2026-08-18T08:00:00"}
        with app.app_context():
            created = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
            nid = _json(created)["id"]
            resp = client.post("/api/scheduled_notify/%d/cancel" % nid, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["success"] is True
        assert "定时通知已取消" in body["message"]
        with app.app_context():
            assert ScheduledNotify.query.get(nid).status == "cancelled"

    def test_trigger_success_broadcast(self, client, app, auth_headers):
        payload = {
            "text": "触发广播",
            "scheduled_at": "2026-08-17T20:00:00",
            "send_mode": "broadcast",
            "repeat_type": "once",
        }
        with app.app_context():
            created = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
            nid = _json(created)["id"]
        with patch("api.scores.scheduled_notify_routes.publish_mqtt", return_value=True), patch(
            "api.scores.scheduled_notify_routes.ClassTimeChecker"
        ) as mock_ctc:
            mock_ctc.is_broadcast_blocked.return_value = (False, "", None)
            mock_ctc.is_notification_allowed.return_value = (True, "", None, None)
            with app.app_context():
                resp = client.post("/api/scheduled_notify/%d/trigger" % nid, json={}, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["success"] is True
        assert "通知已发送" in body["message"]
        # 核心迁移契约：库内落 NotifyHistory + 状态推进为 sent
        with app.app_context():
            hist_count = NotifyHistory.query.filter_by(topic="phonebox/remote/notify,phonebox/remote/notify/all").count()
            assert hist_count >= 1
            assert ScheduledNotify.query.get(nid).status == "sent"

    def test_trigger_class_time_blocked(self, client, app, auth_headers):
        payload = {"text": "拦截通知", "scheduled_at": "2026-08-17T20:00:00", "send_mode": "broadcast"}
        with app.app_context():
            created = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
            nid = _json(created)["id"]
        with patch("api.scores.scheduled_notify_routes.publish_mqtt", return_value=True), patch(
            "api.scores.scheduled_notify_routes.ClassTimeChecker"
        ) as mock_ctc:
            mock_ctc.is_broadcast_blocked.return_value = (True, "上课时间", "GLOBAL_TIME_RULE")
            mock_ctc.is_notification_allowed.return_value = (True, "", None, None)
            with app.app_context():
                resp = client.post("/api/scheduled_notify/%d/trigger" % nid, json={}, headers=auth_headers)
        assert resp.status_code == 400
        assert "上课时间" in _json(resp)["message"]

    def test_trigger_force_send_no_permission(self, client, app, auth_headers):
        payload = {"text": "强发通知", "scheduled_at": "2026-08-17T20:00:00", "send_mode": "broadcast"}
        with app.app_context():
            created = client.post("/api/scheduled_notify/", json=payload, headers=auth_headers)
            nid = _json(created)["id"]
        with patch("api.scores.scheduled_notify_routes.publish_mqtt", return_value=True), patch(
            "api.scores.scheduled_notify_routes.ClassTimeChecker"
        ) as mock_ctc, patch(
            "api.scores.scheduled_notify_routes.has_permission", return_value=False
        ):
            mock_ctc.is_broadcast_blocked.return_value = (False, "", None)
            mock_ctc.is_notification_allowed.return_value = (True, "", None, None)
            with app.app_context():
                resp = client.post(
                    "/api/scheduled_notify/%d/trigger" % nid,
                    json={"force_send": True},
                    headers=auth_headers,
                )
        assert resp.status_code == 400
        assert "强制发送权限" in _json(resp)["message"]

    def test_process_scheduled_notifications(self, client, app, auth_headers):
        with app.app_context():
            now = datetime.now()
            notify = ScheduledNotify(
                text="后台到点通知",
                scheduled_at=now - timedelta(hours=1),
                next_send_at=now - timedelta(minutes=5),
                repeat_type="once",
                send_mode="broadcast",
                status="pending",
                created_by=1,
            )
            db.session.add(notify)
            db.session.commit()
            nid = notify.id
        with patch("api.scores.scheduled_notify_routes.publish_mqtt", return_value=True), patch(
            "api.scores.scheduled_notify_routes.ClassTimeChecker"
        ) as mock_ctc:
            mock_ctc.is_broadcast_blocked.return_value = (False, "", None)
            mock_ctc.is_notification_allowed.return_value = (True, "", None, None)
            from api.scores.scheduled_notify_routes import process_scheduled_notifications

            with app.app_context():
                process_scheduled_notifications()
        with app.app_context():
            hist_count = NotifyHistory.query.filter_by(
                topic="phonebox/remote/notify,phonebox/remote/notify/all"
            ).count()
            assert hist_count >= 1
            assert ScheduledNotify.query.get(nid).status == "sent"
