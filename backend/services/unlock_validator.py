from models import db, User, TimeRule, ScoreRankRule
from datetime import datetime, date, time
from typing import Dict, Tuple, Optional


class UnlockValidator:
    MIN_SCORE = 80
    UNLOCK_COST = 10
    WEEKLY_LIMIT = 5
    DAILY_LIMIT = 10

    @staticmethod
    def get_user_rank(user: User) -> Optional[ScoreRankRule]:
        """根据用户分数获取对应的排名规则"""
        if not user.current_score:
            return None
        rules = ScoreRankRule.query.filter_by(is_active=True).order_by(ScoreRankRule.min_score.desc()).all()
        for rule in rules:
            if user.current_score >= rule.min_score:
                if rule.max_score is None or user.current_score <= rule.max_score:
                    return rule
        return None

    @staticmethod
    def validate_unlock(card_id: str) -> Tuple[bool, str, Optional[Dict]]:
        """
        验证开锁资格

        Returns:
            Tuple[是否允许, 原因, 用户信息]
        """
        user = User.query.filter_by(card_id=card_id).first()

        if not user:
            return False, "card_not_found", None

        if not user.is_active:
            return False, "user_inactive", {"current_score": user.current_score}

        if user.is_blacklisted:
            if user.blacklist_until and user.blacklist_until > datetime.now():
                return (
                    False,
                    "user_blacklisted",
                    {
                        "reason": user.blacklist_reason,
                        "until": user.blacklist_until.isoformat(),
                        "current_score": user.current_score,
                    },
                )
            elif user.blacklist_until is None:
                return (
                    False,
                    "user_permanently_blacklisted",
                    {"reason": user.blacklist_reason, "current_score": user.current_score},
                )

        rank = UnlockValidator.get_user_rank(user)
        min_score = rank.unlock_min_score if rank and rank.unlock_min_score is not None else UnlockValidator.MIN_SCORE

        if user.current_score < min_score:
            return False, "score_low", {"current_score": user.current_score, "min_required": min_score}

        weekly_limit = (
            rank.weekly_unlock_limit if rank and rank.weekly_unlock_limit is not None else UnlockValidator.WEEKLY_LIMIT
        )  # noqa: E501
        if not UnlockValidator._check_weekly_limit(user, weekly_limit):
            return (
                False,
                "weekly_limit_exceeded",
                {
                    "current_score": user.current_score,
                    "limit": weekly_limit,
                    "used": user.weekly_unlock_count if hasattr(user, "weekly_unlock_count") else 0,
                },
            )

        if not UnlockValidator._check_daily_limit(user):
            return (
                False,
                "daily_limit_exceeded",
                {
                    "current_score": user.current_score,
                    "limit": user.daily_unlock_limit,
                    "used": user.today_unlock_count,
                },
            )

        if not UnlockValidator._check_time_window():
            return False, "not_in_time_window", {"current_score": user.current_score}

        return (
            True,
            "ok",
            {
                "user_id": user.id,
                "name": user.name,
                "current_score": user.current_score,
                "class_name": user.class_name,
                "rank_name": rank.name if rank else None,
            },
        )

    @staticmethod
    def _check_daily_limit(user: User) -> bool:
        today = date.today()

        if user.last_unlock_date != today:
            user.today_unlock_count = 0
            user.last_unlock_date = today

        return user.today_unlock_count < user.daily_unlock_limit

    @staticmethod
    def _check_weekly_limit(user: User, weekly_limit: int) -> bool:
        """检查每周开门次数限制"""
        if not hasattr(user, "weekly_unlock_count"):
            user.weekly_unlock_count = 0
        if not hasattr(user, "week_start_date"):
            user.week_start_date = None

        today_iso = date.today()
        current_week_start = today_iso.isoformat()[:4] + "-W" + str(today_iso.isocalendar()[1]).zfill(2)
        if user.week_start_date:
            user_week_start = (
                user.week_start_date.isoformat()[:4] + "-W" + str(user.week_start_date.isocalendar()[1]).zfill(2)
            )
        else:
            user_week_start = None

        if user_week_start != current_week_start:
            user.weekly_unlock_count = 0
            user.week_start_date = date.today()

        return user.weekly_unlock_count < weekly_limit

    @staticmethod
    def _check_time_window() -> bool:
        now = datetime.now()
        current_time = now.time()

        time_rules = TimeRule.query.filter_by(is_active=True).all()

        if not time_rules:
            return True

        for rule in time_rules:
            start = time(rule.start_hour, rule.start_minute)
            end = time(rule.end_hour, rule.end_minute)

            # day_of_week == -1 表示每天生效
            if rule.day_of_week != -1 and now.isoweekday() != rule.day_of_week:
                continue

            if start <= current_time <= end:
                return True

        return True

    @staticmethod
    def record_unlock(user: User) -> None:
        today = date.today()

        if user.last_unlock_date != today:
            user.today_unlock_count = 0
            user.last_unlock_date = today

        today_iso = date.today()
        current_week_start = today_iso.isoformat()[:4] + "-W" + str(today_iso.isocalendar()[1]).zfill(2)
        if user.week_start_date:
            user_week_start = (
                user.week_start_date.isoformat()[:4] + "-W" + str(user.week_start_date.isocalendar()[1]).zfill(2)
            )
        else:
            user_week_start = None

        if user_week_start != current_week_start:
            user.weekly_unlock_count = 0
            user.week_start_date = today

        user.today_unlock_count += 1
        user.weekly_unlock_count = getattr(user, "weekly_unlock_count", 0) + 1
        user.current_score = max(0, user.current_score - UnlockValidator.UNLOCK_COST)
        user.updated_at = datetime.now()

        db.session.commit()

    @staticmethod
    def get_unlock_status(card_id: str) -> Dict:
        user = User.query.filter_by(card_id=card_id).first()

        if not user:
            return {"exists": False}

        today = date.today()
        if user.last_unlock_date != today:
            unlock_count = 0
        else:
            unlock_count = user.today_unlock_count

        return {
            "exists": True,
            "user_id": user.id,
            "name": user.name,
            "current_score": user.current_score,
            "is_blacklisted": user.is_blacklisted,
            "daily_unlock_limit": user.daily_unlock_limit,
            "today_unlock_count": unlock_count,
            "remaining": max(0, user.daily_unlock_limit - unlock_count),
            "is_active": user.is_active,
        }


    @staticmethod
    def get_min_score() -> int:
        """获取最低可开锁分数（兼容测试取值接口）。"""
        return UnlockValidator.MIN_SCORE

    @staticmethod
    def get_unlock_cost() -> int:
        """获取每次开锁消耗积分（兼容测试取值接口）。"""
        return UnlockValidator.UNLOCK_COST

    @staticmethod
    def get_weekly_limit() -> int:
        """获取每周开锁上限（兼容测试取值接口）。"""
        return UnlockValidator.WEEKLY_LIMIT

    @staticmethod
    def get_daily_limit() -> int:
        """获取每日开锁上限（兼容测试取值接口）。"""
        return UnlockValidator.DAILY_LIMIT


