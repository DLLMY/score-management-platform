import jwt

import api.system.security_routes as sr
from api.system.security_routes import verify_token_expiry
from utils import security as sec


class TestVerifyTokenExpiry:
    """R15：verify_token_expiry 必须用 JWT_SECRET_KEY 解码（与 generate_tokens / decode_token 同源），
    而非 SECRET_KEY。回归守卫：当运维显式分设 JWT_SECRET_KEY（安全最佳实践）时，旧实现
    （读 SECRET_KEY 解码）会拒收合法令牌，导致 /api/security/verify-token 失效。
    """

    def test_valid_access_token(self):
        token = sec.generate_tokens(1, "root", "super_admin")["access_token"]
        is_valid, payload = verify_token_expiry(token)
        assert is_valid is True
        assert payload["sub"] == "1"
        assert payload["type"] == "access"

    def test_expired_token(self):
        expired = jwt.encode(
            {"sub": "1", "type": "access", "exp": 1},  # 1970 -> 必然过期
            sec.JWT_SECRET_KEY,
            algorithm="HS256",
        )
        is_valid, msg = verify_token_expiry(expired)
        assert is_valid is False
        assert msg == "令牌已过期"

    def test_invalid_token(self):
        is_valid, msg = verify_token_expiry("not-a-valid-token")
        assert is_valid is False
        assert msg == "无效的令牌"

    def test_consistent_with_split_signing_key(self, monkeypatch):
        # 模拟“分设密钥”部署：JWT_SECRET_KEY 与 SECRET_KEY 不同。
        # 旧实现读 SECRET_KEY 解码会失败；修复后 verify_token_expiry 与签发同源（JWT_SECRET_KEY）。
        split_key = "split-jwt-secret-key-which-is-32bytelong!"
        monkeypatch.setattr(sec, "JWT_SECRET_KEY", split_key)
        monkeypatch.setattr(sr, "JWT_SECRET_KEY", split_key)
        token = sec.generate_tokens(7, "audit", "admin")["access_token"]
        is_valid, payload = verify_token_expiry(token)
        assert is_valid is True
        assert payload["sub"] == "7"
        assert payload["type"] == "access"
