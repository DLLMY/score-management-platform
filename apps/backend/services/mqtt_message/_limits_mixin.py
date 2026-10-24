"""限额校验：上课时间判定 / 规则限额 / 积分上限。"""

from models import ScoreRecord, ScoreRule
from services.mqtt_message import _shared


class _LimitsMixin:
    def check_time_valid(self, box_id, hour, minute):
        from models import TimeRule

        time_rules = TimeRule.query.filter_by(is_active=True).all()
        if not time_rules:
            return True

        for rule in time_rules:
            if rule.day_of_week == -1 or rule.day_of_week == _shared.datetime.now().weekday():
                start_time = _shared.datetime.now().replace(
                    hour=rule.start_hour, minute=rule.start_minute, second=0
                )
                end_time = _shared.datetime.now().replace(
                    hour=rule.end_hour, minute=rule.end_minute, second=0
                )
                current_time = _shared.datetime.now().replace(hour=hour, minute=minute, second=0)

                if start_time <= current_time <= end_time:
                    return rule.allow_unlock

        return False

    def check_rule_limit(self, user_id, rule_id):
        from models import ScoreRecord, ScoreRule

        rule = _shared.get_by_id(ScoreRule, rule_id)
        if not rule:
            return {"allow": False, "message": "Rule not found"}

        # daily_limit 模型有 default=0 但 DB 列可空；None <= 0 会抛 TypeError。
        daily_limit = rule.daily_limit or 0
        if daily_limit <= 0:
            return {"allow": True, "message": "No limit"}

        today = _shared.datetime.now().date()
        records = ScoreRecord.query.filter(
            ScoreRecord.student_id == user_id,
            ScoreRecord.rule_id == rule_id,
            ScoreRecord.created_at >= _shared.datetime.combine(today, _shared.datetime.min.time()),
        ).all()

        total_score = sum(r.score_change for r in records)
        if total_score >= daily_limit:
            return {
                "allow": False,
                "message": (f"Daily limit reached ({total_score}/" f"{daily_limit})"),
            }

        min_interval = rule.min_interval or 0
        if min_interval > 0:
            last_record = (
                ScoreRecord.query.filter(
                    ScoreRecord.student_id == user_id,
                    ScoreRecord.rule_id == rule_id,
                )
                .order_by(ScoreRecord.created_at.desc())
                .first()
            )

            # R8 修复: 判空顺序（原先算 time_diff 再判 last_record → 首笔使用 AttributeError 且无回包）
            if last_record:
                time_diff = (_shared.datetime.now() - last_record.created_at).total_seconds()
                if time_diff < min_interval:
                    return {
                        "allow": False,
                        "message": (f"Too frequent, wait {min_interval}s"),
                    }

        return {"allow": True, "message": "Allowed"}

    def apply_score_limit(self, score):
        from models import SystemConfig

        config = SystemConfig.query.first()
        if config:
            return max(config.min_score, min(config.max_score, score))
        return max(0, min(100, score))
