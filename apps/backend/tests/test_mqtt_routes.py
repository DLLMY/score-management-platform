class TestMQTTRoutes:

    def test_mqtt_status(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/mqtt/status", headers=auth_headers)
            assert response.status_code in [200, 401, 403]

    def test_mqtt_publish(self, client, app, auth_headers):
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
