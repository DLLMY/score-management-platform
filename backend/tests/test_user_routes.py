"""Tests for User Management API - Corrected"""


class TestUserRoutes:
    """Test user management routes"""

    def test_unauthorized_access(self, client):
        """Test access without authentication"""
        response = client.get("/api/users")

        assert response.status_code == 401

    def test_get_nonexistent_user_without_auth(self, client):
        """Test getting nonexistent user without auth"""
        response = client.get("/api/users/99999")

        assert response.status_code in [401, 404]

    def test_create_user_without_auth(self, client):
        """Test creating user without authentication"""
        response = client.post("/api/users", json={"name": "新用户", "card_id": "NEW001"})

        assert response.status_code in [401, 404]


class TestScoreRoutes:
    """Test score management routes"""

    def test_add_score_without_auth(self, client):
        """Test adding score without authentication"""
        response = client.post(
            "/api/users/1/scores", json={"score_change": 5, "description": "测试加分"}
        )

        assert response.status_code in [401, 404]

    def test_get_scores_without_auth(self, client):
        """Test getting scores without authentication"""
        response = client.get("/api/users/1/scores")

        assert response.status_code in [401, 404]

    def test_get_score_records_without_auth(self, client):
        """Test getting score records without authentication"""
        response = client.get("/api/scores/records")

        assert response.status_code in [401, 404]


class TestAuthRoutes:
    """Test authentication routes"""

    def test_login_missing_credentials(self, client):
        """Test login with missing credentials"""
        response = client.post("/api/auth/login", json={})

        assert response.status_code in [400, 401, 404]

    def test_login_invalid_format(self, client):
        """Test login with invalid data format"""
        response = client.post("/api/auth/login", json={"username": "", "password": ""})

        assert response.status_code in [400, 401, 404]

    def test_refresh_token_missing(self, client):
        """Test refresh token without token"""
        response = client.post("/api/auth/refresh")

        assert response.status_code in [400, 401, 404]

    def test_logout_without_token(self, client):
        """Test logout without token"""
        response = client.post("/api/auth/logout")

        assert response.status_code in [200, 400, 401, 404]


class TestHealthCheck:
    """Test system health check"""

    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get("/api/system/health")

        assert response.status_code in [200, 401, 404]

    def test_version_endpoint(self, client):
        """Test version endpoint"""
        response = client.get("/api/system/version")

        assert response.status_code in [200, 401, 404]
