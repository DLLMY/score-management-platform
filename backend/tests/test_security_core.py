from utils.security import hash_password, verify_password, is_strong_password, validate_email, validate_phone, validate_card_id, validate_username, validate_password, sanitize_input, sanitize_filename, is_safe_redirect_url
from utils.security import InputValidator
from utils.security import validate_integer
from utils.security import validate_gender
from utils.security import validate_class_name
from utils.security import generate_subaccount_token
from utils.security import generate_student_token


class TestSecurityCore:

    def test_hash_password(self):
        password = 'test123'
        hashed = hash_password(password)
        assert hashed is not None
        assert len(hashed) > 20

    def test_verify_password_correct(self):
        password = 'test123'
        hashed = hash_password(password)
        result = verify_password(password, hashed)
        assert result is True

    def test_verify_password_incorrect(self):
        password = 'test123'
        hashed = hash_password(password)
        result = verify_password('wrong', hashed)
        assert result is False

    def test_is_strong_password(self):
        result = is_strong_password('Test@1234')
        assert isinstance(result, bool)

    def test_validate_email(self):
        result = validate_email('test@example.com')
        assert result is True

    def test_validate_email_invalid(self):
        result = validate_email('invalid')
        assert result is False

    def test_validate_phone(self):
        result = validate_phone('13800138000')
        assert result is True

    def test_validate_card_id(self):
        result = validate_card_id('C001')
        assert isinstance(result, bool)

    def test_validate_username(self):
        result = validate_username('testuser')
        assert isinstance(result, bool)

    def test_validate_password(self):
        result = validate_password('Test@123')
        assert isinstance(result, bool)

    def test_sanitize_input(self):
        result = sanitize_input('<script>alert(1)</script>')
        assert result is not None

    def test_sanitize_filename(self):
        result = sanitize_filename('test/file.txt')
        assert '/' not in result

    def test_is_safe_redirect_url(self):
        result = is_safe_redirect_url('http://example.com')
        assert isinstance(result, bool)

    def test_generate_subaccount_token(self):
        result = generate_subaccount_token(1, 'test_sub', 'teacher', 1)
        assert 'token' in result
        assert 'expires_in' in result
        assert isinstance(result['token'], str)
        assert len(result['token']) > 10

    def test_generate_student_token(self):
        result = generate_student_token(1, 'test_student', 'C001')
        assert 'token' in result
        assert 'expires_in' in result
        assert isinstance(result['token'], str)
        assert len(result['token']) > 10

    def test_validate_integer(self):
        assert validate_integer(100) is True
        assert validate_integer('100') is True
        assert validate_integer('abc') is False

    def test_validate_gender(self):
        assert validate_gender('男') is True
        assert validate_gender('女') is True
        assert validate_gender('其他') is False

    def test_validate_class_name(self):
        assert validate_class_name('一年级1班') is True
        assert validate_class_name('') is False

    def test_input_validator_required(self):
        validator = InputValidator()
        assert validator.validate('name', '', ['required']) is False
        assert 'name 必填' in validator.get_errors()

    def test_input_validator_email(self):
        validator = InputValidator()
        assert validator.validate('email', 'invalid', ['email']) is False

    def test_input_validator_integer(self):
        validator = InputValidator()
        assert validator.validate('age', 'abc', ['integer']) is False

    def test_input_validator_min_max(self):
        validator = InputValidator()
        assert validator.validate('score', 50, [{'min': 0}, {'max': 100}]) is True
        assert validator.validate('score', -1, [{'min': 0}]) is False

    def test_input_validator_length(self):
        validator = InputValidator()
        assert validator.validate('name', 'ab', [{'minLength': 2}]) is True
        assert validator.validate('name', 'a', [{'minLength': 2}]) is False
