from datetime import date, datetime, time

from sqlalchemy import func

from models import ScoreRankRule, ScoreRecord, TimeRule, User, db
from utils.unlock_reasons import UnlockReason

# 差异 #8：每日开锁次数默认上限（用户级 daily_unlock_limit 为空时使用）。
# 历史实现硬编码为 5（常量 DAILY_LIMIT=10 从未生效）；此处把它显式命名为常量，
# **取值保持 5 不变**——零行为漂移，仅消除「常量 10 vs 实际 5」的认知陷阱。
# 如需调整全校默认值，只改这一处（get_unlock_status / _check_daily_limit 共同引用）。
DEFAULT_DAILY_UNLOCK_LIMIT = 5


class UnlockValidator:
    MIN_SCORE = 80
    UNLOCK_COST = 10
    WEEKLY_LIMIT = 5
    # 保留历史常量名以免破坏既有引用；其值不再被 _check_daily_limit 使用
    # （见 DEFAULT_DAILY_UNLOCK_LIMIT 说明）。测试接口 get_daily_limit 返回值也随之一致化。
    DAILY_LIMIT = DEFAULT_DAILY_UNLOCK_LIMIT

    @staticmethod
    def get_user_rank(user: User) -> ScoreRankRule | None:
        """根据用户分数获取对应的排名规则"""
        if not user.current_score:
            return None
        rules = (
            ScoreRankRule.query.filter_by(is_active=True)
            .order_by(ScoreRankRule.min_score.desc())
            .all()
        )
        for rule in rules:
            if user.current_score >= rule.min_score and (
                rule.max_score is None or user.current_score <= rule.max_score
            ):
                return rule
        return None

    @staticmethod
    def validate_unlock(
        card_id: str, skip_time_window: bool = False
    ) -> tuple[bool, str, dict | None]:
        """
        验证开锁资格

        Args:
            card_id: 学生卡号
            skip_time_window: 跳过时段检查（班主任放行/已有全局时段校验的路径传 True，
                              避免双重时段拦截违背"一键放行"语义；默认 False 保持全量校验）

        Returns:
            Tuple[是否允许, 原因, 用户信息]
        """
        user = User.query.filter_by(card_id=card_id).first()

        if not user:
            return False, UnlockReason.CARD_NOT_FOUND, None

        if not user.is_active:
            return False, UnlockReason.USER_INACTIVE, {"current_score": user.current_score}

        if user.is_blacklisted:
            if user.blacklist_until and user.blacklist_until > datetime.now():
                return (
                    False,
                    UnlockReason.USER_BLACKLISTED,
                    {
                        "reason": user.blacklist_reason,
                        "until": user.blacklist_until.isoformat(),
                        "current_score": user.current_score,
                    },
                )
            if user.blacklist_until is None:
                return (
                    False,
                    UnlockReason.USER_PERMANENTLY_BLACKLISTED,
                    {"reason": user.blacklist_reason, "current_score": user.current_score},
                )

        rank = UnlockValidator.get_user_rank(user)
        min_score = (
            rank.unlock_min_score
            if rank and rank.unlock_min_score is not None
            else UnlockValidator.MIN_SCORE
        )

        if user.current_score < min_score:
            return (
                False,
                UnlockReason.SCORE_LOW,
                {"current_score": user.current_score, "min_required": min_score},
            )

        weekly_limit = (
            rank.weekly_unlock_limit
            if rank and rank.weekly_unlock_limit is not None
            else UnlockValidator.WEEKLY_LIMIT
        )
        if not UnlockValidator._check_weekly_limit(user, weekly_limit):
            return (
                False,
                UnlockReason.WEEKLY_LIMIT_EXCEEDED,
                {
                    "current_score": user.current_score,
                    "limit": weekly_limit,
                    "used": user.weekly_unlock_count if hasattr(user, "weekly_unlock_count") else 0,
                },
            )

        if not UnlockValidator._check_daily_limit(user):
            return (
                False,
                UnlockReason.DAILY_LIMIT_EXCEEDED,
                {
                    "current_score": user.current_score,
                    "limit": UnlockValidator._resolve_daily_limit(user),
                    "used": user.today_unlock_count,
                },
            )

        if not UnlockValidator._check_time_window() and not skip_time_window:
            return False, UnlockReason.NOT_IN_TIME_WINDOW, {"current_score": user.current_score}

        return (
            True,
            UnlockReason.OK,
            {
                "user_id": user.id,
                "name": user.name,
                "current_score": user.current_score,
                "class_name": user.class_name,
                "rank_name": rank.name if rank else None,
            },
        )

    @staticmethod
    def _resolve_daily_limit(user) -> int:
        """解析用户当日开锁上限（差异 #8：三级回退，单一来源）。

        1) user.daily_unlock_limit（管理员按用户设置）
        2) rank.weekly_unlock_limit 同源规则未定义日限额 → 不参与
        3) DEFAULT_DAILY_UNLOCK_LIMIT（全校默认，历史硬编码 5 显式化）

        历史实现的 `limit = user.daily_unlock_limit if not None else 5` 与
        常量 DAILY_LIMIT=10 并存且不一致，本函数收敛为唯一口径，
        并保证**默认值仍为 5**（零行为漂移）。
        """
        limit = getattr(user, "daily_unlock_limit", None)
        if limit is None:
            return DEFAULT_DAILY_UNLOCK_LIMIT
        try:
            return int(limit)
        except (TypeError, ValueError):
            return DEFAULT_DAILY_UNLOCK_LIMIT

    @staticmethod
    def _check_daily_limit(user: User, daily_limit: int = None) -> bool:
        today = date.today()

        if user.last_unlock_date != today:
            user.today_unlock_count = 0
            user.last_unlock_date = today

        # 差异 #8：允许调用方显式传入限额（如排名规则下发），否则走三级回退。
        # R2 复核修复: daily_unlock_limit/today_unlock_count 历史数据可能为 NULL → None 比较 TypeError
        limit = daily_limit if daily_limit is not None else UnlockValidator._resolve_daily_limit(user)
        used = user.today_unlock_count or 0
        return used < limit

    @staticmethod
    def _check_weekly_limit(user: User, weekly_limit: int) -> bool:
        """检查每周开门次数限制（weekly_unlock_count/week_start_date 已落库，R2）"""
        if not hasattr(user, "weekly_unlock_count"):
            user.weekly_unlock_count = 0
        if not hasattr(user, "week_start_date"):
            user.week_start_date = None

        today_iso = date.today()
        current_week_start = (
            today_iso.isoformat()[:4] + "-W" + str(today_iso.isocalendar()[1]).zfill(2)
        )
        if user.week_start_date:
            user_week_start = (
                user.week_start_date.isoformat()[:4]
                + "-W"
                + str(user.week_start_date.isocalendar()[1]).zfill(2)
            )
        else:
            user_week_start = None

        if user_week_start != current_week_start:
            user.weekly_unlock_count = 0
            user.week_start_date = date.today()

        return (user.weekly_unlock_count or 0) < weekly_limit

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

        # R2 修复: 配置了时段规则但当前时刻不匹配任何规则 → 拒绝（原兜底 return True 恒放行，规则形同虚设）
        return False

    @staticmethod
    def record_unlock(user: User) -> None:
        """开锁记账：扣分 + 日/周计数 + 写积分流水（统一写端，描述词与统计 like('%开锁%') 一致，R2）"""
        # ── R18 并发安全：原子增量替代 Python 读-改-写 ──
        # 原实现把 4 个字段（分数/日计数/周计数/时间戳）在 Python 内算完再 flush，
        # 并发开箱（MQTT 重连/重复上报）会互相覆盖 → 漏扣分 + 计数丢失；
        # 计数丢失更会绕过每日/每周开锁上限（业务规则可被并发绕过）。
        # 现改为单条 UPDATE 原子表达式（与 user_service.bulk_score_update 同范式）：
        #   - current_score 用 func.max(0, ...) 在 SQL 内保住「不为负」下限语义；
        #   - 计数自增同样在 SQL 内完成，杜绝 lost update。
        # 日期滚动重置（日/周清零）仍按原语义在 Python 侧判断后写入。
        today = date.today()
        current_week_start = (
            today.isoformat()[:4] + "-W" + str(today.isocalendar()[1]).zfill(2)
        )

        # 1) 跨日/跨周：需要重置计数时，先原子清零对应计数（条件更新，避免覆盖并发增量）
        if user.last_unlock_date != today:
            db.session.query(User).filter(User.id == user.id).update(
                {User.today_unlock_count: 0, User.last_unlock_date: today},
                synchronize_session=False,
            )
        if user.week_start_date is None or (
            user.week_start_date.isoformat()[:4]
            + "-W"
            + str(user.week_start_date.isocalendar()[1]).zfill(2)
        ) != current_week_start:
            db.session.query(User).filter(User.id == user.id).update(
                {User.weekly_unlock_count: 0, User.week_start_date: today},
                synchronize_session=False,
            )

        # 2) 原子自增：分数扣减保底 0，计数各 +1
        db.session.query(User).filter(User.id == user.id).update(
            {
                User.current_score: func.max(
                    0, func.coalesce(User.current_score, 0) - UnlockValidator.UNLOCK_COST
                ),
                User.today_unlock_count: func.coalesce(User.today_unlock_count, 0) + 1,
                User.weekly_unlock_count: func.coalesce(User.weekly_unlock_count, 0) + 1,
                User.updated_at: datetime.now(),
            },
            synchronize_session=False,
        )
        # 同步内存态，避免调用方（同一 session 内）继续读到旧值
        db.session.refresh(user)

        # 积分流水：描述词统一"开锁扣分"（analysis/composite 统计均按 like('%开锁%') 匹配）
        record = ScoreRecord(
            student_id=user.id,
            score_change=-UnlockValidator.UNLOCK_COST,
            description="开锁扣分",
            operator="MQTT System",
        )
        db.session.add(record)

        db.session.commit()

    @staticmethod
    def get_unlock_status(card_id: str) -> dict:
        user = User.query.filter_by(card_id=card_id).first()

        if not user:
            return {"exists": False}

        today = date.today()
        unlock_count = 0 if user.last_unlock_date != today else (user.today_unlock_count or 0)

        # 差异 #8：极限值统一走 _resolve_daily_limit，避免 user.daily_unlock_limit 为 NULL 时
        # 直接参与算术（历史实现会 TypeError）或与实际校验口径不一致。
        limit = UnlockValidator._resolve_daily_limit(user)

        return {
            "exists": True,
            "user_id": user.id,
            "name": user.name,
            "current_score": user.current_score,
            "is_blacklisted": user.is_blacklisted,
            "daily_unlock_limit": limit,
            "today_unlock_count": unlock_count,
            "remaining": max(0, limit - unlock_count),
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


def check_user_blacklist(card_id: str) -> tuple[bool, str]:
    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    if not user.is_active:
        return False, "user_inactive"

    if user.is_blacklisted:
        if user.blacklist_until and user.blacklist_until > datetime.now():
            return True, user.blacklist_reason or "暂时禁用"
        if user.blacklist_until is None:
            return True, user.blacklist_reason or "永久禁用"

    return False, ""


def add_to_blacklist(card_id: str, reason: str, until: datetime = None) -> tuple[bool, str]:
    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    user.is_blacklisted = True
    user.blacklist_reason = reason
    user.blacklist_until = until
    user.updated_at = datetime.now()

    db.session.commit()

    return True, "用户已加入黑名单"


def remove_from_blacklist(card_id: str) -> tuple[bool, str]:
    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    user.is_blacklisted = False
    user.blacklist_reason = None
    user.blacklist_until = None
    user.updated_at = datetime.now()

    db.session.commit()

    return True, "用户已从黑名单移除"


def set_daily_unlock_limit(card_id: str, limit: int) -> tuple[bool, str]:
    if limit < 0 or limit > 100:
        return False, "limit_out_of_range"

    user = User.query.filter_by(card_id=card_id).first()

    if not user:
        return False, "user_not_found"

    user.daily_unlock_limit = limit
    user.updated_at = datetime.now()

    db.session.commit()

    return True, f"每日开锁限制已设置为 {limit}"
