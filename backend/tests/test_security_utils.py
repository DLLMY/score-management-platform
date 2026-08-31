from utils.security import validate_integer
from utils.security import validate_gender
from utils.security import validate_class_name
import jwt
from datetime import datetime, timedelta, timezone
from utils.security import (
    generate_tokens,
    decode_token,
    validate_token,
    hash_password,
    verify_password,
    sanitize_input,
    validate_email,
    validate_phone,
    validate_username,
    validate_password,
    is_strong_password,
    validate_card_id,
    validate_integer,
    validate_string_length,
    validate_score,
    validate_class_name,
    validate_gender,
    validate_status,
    validate_datetime,
    validate_json,
    sanitize_filename,
    is_safe_redirect_url,
)

try:
    from utils.security import JWT_SECRET_KEY
except ImportError:
    pass


class TestSecurityUtils:

    def test_generate_tokens(self):
        tokens = generate_tokens(1, "admin", "super_admin")
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert "expires_in" in tokens
        assert isinstance(tokens["access_token"], str)
        assert isinstance(tokens["refresh_token"], str)
        assert tokens["expires_in"] > 0

    def test_decode_token_valid(self):
        tokens = generate_tokens(1, "admin", "super_admin")
        payload = decode_token(tokens["access_token"])
        assert payload is not None
        assert payload["sub"] == "1"
        assert payload["username"] == "admin"
        assert payload["role"] == "super_admin"
        assert payload["type"] == "access"

    def test_decode_token_invalid(self):
        payload = decode_token("invalid.token.here")
        assert payload is None

    def test_decode_token_expired(self):
        from utils.security import JWT_SECRET_KEY

        expired_payload = {
            "sub": "1",
            "type": "access",
            "exp": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1),
        }
        expired_token = jwt.encode(expired_payload, JWT_SECRET_KEY, algorithm="HS256")
        payload = decode_token(expired_token)
        assert payload is None

    def test_validate_token_access(self):
        tokens = generate_tokens(1, "admin", "super_admin")
        payload = validate_token(tokens["access_token"], "access")
        assert payload is not None
        assert payload["type"] == "access"

    def test_validate_token_refresh(self):
        tokens = generate_tokens(1, "admin", "super_admin")
        payload = validate_token(tokens["refresh_token"], "refresh")
        assert payload is not None
        assert payload["type"] == "refresh"

    def test_validate_token_wrong_type(self):
        tokens = generate_tokens(1, "admin", "super_admin")
        payload = validate_token(tokens["access_token"], "refresh")
        assert payload is None

    def test_hash_password(self):
        password = "test_password_123"
        hashed = hash_password(password)
        assert hashed is not None
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_verify_password_correct(self):
        password = "test_password_123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        password = "test_password_123"
        hashed = hash_password(password)
        assert verify_password("wrong_password", hashed) is False

    def test_is_strong_password(self):
        assert is_strong_password("Abc123!@#") is True
        assert is_strong_password("weak") is False

    def test_sanitize_input_basic(self):
        input_str = '<script>alert("test")</script>'
        sanitized = sanitize_input(input_str)
        assert "<script>" not in sanitized
        assert "</script>" not in sanitized

    def test_validate_email_valid(self):
        assert validate_email("test@example.com") is True
        assert validate_email("user.name@domain.org") is True

    def test_validate_email_invalid(self):
        assert validate_email("invalid-email") is False
        assert validate_email("@nodomain.com") is False

    def test_validate_phone_valid(self):
        assert validate_phone("13800138000") is True
        assert validate_phone("15912345678") is True

    def test_validate_phone_invalid(self):
        assert validate_phone("12345") is False
        assert validate_phone("abc12345678") is False

    def test_validate_username_valid(self):
        assert validate_username("admin") is True
        assert validate_username("user_123") is True

    def test_validate_password_valid(self):
        assert validate_password("Abc123!@#") is True

    def test_validate_password_invalid(self):
        assert validate_password("weak") is False

    def test_validate_card_id_valid(self):
        assert validate_card_id("C12345") is True

    def test_validate_integer(self):
        assert validate_integer(10) is True
        assert validate_integer(10, 5, 15) is True

    def test_validate_integer_out_of_range(self):
        assert validate_integer(20, 5, 15) is False

    def test_validate_string_length(self):
        assert validate_string_length("test", 1, 10) is True

    def test_validate_string_length_too_short(self):
        assert validate_string_length("a", 5, 10) is False

    def test_validate_score_valid(self):
        assert validate_score(10) is True

    def test_validate_class_name(self):
        assert validate_class_name("一年级一班") is True

    def test_validate_class_name_empty(self):
        assert validate_class_name("") is False

    def test_validate_gender(self):
        assert validate_gender("男") is True
        assert validate_gender("女") is True

    def test_validate_status(self):
        assert validate_status("active") is True
        assert validate_status("inactive") is True

    def test_validate_datetime(self):
        assert validate_datetime("2024-01-01 12:00:00") is True
        assert validate_datetime("invalid-date") is False

    def test_validate_json(self):
        assert validate_json('{"key": "value"}') is True
        assert validate_json("invalid json") is False

    def test_sanitize_filename_basic(self):
        filename = "test/file/name.txt"
        sanitized = sanitize_filename(filename)
        assert "/" not in sanitized

    def test_is_safe_redirect_url_valid(self):
        assert is_safe_redirect_url("/dashboard") is True
