"""认证服务单元测试"""
from utils.security import generate_tokens, validate_token, hash_password, verify_password


class TestSecurityUtils:
    """安全工具函数测试"""

    def test_hash_password(self):
        """测试密码哈希"""
        password = 'testpassword123'
        hashed = hash_password(password)

        assert hashed is not None
        assert len(hashed) > 0
        assert hashed != password

    def test_verify_password_correct(self):
        """测试正确密码验证"""
        password = 'testpassword123'
        hashed = hash_password(password)

        result = verify_password(password, hashed)

        assert result is True

    def test_verify_password_incorrect(self):
        """测试错误密码验证"""
        password = 'testpassword123'
        wrong_password = 'wrongpassword'
        hashed = hash_password(password)

        result = verify_password(wrong_password, hashed)

        assert result is False

    def test_generate_tokens(self, sample_admin):
        """测试生成JWT令牌"""
        tokens = generate_tokens(sample_admin.id, sample_admin.username, sample_admin.role)

        assert 'access_token' in tokens
        assert 'refresh_token' in tokens
        assert 'expires_in' in tokens
        assert tokens['access_token'] is not None
        assert tokens['refresh_token'] is not None

    def test_validate_token_success(self, sample_admin):
        """测试验证有效令牌"""
        tokens = generate_tokens(sample_admin.id, sample_admin.username, sample_admin.role)
        payload = validate_token(tokens['access_token'])

        assert payload is not None
        assert payload.get('sub') == str(sample_admin.id)

    def test_validate_token_invalid(self):
        """测试验证无效令牌"""
        invalid_token = 'invalid.token.here'
        payload = validate_token(invalid_token)

        assert payload is None


class TestAuthRoutes:
    """认证路由测试"""

    def test_login_success(self, client, sample_admin):
        """测试成功登录"""
        response = client.post('/api/auth/login', json={
            'username': sample_admin.username,
            'password': 'test123456'
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is True
        assert data.get('access_token') is not None

    def test_login_invalid_username(self, client):
        """测试无效用户名登录"""
        response = client.post('/api/auth/login', json={
            'username': 'nonexistent',
            'password': 'password123'
        })

        assert response.status_code in [400, 401]

    def test_login_invalid_password(self, client, sample_admin):
        """测试无效密码登录"""
        response = client.post('/api/auth/login', json={
            'username': sample_admin.username,
            'password': 'wrongpassword'
        })

        assert response.status_code in [400, 401]

    def test_login_missing_fields(self, client):
        """测试缺失字段登录"""
        response = client.post('/api/auth/login', json={
            'username': 'testadmin'
        })

        assert response.status_code in [400, 401]

    def test_logout(self, client, auth_headers):
        """测试登出"""
        response = client.post('/api/auth/logout', headers=auth_headers)

        assert response.status_code in [200, 400]