def check_user_blacklist(card_id: str) -> Tuple[bool, str]:
    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    if not user.is_active:
        return False, "user_inactive"

    if user.is_blacklisted:
        if user.blacklist_until and user.blacklist_until > datetime.now():
            return True, user.blacklist_reason or "暂时禁用"
        elif user.blacklist_until is None:
            return True, user.blacklist_reason or "永久禁用"

    return False, ""


def add_to_blacklist(card_id: str, reason: str, until: datetime = None) -> Tuple[bool, str]:
    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    user.is_blacklisted = True
    user.blacklist_reason = reason
    user.blacklist_until = until
    user.updated_at = datetime.now()

    db.session.commit()

    return True, "用户已加入黑名单"


def remove_from_blacklist(card_id: str) -> Tuple[bool, str]:
    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    user.is_blacklisted = False
    user.blacklist_reason = None
    user.blacklist_until = None
    user.updated_at = datetime.now()

    db.session.commit()

    return True, "用户已从黑名单移除"


def set_daily_unlock_limit(card_id: str, limit: int) -> Tuple[bool, str]:
    if limit < 0 or limit > 100:
        return False, "limit_out_of_range"

    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    user.daily_unlock_limit = limit
    user.updated_at = datetime.now()

    db.session.commit()

    return True, f"每日开锁限制已设置为 {limit}"
