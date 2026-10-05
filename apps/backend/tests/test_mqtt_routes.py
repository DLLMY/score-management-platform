class _NoOpLimiter:
    """测试环境下的 no-op 限流器：轻量测试 app 未初始化 flask_limiter，
    路由内 get_limiter() 返回 None 会触发 None.limit 异常。此处注入等价无操作限流，
    仅验证路由的鉴权/校验/调用编排，不依赖外部限流存储。"""

    def limit(self, *args, **kwargs):
        def decorator(func):
            return func

        return decorator


class TestMQTTRoutes:

    def test_mqtt_status(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/mqtt/status", headers=auth_headers)
            assert response.status_code in [200, 401, 403]

    def test_mqtt_publish(self, client, app, auth_headers, monkeypatch):
        import api.monitoring.mqtt_routes as mqtt_routes

        # 隔离外部依赖：限流器（测试 app 未初始化）+ MQTT 实际下发（沙箱无 broker）
        monkeypatch.setattr(mqtt_routes, "get_limiter", lambda: _NoOpLimiter())
        monkeypatch.setattr(mqtt_routes, "publish_mqtt", lambda *a, **k: True)
        with app.app_context():
            response = client.post(
                "/api/mqtt/publish",
                json={"topic": "test/topic", "message": "test message"},
                headers=auth_headers,
            )
            assert response.status_code in [200, 400, 401, 403]

    def test_mqtt_config_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/mqtt/config", headers=auth_headers)
            assert response.status_code in [200, 401, 403]

    def test_mqtt_logs(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/mqtt/logs", headers=auth_headers)
            assert response.status_code in [200, 401, 403]
