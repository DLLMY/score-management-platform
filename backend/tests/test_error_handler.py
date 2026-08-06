from utils.error_handler import APIError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, DatabaseError, BusinessError, RateLimitError


class TestErrorClasses:

    def test_api_error(self):
        error = APIError('Test error', status_code=400, error_code='TEST_ERROR', details={'field': 'value'})
        assert error.message == 'Test error'
        assert error.status_code == 400
        assert error.error_code == 'TEST_ERROR'
        assert error.details == {'field': 'value'}

    def test_not_found_error(self):
        error = NotFoundError('Resource not found')
        assert error.status_code == 404
        assert error.error_code == 'NOT_FOUND'

    def test_unauthorized_error(self):
        error = UnauthorizedError('Unauthorized')
        assert error.status_code == 401
        assert error.error_code == 'UNAUTHORIZED'

    def test_forbidden_error(self):
        error = ForbiddenError('Forbidden')
        assert error.status_code == 403
        assert error.error_code == 'FORBIDDEN'

    def test_validation_error(self):
        error = ValidationError('Validation failed', details={'errors': ['field required']})
        assert error.status_code == 400
        assert error.error_code == 'VALIDATION_ERROR'
        assert error.details == {'errors': ['field required']}

    def test_database_error(self):
        error = DatabaseError('DB error', details={'query': 'SELECT *'})
        assert error.status_code == 500
        assert error.error_code == 'DATABASE_ERROR'

    def test_business_error(self):
        error = BusinessError('Business error', details={'reason': 'logic'})
        assert error.status_code == 400
        assert error.error_code == 'BUSINESS_ERROR'

    def test_rate_limit_error(self):
        error = RateLimitError('Too many requests')
        assert error.status_code == 429
        assert error.error_code == 'RATE_LIMITED'


class TestErrorHandlers:
    pass
