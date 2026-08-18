import pytest

try:
    from utils.security import generate_tokens
except ImportError:
    pass


@pytest.fixture(scope="function")
def auth_headers(app):
    """Generate authentication headers for API requests"""
    with app.app_context():
        from utils.security import generate_tokens

        tokens = generate_tokens(1, "test_admin", "admin")
        return {"Authorization": f'Bearer {tokens.get("access_token")}'}


def test_classes_api_consistency(app, auth_headers):
    """Test classes API consistency with authentication"""
    with app.test_client() as client:
        response = client.get("/api/classes", headers=auth_headers)

        assert response.status_code == 200

        data = response.get_json()
        assert data["success"] is True
        assert "data" in data
        assert "classes" in data["data"]


def test_subjects_api_consistency(app, auth_headers):
    """Test subjects API consistency with authentication"""
    with app.test_client() as client:
        response = client.get("/api/subjects", headers=auth_headers)

        assert response.status_code == 200


def test_rules_api_consistency(app, auth_headers):
    """Test rules API consistency with authentication"""
    with app.test_client() as client:
        response = client.get("/api/rules", headers=auth_headers)

        assert response.status_code == 200

        data = response.get_json()
        assert data["success"] is True


def test_version_paths_consistency(app, auth_headers):
    """Test API version paths consistency"""
    with app.test_client() as client:
        response_default = client.get("/api/classes", headers=auth_headers)
        assert response_default.status_code == 200

        data_default = response_default.get_json()
        assert data_default["success"] is True
