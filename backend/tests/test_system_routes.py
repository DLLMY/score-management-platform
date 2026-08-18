class TestSystemRoutes:

    def test_get_health_check(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/system/health", headers=auth_headers)
            assert response.status_code == 200

    def test_get_system_config(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/system/config", headers=auth_headers)
            assert response.status_code == 200

    def test_update_system_config(self, client, app, auth_headers):
        with app.app_context():
            response = client.put("/api/system/config", json={"key": "value"}, headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 400

    def test_get_backups(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/system/backups", headers=auth_headers)
            assert response.status_code == 200

    def test_create_backup(self, client, app, auth_headers):
        with app.app_context():
            response = client.post("/api/system/backup", headers=auth_headers)
            assert response.status_code in [200, 400, 404]

    def test_clear_cache(self, client, app, auth_headers):
        with app.app_context():
            response = client.post("/api/system/clear-cache", headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 400

    def test_get_cache_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/system/cache-stats", headers=auth_headers)
            assert response.status_code == 200

    def test_get_csrf_token(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/system/csrf-token", headers=auth_headers)
            assert response.status_code == 200

    def test_get_performance(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/system/performance", headers=auth_headers)
            assert response.status_code == 200

    def test_get_system_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/system/stats", headers=auth_headers)
            assert response.status_code == 200


class TestFrontendTelemetryRoutes:
    """前端遥测写入端点契约（F17 迁移后：落库委托 services/frontend_telemetry_service）。"""

    def test_submit_frontend_performance(self, client, app):
        payload = {"type": "web_vital", "name": "FCP", "value": 123.4, "page": "/home"}
        with app.app_context():
            resp = client.post("/api/system/frontend-performance", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True
        assert "性能指标接收成功" in resp.get_json()["message"]

    def test_submit_frontend_performance_batch(self, client, app):
        payload = {
            "metrics": [
                {"type": "api", "name": "GET /x", "value": 12},
                {"type": "custom", "name": "render", "value": 3.5},
            ]
        }
        with app.app_context():
            resp = client.post("/api/system/frontend-performance/batch", json=payload)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "成功接收 2 条性能指标" in body["message"]

    def test_submit_frontend_performance_batch_invalid(self, client, app):
        payload = {"metrics": "not-a-list"}
        with app.app_context():
            resp = client.post("/api/system/frontend-performance/batch", json=payload)
        assert resp.status_code == 400

    def test_submit_frontend_error(self, client, app):
        payload = {"type": "js_error", "message": "boom", "page": "/home"}
        with app.app_context():
            resp = client.post("/api/system/frontend-error", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True
        assert "错误信息接收成功" in resp.get_json()["message"]
