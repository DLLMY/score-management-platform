try:
    from utils.validation import error_response
except ImportError:
    pass

try:
    from utils.validation import success_response
except ImportError:
    pass

try:
    from utils.validation import validate_card_id
except ImportError:
    pass

try:
    from utils.validation import validate_name
except ImportError:
    pass

try:
    from utils.validation import validate_phone
except ImportError:
    pass

try:
    from utils.validation import validate_email
except ImportError:
    pass

try:
    from utils.validation import validate_score
except ImportError:
    pass

try:
    from utils.security import validate_class_name
except ImportError:
    pass



class TestValidationUtils:

    def test_error_response(self, app):
        with app.app_context():
            from utils.validation import error_response
            resp = error_response('测试错误')
            assert isinstance(resp, tuple)
            assert len(resp) == 2
            assert resp[0]['success'] is False
            assert resp[0]['message'] == '测试错误'
            assert resp[1] == 400

            resp = error_response('带错误列表', errors=['错误1', '错误2'], code=404)
            assert resp[0]['errors'] == ['错误1', '错误2']
            assert resp[1] == 404

    def test_success_response(self, app):
        with app.app_context():
            from utils.validation import success_response
            resp = success_response()
            assert hasattr(resp, 'get_json')
            data = resp.get_json()
            assert data['success'] is True
            assert data['message'] == '操作成功'

            resp = success_response(data={'key': 'value'})
            data = resp.get_json()
            assert 'data' in data

    def test_validate_card_id(self, app):
        with app.app_context():
            from utils.validation import validate_card_id
            result, msg = validate_card_id('123456789012')
            assert result is True
            result, msg = validate_card_id('TEST123')
            assert result is False
            result, msg = validate_card_id('')
            assert result is False

    def test_validate_name(self, app):
        with app.app_context():
            from utils.validation import validate_name
            result, msg = validate_name('张三')
            assert result is True
            result, msg = validate_name('张')
            assert result is False
            result, msg = validate_name('张三123')
            assert result is False
            result, msg = validate_name('')
            assert result is False

    def test_validate_phone(self, app):
        with app.app_context():
            from utils.validation import validate_phone
            result, msg = validate_phone('13800138000')
            assert result is True
            result, msg = validate_phone('123456')
            assert result is False
            result, msg = validate_phone('')
            assert result is True

    def test_validate_email(self, app):
        with app.app_context():
            from utils.validation import validate_email
            result, msg = validate_email('test@example.com')
            assert result is True
            result, msg = validate_email('invalid')
            assert result is False

    def test_validate_score(self, app):
        with app.app_context():
            from utils.validation import validate_score
            result, msg = validate_score(100)
            assert result is True
            result, msg = validate_score(-1)
            assert result is True
            result, msg = validate_score(-2000)
            assert result is False
            result, msg = validate_score('abc')
            assert result is False

    def test_validate_class_name(self, app):
        with app.app_context():
            from utils.security import validate_class_name
            assert validate_class_name('一年级1班') is True
            assert validate_class_name('') is False
