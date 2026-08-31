try:
    from utils.validators import Validator, ValidationError
except ImportError:
    pass

try:
    from utils.validators import SchemaValidator
except ImportError:
    pass


class TestValidators:

    def test_required_validator(self, app):
        with app.app_context():
            from utils.validators import Validator, ValidationError

            try:
                Validator.required("", "name")
                assert False
            except ValidationError:
                assert True

            Validator.required("test", "name")

    def test_min_length_validator(self, app):
        with app.app_context():
            try:
                Validator.min_length("ab", 3, "name")
                assert False
            except ValidationError:
                assert True

            Validator.min_length("abc", 3, "name")

    def test_max_length_validator(self, app):
        with app.app_context():
            try:
                Validator.max_length("abcde", 3, "name")
                assert False
            except ValidationError:
                assert True

            Validator.max_length("abc", 3, "name")

    def test_range_validator(self, app):
        with app.app_context():
            try:
                Validator.range(10, 1, 5, "score")
                assert False
            except ValidationError:
                assert True

            Validator.range(3, 1, 5, "score")

    def test_one_of_validator(self, app):
        with app.app_context():
            try:
                Validator.one_of("invalid", ["add", "deduct"], "action")
                assert False
            except ValidationError:
                assert True

            Validator.one_of("add", ["add", "deduct"], "action")

    def test_pattern_validator(self, app):
        with app.app_context():
            try:
                Validator.pattern("abc123", "^[a-z]+$", "username")
                assert False
            except ValidationError:
                assert True

            Validator.pattern("abc", "^[a-z]+$", "username")

    def test_schema_validator(self, app):
        with app.app_context():
            from utils.validators import SchemaValidator

            schema = {
                "name": {"required": True, "min_length": 2, "max_length": 50},
                "age": {"type": "integer", "min": 1, "max": 120},
            }
            validator = SchemaValidator(schema)

            valid, errors = validator.validate({"name": "张三", "age": 18})
            assert valid is True

            valid, errors = validator.validate({"name": "", "age": 200})
            assert valid is False
