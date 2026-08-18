class TestPermissionDecorators:

    def test_requires_admin_no_token(self, client, app):
        with app.app_context():
            response = client.get("/api/rules/")
            assert response.status_code == 401

    def test_requires_admin_invalid_token(self, client, app):
        with app.app_context():
            response = client.get("/api/rules/", headers={"Authorization": "Bearer invalid_token"})
            assert response.status_code == 401

    def test_requires_permission_no_token(self, client, app):
        with app.app_context():
            response = client.get("/api/rules/")
            assert response.status_code == 401

    def test_requires_permission_valid_token(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/rules/", headers=auth_headers)
            assert response.status_code == 200

    def test_requires_permission_valid_token_rules(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/rules/", headers=auth_headers)
            assert response.status_code == 200

    def test_requires_permission_valid_token_devices(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/devices/", headers=auth_headers)
            assert response.status_code == 200

    def test_requires_permission_valid_token_records(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/", headers=auth_headers)
            assert response.status_code == 200

    def test_requires_permission_valid_token_rank_rules(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/rank-rules/", headers=auth_headers)
            assert response.status_code == 200

    def test_requires_permission_valid_token_classes(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/classes/", headers=auth_headers)
            assert response.status_code == 200
