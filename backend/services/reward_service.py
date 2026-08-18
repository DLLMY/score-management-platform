from datetime import date
from sqlalchemy import func
from models import ScoreRecord, User, get_by_id, db
from utils.db_session import db_session_scope


class PhoneAccessHandler:
    """手机拿取行为处理"""

    def __init__(self):
        self.access_cost = 30
        self.min_score_required = 60
        self.min_deduction_ratio = 0.05
        self.max_deduction_ratio = 0.15

    def handle_phone_access(self, user_id, access_count=1):
        """处理手机拿取请求"""
        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "error": "用户不存在"}

        if (user.current_score or 0) < self.min_score_required:
            return {
                "success": False,
                "error": f"积分不足，需要至少{self.min_score_required}分",
                "current_score": user.current_score or 0,
            }

        deduction = self.access_cost * access_count
        deduction_ratio = deduction / (user.current_score or 1)

        if deduction_ratio < self.min_deduction_ratio:
            deduction = int((user.current_score or 1) * self.min_deduction_ratio)
        elif deduction_ratio > self.max_deduction_ratio:
            deduction = int((user.current_score or 1) * self.max_deduction_ratio)

        original_score = user.current_score or 0
        user.current_score = max(0, original_score - deduction)

        score_record = ScoreRecord(
            student_id=user_id,
            rule_id="PHONE_ACCESS",
            score_change=-deduction,
            description=f"手机拿取奖励扣除 x{access_count}",
        )
        with db_session_scope():
            db.session.add(score_record)

        return {
            "success": True,
            "deducted_score": deduction,
            "remaining_score": user.current_score,
            "deduction_ratio": (round(deduction / original_score, 2) if original_score > 0 else 0),
            "message": f"成功扣除{deduction}分，剩余{user.current_score}分",
        }


class RewardSystem:
    """奖励体系"""

    def __init__(self):
        self.reward_types = {
            "phone_access": {
                "name": "手机拿取资格",
                "cost": 30,
                "min_rank": 10,
                "max_usage_per_day": 1,
                "description": "获得一次使用手机的机会",
            },
            "early_leave": {
                "name": "提前离校",
                "cost": 50,
                "min_rank": 5,
                "max_usage_per_day": 1,
                "description": "可以提前1小时离校",
            },
            "gift_redemption": {
                "name": "奖品兑换",
                "cost": 100,
                "min_rank": 20,
                "max_usage_per_day": 3,
                "description": "兑换指定奖品",
            },
            "activity_participation": {
                "name": "活动参与资格",
                "cost": 20,
                "min_rank": 30,
                "max_usage_per_day": 2,
                "description": "参与课外活动",
            },
            "honor_title": {
                "name": "荣誉称号",
                "cost": 200,
                "min_rank": 3,
                "max_usage_per_day": 0,
                "description": "获得特殊荣誉称号（一次性）",
            },
        }

    def get_eligible_rewards(self, user):
        """获取用户可兑换的奖励"""
        eligible = []

        for reward_type, config in self.reward_types.items():
            can_afford = (user.current_score or 0) >= config["cost"]
            eligible.append(
                {
                    "type": reward_type,
                    "name": config["name"],
                    "cost": config["cost"],
                    "min_rank": config["min_rank"],
                    "max_usage_per_day": config["max_usage_per_day"],
                    "description": config["description"],
                    "can_afford": can_afford,
                }
            )

        return eligible

    def get_user_eligible_rewards(self, user_id):
        """获取用户可兑换的奖励列表"""
        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "error": "用户不存在"}

        eligible = self.get_eligible_rewards(user)
        return {
            "success": True,
            "rewards": eligible,
            "current_score": user.current_score or 0,
        }

    def redeem_reward(self, user_id, reward_type):
        """兑换奖励"""
        user = get_by_id(User, user_id)
        reward = self.reward_types.get(reward_type)

        if not reward:
            return {"success": False, "error": "奖励类型不存在"}

        if (user.current_score or 0) < reward["cost"]:
            return {
                "success": False,
                "error": f'积分不足，需要{reward["cost"]}分',
                "current_score": user.current_score or 0,
            }

        today = date.today()
        usage_count = ScoreRecord.query.filter(
            ScoreRecord.student_id == user_id,
            ScoreRecord.rule_id == reward_type,
            func.date(ScoreRecord.created_at) == today,
        ).count()

        if reward["max_usage_per_day"] > 0 and usage_count >= reward["max_usage_per_day"]:
            return {
                "success": False,
                "error": f"今日已使用{usage_count}次，达到每日限制",
                "daily_limit": reward["max_usage_per_day"],
            }

        user.current_score = (user.current_score or 0) - reward["cost"]

        score_record = ScoreRecord(
            student_id=user_id,
            rule_id=reward_type,
            score_change=-reward["cost"],
            description=f'兑换奖励：{reward["name"]}',
        )
        with db_session_scope():
            db.session.add(score_record)

        return {
            "success": True,
            "reward_type": reward_type,
            "reward_name": reward["name"],
            "cost": reward["cost"],
            "remaining_score": user.current_score,
            "message": f'奖励"{reward["name"]}"兑换成功',
        }

    def get_reward_types(self):
        """获取所有奖励类型"""
        return [
            {
                "type": key,
                "name": config["name"],
                "cost": config["cost"],
                "min_rank": config["min_rank"],
                "max_usage_per_day": config["max_usage_per_day"],
                "description": config["description"],
            }
            for key, config in self.reward_types.items()
        ]


