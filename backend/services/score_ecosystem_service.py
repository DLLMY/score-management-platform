from datetime import datetime
from models import ScoreRecord, User, get_by_id, db
from utils.db_session import db_session_scope


class ScoreEcosystem:
    """积分生态系统"""

    def __init__(self):
        self.earning_rules = {
            "attendance": {
                "base_score": 5,
                "variance": 2,
                "description": "按时到校",
            },
            "homework": {
                "base_score": 3,
                "variance": 1,
                "description": "按时交作业",
            },
            "class_performance": {
                "base_score": 8,
                "variance": 3,
                "description": "课堂表现优秀",
            },
            "exam": {
                "base_score": 15,
                "variance": 5,
                "description": "考试成绩优秀",
            },
            "daily_behavior": {
                "base_score": 2,
                "variance": 1,
                "description": "日常行为良好",
            },
        }

        self.spending_rules = {
            "reward_redemption": {
                "base_cost": 50,
                "min_score": 100,
                "description": "兑换奖品",
            },
            "phone_access": {
                "base_cost": 30,
                "min_score": 60,
                "description": "手机拿取资格",
            },
            "penalty_exemption": {
                "base_cost": 20,
                "min_score": 40,
                "description": "豁免惩罚",
            },
        }

        self.score_validity_days = 365
        self.max_score = 1000
        self.min_score = 0

    def calculate_earning(self, behavior_type, user_context=None):
        """计算积分获取"""
        rule = self.earning_rules.get(behavior_type)
        if not rule:
            return 0

        base = rule["base_score"]
        variance = rule["variance"]

        if user_context:
            multiplier = user_context.get("multiplier", 1.0)
            random_factor = user_context.get("random_factor", 0)
            return round(base * multiplier + variance * random_factor)

        return base

    def calculate_spending(self, spending_type, user_score):
        """计算积分消费"""
        rule = self.spending_rules.get(spending_type)
        if not rule:
            return {"success": False, "error": "消费类型不存在"}

        if user_score < rule["min_score"]:
            return {
                "success": False,
                "error": f'积分不足，最低需要{rule["min_score"]}分',
                "current_score": user_score,
                "required_score": rule["min_score"],
            }

        return {
            "success": True,
            "cost": rule["base_cost"],
            "remaining_score": user_score - rule["base_cost"],
            "spending_type": spending_type,
            "description": rule["description"],
        }

    def check_score_validity(self, last_earned_date):
        """检查积分有效期"""
        days_since_earned = (datetime.now() - last_earned_date).days
        if days_since_earned > self.score_validity_days:
            return {
                "valid": False,
                "days_expired": days_since_earned - self.score_validity_days,
            }

        return {
            "valid": True,
            "days_remaining": self.score_validity_days - days_since_earned,
        }

    def apply_bounds(self, score):
        """应用分数边界限制"""
        return max(self.min_score, min(score, self.max_score))

    def earn_score(self, user_id, behavior_type, context=None):
        """获取积分"""
        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "error": "用户不存在"}

        score_change = self.calculate_earning(behavior_type, context)
        if score_change <= 0:
            return {"success": False, "error": "无效的行为类型"}

        user.current_score = self.apply_bounds((user.current_score or 0) + score_change)

        with db_session_scope():
            record = ScoreRecord(student_id=user_id,
                rule_id=behavior_type,
                score_change=score_change,
                description=f"积分获取: {self.earning_rules[behavior_type]['description']}",
            )
            db.session.add(record)

        return {
            "success": True,
            "behavior_type": behavior_type,
            "score_change": score_change,
            "previous_score": user.current_score - score_change,
            "new_score": user.current_score,
            "description": self.earning_rules[behavior_type]["description"],
        }

    def spend_score(self, user_id, spending_type, amount=1):
        """消费积分"""
        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "error": "用户不存在"}

        calculation = self.calculate_spending(spending_type, user.current_score or 0)
        if not calculation["success"]:
            return calculation

        total_cost = calculation["cost"] * amount
        new_score = user.current_score - total_cost

        if new_score < 0:
            return {"success": False, "error": "积分不足"}

        user.current_score = self.apply_bounds(new_score)

        with db_session_scope():
            record = ScoreRecord(student_id=user_id,
                rule_id=spending_type,
                score_change=-total_cost,
                description=f'积分消费: {calculation["description"]} x {amount}',
            )
            db.session.add(record)

        return {
            "success": True,
            "spending_type": spending_type,
            "cost": total_cost,
            "amount": amount,
            "previous_score": user.current_score + total_cost,
            "new_score": user.current_score,
            "description": calculation["description"],
        }

    def get_earning_rules(self):
        """获取所有积分获取规则"""
        return [
            {
                "behavior_type": key,
                "base_score": rule["base_score"],
                "variance": rule["variance"],
                "description": rule["description"],
            }
            for key, rule in self.earning_rules.items()
        ]

    def get_spending_rules(self):
        """获取所有积分消费规则"""
        return [
            {
                "spending_type": key,
                "base_cost": rule["base_cost"],
                "min_score": rule["min_score"],
                "description": rule["description"],
            }
            for key, rule in self.spending_rules.items()
        ]

    def get_user_balance(self, user_id):
        """获取用户积分余额"""
        user = get_by_id(User, user_id)
        if not user:
            return {"success": False, "error": "用户不存在"}

        last_earned = ScoreRecord.query.filter(ScoreRecord.student_id == user_id, ScoreRecord.score_change > 0).order_by(
            ScoreRecord.created_at.desc()
        ).first()

        validity = self.check_score_validity(last_earned.created_at if last_earned else datetime.now())

        return {
            "success": True,
            "user_id": user_id,
            "current_score": user.current_score or 0,
            "score_validity": validity,
            "max_score": self.max_score,
            "min_score": self.min_score,
        }
