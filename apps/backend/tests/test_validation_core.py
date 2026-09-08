from utils.validation import (
    validate_phone,
    validate_email,
    validate_score,
    validate_id,
    validate_username,
    validate_password,
    validate_mac_address,
    validate_ip_address,
    validate_positive_int,
    validate_enum,
)
from utils.validation import validate_chinese_name
from utils.validation import validate_student_id
from utils.validation import validate_name


class TestValidationCore:

    def test_validate_phone_valid(self):
        result, msg = validate_phone("13800138000")
        assert result is True

    def test_validate_phone_invalid(self):
        result, msg = validate_phone("123")
        assert result is False

    def test_validate_email_valid(self):
        result, msg = validate_email("test@example.com")
        assert result is True

    def test_validate_email_invalid(self):
        result, msg = validate_email("invalid")
        assert result is False

    def test_validate_score_valid(self):
        result, msg = validate_score(10)
        assert result is True

    def test_validate_id_valid(self):
        result, msg = validate_id(1)
        assert result is True

    def test_validate_id_invalid(self):
        result, msg = validate_id("invalid")
        assert result is False

    def test_validate_username_valid(self):
        result, msg = validate_username("admin")
        assert result is True

    def test_validate_password_valid(self):
        result, msg = validate_password("Abc123!@#")
        assert result is True

    def test_validate_password_invalid(self):
        result, msg = validate_password("weak")
        assert result is False

    def test_validate_mac_address_valid(self):
        result, msg = validate_mac_address("00:11:22:33:44:55")
        assert result is True

    def test_validate_mac_address_invalid(self):
        result, msg = validate_mac_address("invalid")
        assert result is False

    def test_validate_ip_address_valid(self):
        result, msg = validate_ip_address("192.168.1.1")
        assert result is True

    def test_validate_ip_address_invalid(self):
        result, msg = validate_ip_address("invalid")
        assert result is False

    def test_validate_positive_int_valid(self):
        result, msg = validate_positive_int(10)
        assert result is True

    def test_validate_positive_int_invalid(self):
        result, msg = validate_positive_int(-5)
        assert result is False

    def test_validate_enum_valid(self):
        result, msg = validate_enum("active", ["active", "inactive"])
        assert result is True

    def test_validate_enum_invalid(self):
        result, msg = validate_enum("invalid", ["active", "inactive"])
        assert result is False

    def test_validate_student_id_valid(self):
        result, msg = validate_student_id("S12345")
        assert result is True

    def test_validate_chinese_name_valid(self):
        result, msg = validate_chinese_name("张三")
        assert result is True

    def test_validate_chinese_name_invalid(self):
        result, msg = validate_chinese_name("abc")
        assert result is False

    def test_validate_name_valid(self):
        result, msg = validate_name("张三")
        assert result is True
