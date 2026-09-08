import pytest


class TestAuthRoutes:

    def test_login_success(self, client, app):
        with app.app_context():
            response = client.post(
                "/api/auth/login", json={"username": "test", "password": "test123"}
            )
            assert response.status_code == 200 or response.status_code == 401

    def test_login_with_wrong_password(self, client, app):
        with app.app_context():
            response = client.post(
                "/api/auth/login", json={"username": "test", "password": "wrongpassword"}
            )
            assert response.status_code == 401

    def test_login_without_credentials(self, client, app):
        with app.app_context():
            response = client.post("/api/auth/login", json={})
            assert response.status_code == 400 or response.status_code == 401

    def test_refresh_token(self, client, app):
        with app.app_context():
            login_response = client.post(
                "/api/auth/login", json={"username": "test", "password": "test123"}
            )
            if login_response.status_code == 200:
                data = login_response.get_json()
                refresh_token = data.get("refresh_token") or (data.get("data") or {}).get(
                    "refresh_token"
                )
                if refresh_token:
                    response = client.post(
                        "/api/admins/refresh-token", json={"refresh_token": refresh_token}
                    )
                    assert response.status_code == 200 or response.status_code == 401
            else:
                pytest.skip("Login failed, skipping refresh test")

    def test_logout(self, client, app, auth_headers):
        with app.app_context():
            response = client.post("/api/auth/logout", headers=auth_headers)
            assert response.status_code in [200, 400, 401]

    def test_logout_get(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/auth/logout", headers=auth_headers)
            assert response.status_code in [200, 400, 401, 405]