class RewardInteractionController:
    """奖励间关联控制"""

    def __init__(self):
        self.max_score_change_per_day = 20
        self.max_negative_ratio = 0.20
        self.positive_boost_factor = 1.2

    def calculate_adjusted_change(self, user_id, base_change, behavior_type):
        """计算调整后的积分变化"""
        user = get_by_id(User, user_id)
        if not user:
            return base_change

        today = date.today()
        today_changes = ScoreRecord.query.filter(
            ScoreRecord.student_id == user_id,
            func.date(ScoreRecord.created_at) == today,
        ).all()

        today_total = sum(r.score_change for r in today_changes)

        if base_change > 0 and behavior_type in ["exam", "class_performance"]:
            adjusted_change = base_change * self.positive_boost_factor
        else:
            adjusted_change = base_change

        new_total = today_total + adjusted_change

        if abs(new_total) > self.max_score_change_per_day:
            if new_total > 0:
                adjusted_change = self.max_score_change_per_day - today_total
            else:
                adjusted_change = -self.max_score_change_per_day - today_total

        if adjusted_change < 0:
            ratio = abs(adjusted_change) / (user.current_score or 1)
            if ratio > self.max_negative_ratio:
                adjusted_change = -(user.current_score or 1) * self.max_negative_ratio

        return round(adjusted_change, 1)

    def validate_reward_combination(self, user_id, reward_types):
        """验证奖励组合是否允许"""
        mutually_exclusive_groups = [
            ["phone_access", "early_leave"],
        ]

        for group in mutually_exclusive_groups:
            if all(rt in reward_types for rt in group):
                return {
                    "valid": False,
                    "error": f"奖励{group}不能同时使用",
                    "conflicting_rewards": group,
                }

        return {"valid": True}

    def get_daily_usage(self, user_id):
        """获取用户今日奖励使用情况"""
        today = date.today()
        records = ScoreRecord.query.filter(
            ScoreRecord.student_id == user_id,
            ScoreRecord.description.like("%兑换奖励%"),
            func.date(ScoreRecord.created_at) == today,
        ).all()

        usage = {}
        for record in records:
            reward_type = record.rule_id
            usage[reward_type] = usage.get(reward_type, 0) + 1

        return {"success": True, "daily_usage": usage}
