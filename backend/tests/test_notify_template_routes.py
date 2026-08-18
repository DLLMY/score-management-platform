"""通知模板路由行为测试（F17 防腐层迁移前后一致性基线）。

契约说明（基于当前未迁移实现）：
- POST /api/notify_templates/        创建：status 200，返回 marshal_with 序列化裸 dict（无信封）
- GET  /api/notify_templates/         列表：status 200，返回模板 dict 列表
- GET  /api/notify_templates/<id>     详情：status 200，返回单个模板 dict
- PUT  /api/notify_templates/<id>     更新：status 200，返回更新后模板 dict
- DELETE /api/notify_templates/<id>   软删除：status 200，返回 APIResponse 信封 {success,message}
- POST /api/notify_templates/<id>/use 使用发送：成功返回裸 dict {success,message,template_id,topics}
                                        （status 200）；被上课时间拦截/无权限/发送失败返回 APIResponse.error（status 400）
- GET  /api/notify_templates/categories 分类：status 200，返回分类字符串列表

迁移核心契约：use 成功后必须在库内创建 NotifyHistory 记录且模板 usage_count 递增。
跨切面依赖 publish_mqtt / ClassTimeChecker 在测试中 mock 以保证确定性。
"""

from unittest.mock import patch

from models import NotifyTemplate, NotifyHistory


def _json(resp):
    return resp.get_json()


class TestNotifyTemplateRoutes:

    def test_list_templates(self, client, app, auth_headers):
        with app.app_context():
            resp = client.get("/api/notify_templates/", headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert isinstance(body, list)

    def test_create_template(self, client, app, auth_headers):
        payload = {"name": "上课提醒", "text": "请安静自习", "category": "课堂"}
        with app.app_context():
            resp = client.post("/api/notify_templates/", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["name"] == "上课提醒"
        assert body["text"] == "请安静自习"
        assert body["category"] == "课堂"
        assert body["usage_count"] == 0
        assert body["is_active"] is True
        assert isinstance(body["id"], int)

    def test_get_template_detail(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/notify_templates/", json={"name": "详情模板", "text": "x"}, headers=auth_headers
            )
            tid = _json(created)["id"]
            resp = client.get("/api/notify_templates/%d" % tid, headers=auth_headers)
        assert resp.status_code == 200
        assert _json(resp)["id"] == tid

    def test_update_template(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/notify_templates/", json={"name": "原", "text": "旧"}, headers=auth_headers
            )
            tid = _json(created)["id"]
            resp = client.put(
                "/api/notify_templates/%d" % tid,
                json={"name": "改后", "text": "新"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        body = _json(resp)
        assert body["name"] == "改后"
        assert body["text"] == "新"

    def test_delete_template(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/notify_templates/", json={"name": "删", "text": "x"}, headers=auth_headers
            )
            tid = _json(created)["id"]
            resp = client.delete("/api/notify_templates/%d" % tid, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["success"] is True
        assert "模板已删除" in body["message"]

    def test_use_template_broadcast(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/notify_templates/", json={"name": "用", "text": "播报内容"}, headers=auth_headers
            )
            tid = _json(created)["id"]
        with patch("api.scores.notify_template_routes.publish_mqtt") as mock_mqtt, patch(
            "api.scores.notify_template_routes.ClassTimeChecker"
        ) as mock_ctc:
            mock_ctc.is_broadcast_blocked.return_value = (False, "", None)
            mock_ctc.is_notification_allowed.return_value = (True, "", None, None)
            with app.app_context():
                resp = client.post(
                    "/api/notify_templates/%d/use" % tid, json={}, headers=auth_headers
                )
        assert resp.status_code == 200
        body = _json(resp)
        assert body["success"] is True
        assert body["template_id"] == tid
        assert "phonebox/remote/notify" in body["topics"]
        mock_mqtt.assert_called()
        # 核心迁移契约：库内落 NotifyHistory + usage_count 递增
        with app.app_context():
            hist_count = NotifyHistory.query.filter_by(template_id=tid).count()
            tpl = NotifyTemplate.query.get(tid)
            assert hist_count >= 1
            assert tpl.usage_count >= 1

    def test_use_template_class_time_blocked(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/notify_templates/", json={"name": "拦", "text": "x"}, headers=auth_headers
            )
            tid = _json(created)["id"]
        with patch("api.scores.notify_template_routes.publish_mqtt"), patch(
            "api.scores.notify_template_routes.ClassTimeChecker"
        ) as mock_ctc:
            mock_ctc.is_broadcast_blocked.return_value = (True, "上课时间", "GLOBAL_TIME_RULE")
            mock_ctc.is_notification_allowed.return_value = (True, "", None, None)
            with app.app_context():
                resp = client.post(
                    "/api/notify_templates/%d/use" % tid, json={}, headers=auth_headers
                )
        assert resp.status_code == 400
        assert "上课时间" in _json(resp)["message"]

    def test_use_template_force_send_no_permission(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/notify_templates/", json={"name": "强", "text": "x"}, headers=auth_headers
            )
            tid = _json(created)["id"]
        with patch("api.scores.notify_template_routes.publish_mqtt"), patch(
            "api.scores.notify_template_routes.ClassTimeChecker"
        ) as mock_ctc, patch(
            "api.scores.notify_template_routes.has_permission", return_value=False
        ):
            mock_ctc.is_broadcast_blocked.return_value = (False, "", None)
            mock_ctc.is_notification_allowed.return_value = (True, "", None, None)
            with app.app_context():
                resp = client.post(
                    "/api/notify_templates/%d/use" % tid,
                    json={"force_send": True},
                    headers=auth_headers,
                )
        assert resp.status_code == 400
        assert "强制发送权限" in _json(resp)["message"]

    def test_get_categories(self, client, app, auth_headers):
        with app.app_context():
            client.post(
                "/api/notify_templates/",
                json={"name": "c1", "text": "x", "category": "课堂"},
                headers=auth_headers,
            )
            resp = client.get("/api/notify_templates/categories", headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert isinstance(body, list)
        assert "课堂" in body
