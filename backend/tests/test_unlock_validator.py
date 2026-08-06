import uuid
from datetime import datetime, date, timedelta
from models import User, TimeRule, ScoreRankRule
try:
    from services.unlock_validator import UnlockValidator
except ImportError:
    pass

try:
    from services.unlock_validator import check_user_blacklist
except ImportError:
    pass

try:
    from services.unlock_validator import add_to_blacklist
except ImportError:
    pass

try:
    from services.unlock_validator import remove_from_blacklist
except ImportError:
    pass

try:
    from services.unlock_validator import set_daily_unlock_limit
except ImportError:
    pass


class TestUnlockValidator:

    def test_unlock_validator_score_ok(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True
            )
            session.add(user)
            session.commit()

            from services.unlock_validator import UnlockValidator
            valid, msg, data = UnlockValidator.validate_unlock(user.card_id)
            assert valid is True

    def test_unlock_validator_score_low(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=30,
                is_active=True
            )
            session.add(user)
            session.commit()

            valid, msg, data = UnlockValidator.validate_unlock(user.card_id)
            assert valid is False

    def test_unlock_validator_invalid_card(self, app):
        with app.app_context():
            valid, msg, data = UnlockValidator.validate_unlock('INVALID_CARD')
            assert valid is False

    def test_unlock_validator_inactive_user(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=False
            )
            session.add(user)
            session.commit()

            valid, msg, data = UnlockValidator.validate_unlock(user.card_id)
            assert valid is False
            assert msg == 'user_inactive'

    def test_unlock_validator_blacklisted_user(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True,
                is_blacklisted=True,
                blacklist_reason='测试',
                blacklist_until=datetime.now() + timedelta(days=1)
            )
            session.add(user)
            session.commit()

            valid, msg, data = UnlockValidator.validate_unlock(user.card_id)
            assert valid is False
            assert msg == 'user_blacklisted'

    def test_unlock_validator_permanently_blacklisted(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True,
                is_blacklisted=True,
                blacklist_reason='永久禁用',
                blacklist_until=None
            )
            session.add(user)
            session.commit()

            valid, msg, data = UnlockValidator.validate_unlock(user.card_id)
            assert valid is False
            assert msg == 'user_permanently_blacklisted'

    def test_unlock_validator_daily_limit_exceeded(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True,
                daily_unlock_limit=2,
                today_unlock_count=2,
                last_unlock_date=date.today()
            )
            session.add(user)
            session.commit()

            valid, msg, data = UnlockValidator.validate_unlock(user.card_id)
            assert valid is False
            assert msg == 'daily_limit_exceeded'

    def test_unlock_validator_weekly_limit_exceeded(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True
            )
            session.add(user)
            session.commit()

            user.weekly_unlock_count = 5
            user.week_start_date = date.today()

            valid, msg, data = UnlockValidator.validate_unlock(user.card_id)
            assert valid is False
            assert msg == 'weekly_limit_exceeded'

    def test_get_min_score(self):
        assert UnlockValidator.get_min_score() == 80

    def test_get_unlock_cost(self):
        assert UnlockValidator.get_unlock_cost() == 10

    def test_get_weekly_limit(self):
        assert UnlockValidator.get_weekly_limit() == 5

    def test_get_daily_limit(self):
        assert UnlockValidator.get_daily_limit() == 10

    def test_check_daily_limit(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True,
                daily_unlock_limit=5,
                today_unlock_count=3,
                last_unlock_date=date.today()
            )
            session.add(user)
            session.commit()

            result = UnlockValidator._check_daily_limit(user)
            assert result is True

    def test_check_daily_limit_exceeded(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True,
                daily_unlock_limit=5,
                today_unlock_count=5,
                last_unlock_date=date.today()
            )
            session.add(user)
            session.commit()

            result = UnlockValidator._check_daily_limit(user)
            assert result is False

    def test_check_time_window_no_rules(self, app):
        with app.app_context():
            result = UnlockValidator._check_time_window()
            assert result is True

    def test_check_time_window_with_rules(self, app, session):
        with app.app_context():
            time_rule = TimeRule(
                name='测试时间规则',
                day_of_week=-1,
                start_hour=0,
                start_minute=0,
                end_hour=23,
                end_minute=59,
                is_active=True
            )
            session.add(time_rule)
            session.commit()

            result = UnlockValidator._check_time_window()
            assert result is True

    def test_get_user_rank(self, app, session):
        with app.app_context():
            rank_rule = ScoreRankRule(
                name='优秀',
                min_score=80,
                max_score=99,
                is_active=True
            )
            session.add(rank_rule)
            session.commit()

            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=85,
                is_active=True
            )
            session.add(user)
            session.commit()

            rank = UnlockValidator.get_user_rank(user)
            assert rank is not None
            assert rank.name == '优秀'

    def test_get_unlock_status(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True,
                daily_unlock_limit=10,
                today_unlock_count=3,
                last_unlock_date=date.today()
            )
            session.add(user)
            session.commit()

            status = UnlockValidator.get_unlock_status(user.card_id)
            assert status['exists'] is True
            assert status['current_score'] == 100

    def test_get_unlock_status_not_found(self, app):
        with app.app_context():
            status = UnlockValidator.get_unlock_status('INVALID_CARD')
            assert status['exists'] is False


class TestUnlockValidatorFunctions:

    def test_check_user_blacklist_not_found(self, app):
        with app.app_context():
            from services.unlock_validator import check_user_blacklist
            is_blacklisted, reason = check_user_blacklist('INVALID_CARD')
            assert is_blacklisted is False
            assert reason == 'user_not_found'

    def test_check_user_blacklist_inactive(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=False
            )
            session.add(user)
            session.commit()

            is_blacklisted, reason = check_user_blacklist(user.card_id)
            assert is_blacklisted is False
            assert reason == 'user_inactive'

    def test_check_user_blacklist_blacklisted(self, app, session):
        with app.app_context():
            user = User(
                name='测试用户',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=100,
                is_active=True,
                is_blacklisted=True,
                blacklist_reason='测试原因',
                blacklist_until=datetime.now() + timedelta(days=1)
            )
            session.add(user)
            session.commit()

            is_blacklisted, reason = check_user_blacklist(user.card_id)
            assert is_blacklisted is True
            assert reason == '测试原因'

    def test_add_to_blacklist_not_found(self, app):
        with app.app_context():
            from services.unlock_validator import add_to_blacklist
            success, msg = add_to_blacklist('INVALID_CARD', '测试')
            assert success is False
            assert msg == 'user_not_found'

    def test_remove_from_blacklist_not_found(self, app):
        with app.app_context():
            from services.unlock_validator import remove_from_blacklist
            success, msg = remove_from_blacklist('INVALID_CARD')
            assert success is False
            assert msg == 'user_not_found'

    def test_set_daily_unlock_limit_invalid(self, app):
        with app.app_context():
            from services.unlock_validator import set_daily_unlock_limit
            success, msg = set_daily_unlock_limit('INVALID_CARD', -1)
            assert success is False
            assert msg == 'limit_out_of_range'

    def test_set_daily_unlock_limit_not_found(self, app):
        with app.app_context():
            success, msg = set_daily_unlock_limit('INVALID_CARD', 5)
            assert success is False
            assert msg == 'user_not_found'
