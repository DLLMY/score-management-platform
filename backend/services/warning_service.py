from datetime import datetime, timedelta
from sqlalchemy import case
from models import User, Score, ScoreRecord, RiskWarning, WarningConfig, CompositeScore, get_by_id, db
from utils.db_session import db_session_scope

"\n"
"风险预警服务模块"
"基于行为数据和成绩数据实现学生风险预警"
"\n"


class WarningService:
    """风险预警服务类"""

    DEFAULT_CONFIG = {
        "score_threshold": "30",
        "unlock_daily_limit": "5",
        "no_positive_days": "7",
        "low_score_threshold": "60",
        "risk_score_threshold": "0.7",
    }

    # 风险等级严重度，数值越大越严重
    RISK_SEVERITY = {"low": 0, "medium": 1, "high": 2}

    @staticmethod
    def escalate_risk_level(current, candidate):
        """
        按严重度取更高的风险等级。

        不能直接用 max(current, candidate)：那是字符串字典序比较，
        而字典序为 high < low < medium，与真实严重度 low < medium < high 不符。
        例如 max("medium", "high") == "medium"，会导致本应升级为 high 的学生停留在 medium；
        max("high", "medium") == "medium"，则会把已判定的高危学生反向降级。

        Args:
            current (str): 当前风险等级
            candidate (str): 待合入的风险等级
        Returns:
            str: 严重度更高的等级
        """
        order = WarningService.RISK_SEVERITY
        if order.get(candidate, 0) > order.get(current, 0):
            return candidate
        return current

    @staticmethod
    def evaluate_risk(class_name=None):
        """
        评估学生风险
        Args:
            class_name (str): 班级名称（可选）
        Returns:
            dict: 风险评估结果
        """
        config = WarningService._get_config()
        query = User.query.filter(User.is_active)
        if class_name:
            query = query.filter(User.class_name == class_name)
        users = query.all()
        if not users:
            return {
                "risk_threshold": int(config["score_threshold"]),
                "risk_students": [],
                "warning_reasons": {},
                "message": "没有找到学生数据",
            }
        risk_students = []
        warning_reasons = {}
        for user in users:
            reasons = []
            risk_level = "low"
            if user.current_score < int(config["score_threshold"]):
                reasons.append(f"积分低于预警阈值({config['score_threshold']}分)")
                risk_level = "high" if user.current_score < int(config["score_threshold"]) / 2 else "medium"
            no_positive_days = WarningService._get_no_positive_days(user.id)
            if no_positive_days >= int(config["no_positive_days"]):
                reasons.append(f"连续{no_positive_days}天无正向积分")
                risk_level = WarningService.escalate_risk_level(risk_level, "medium")
            daily_unlock_count = WarningService._get_today_unlock_count(user.id)
            if daily_unlock_count >= int(config["unlock_daily_limit"]):
                reasons.append(f"今日开锁次数过多({daily_unlock_count}次)")
                risk_level = WarningService.escalate_risk_level(risk_level, "medium")
            avg_score = WarningService._get_student_avg_score(user.id)
            if avg_score is not None and avg_score < float(config["low_score_threshold"]):
                reasons.append(f"平均成绩低于{config['low_score_threshold']}分")
                risk_level = WarningService.escalate_risk_level(risk_level, "high")
            composite = CompositeScore.query.filter_by(user_id=user.id).first()
            if composite and composite.composite_score < 40:
                reasons.append("综合评分偏低")
                risk_level = WarningService.escalate_risk_level(risk_level, "medium")
            if reasons:
                risk_students.append(
                    {
                        "user_id": user.id,
                        "name": user.name,
                        "class_name": user.class_name,
                        "current_score": user.current_score,
                        "avg_score": avg_score,
                        "risk_level": risk_level,
                    }
                )
                warning_reasons[user.id] = reasons
                WarningService._update_user_risk_score(user.id, risk_level)
                WarningService._create_warning_record(user.id, risk_level, reasons)
        risk_students.sort(key=lambda x: ["high", "medium", "low"].index(x["risk_level"]))
        return {
            "risk_threshold": int(config["score_threshold"]),
            "risk_students": risk_students,
            "warning_reasons": warning_reasons,
            "total_risk_count": len(risk_students),
            "updated_at": datetime.now().isoformat(),
        }

    @staticmethod
    def _get_no_positive_days(user_id):
        """
        获取连续无正向积分的天数
        Args:
            user_id (int): 学生ID
        Returns:
            int: 连续天数
        """
        today = datetime.now().date()
        days_count = 0
        for i in range(30):
            check_date = today - timedelta(days=i)
            records = ScoreRecord.query.filter(
                ScoreRecord.user_id == user_id,
                ScoreRecord.score_change > 0,
                ScoreRecord.created_at >= datetime(check_date.year, check_date.month, check_date.day),
                ScoreRecord.created_at <= datetime(check_date.year, check_date.month, check_date.day, 23, 59, 59),
            ).first()
            if records:
                break
            days_count += 1
        return days_count

    @staticmethod
    def _get_today_unlock_count(user_id):
        """
        获取今日开锁次数
        Args:
            user_id (int): 学生ID
        Returns:
            int: 开锁次数
        """
        today = datetime.now().date()
        # 注意：.count() 已返回整数，不能再套 len()（原实现如此，会抛
        # TypeError: object of type 'int' has no len()，导致 evaluate_risk 整体 500）
        unlock_count = (
            ScoreRecord.query.filter(ScoreRecord.user_id == user_id, ScoreRecord.description.like("%开锁%"))
            .filter(ScoreRecord.created_at >= datetime(today.year, today.month, today.day))
            .count()
        )
        return unlock_count

    @staticmethod
    def _get_student_avg_score(user_id):
        """
        获取学生平均成绩
        Args:
            user_id (int): 学生ID
        Returns:
            float: 平均成绩
        """
        scores = Score.query.filter_by(student_id=user_id).all()
        if scores:
            valid_scores = [s.score for s in scores if s.score is not None]
            return round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else None
        return None

    @staticmethod
    def _calculate_risk_score(user, reasons):
        """
        计算风险评分
        Args:
            user (User): 用户对象
            reasons (list): 风险原因列表
        Returns:
            float: 风险评分(0-1)
        """
        score = 0.0
        score_threshold = int(WarningService._get_config()["score_threshold"])
        if user.current_score < score_threshold:
            score += (1 - user.current_score / score_threshold) * 0.3
        if any(("连续" in r for r in reasons)) or any(("开锁次数" in r for r in reasons)):
            score += 0.3
        avg_score = WarningService._get_student_avg_score(user.id)
        if avg_score is not None and avg_score < 60:
            score += (1 - avg_score / 60) * 0.4
        return round(min(score, 1.0), 2)

    @staticmethod
    def _update_user_risk_score(user_id, risk_level):
        """
        更新用户风险评分
        Args:
            user_id (int): 用户ID
            risk_level (str): 风险等级
        """
        user = get_by_id(User, user_id)
        if user:
            level_score = {"low": 0.2, "medium": 0.5, "high": 0.8}
            user.risk_score = level_score.get(risk_level, 0.5)
            user.last_risk_updated = datetime.now()
            # 注意：不能用 db_session_scope()，它的 finally 会 session.remove()，
            # 把 evaluate_risk 一开始 User.query.all() 加载出来的 users 列表一并 detach，
            # 导致下一轮循环访问 user.current_score 时触发懒加载刷新并抛
            # "Instance <User> is not bound to a Session"。这里只 commit，保留会话。
            db.session.commit()

    @staticmethod
    def _create_warning_record(user_id, risk_level, reasons):
        """
        创建预警记录
        Args:
            user_id (int): 用户ID
            risk_level (str): 风险等级
            reasons (list): 风险原因
        """
        existing = RiskWarning.query.filter(RiskWarning.user_id == user_id, ~RiskWarning.is_resolved).first()
        if existing:
            existing.risk_level = risk_level
            existing.description = "; ".join(reasons)
            existing.updated_at = datetime.now()
            db.session.commit()
        else:
            warning = RiskWarning(
                user_id=user_id,
                risk_level=risk_level,
                risk_type="comprehensive",
                description="; ".join(reasons),
                created_at=datetime.now(),
            )
            db.session.add(warning)
            db.session.commit()
            return

    @staticmethod
    def _get_config():
        """
        获取预警配置
        Returns:
            dict: 配置字典
        """
        config = {}
        for key, default in WarningService.DEFAULT_CONFIG.items():
            cfg = WarningConfig.query.filter_by(config_key=key).first()
            config[key] = cfg.config_value if cfg else default
        return config

    @staticmethod
    def get_warnings(class_name=None):
        """
        获取风险预警列表
        Args:
            class_name (str): 班级名称（可选）
        Returns:
            dict: 预警列表
        """
        # RiskWarning.user_id 是普通整数列，模型上并没有 user 关系，
        # 因此不能写 warning.user.name（会抛 AttributeError）。
        # 这里把 User 一并 select 出来，配对取用。
        query = db.session.query(RiskWarning, User).join(User, RiskWarning.user_id == User.id).filter(
            ~RiskWarning.is_resolved, User.is_active
        )
        if class_name:
            query = query.filter(User.class_name == class_name)

        # risk_level 是字符串列，直接 desc() 得到的是字典序（medium > low > high），
        # 会把最该置顶的 high 排到最后，故按显式严重度排序。
        severity_order = case(WarningService.RISK_SEVERITY, value=RiskWarning.risk_level, else_=0)
        rows = query.order_by(severity_order.desc(), RiskWarning.created_at.desc()).all()

        result = []
        warning_reasons = {}
        for warning, user in rows:
            result.append(
                {
                    "warning_id": warning.id,
                    "user_id": warning.user_id,
                    "name": user.name,
                    "class_name": user.class_name,
                    "current_score": user.current_score,
                    "risk_level": warning.risk_level,
                    "created_at": warning.created_at.isoformat() if warning.created_at else None,
                }
            )
            warning_reasons[warning.user_id] = warning.description.split("; ") if warning.description else []
        return {
            "risk_threshold": int(WarningService._get_config()["score_threshold"]),
            "risk_students": result,
            "warning_reasons": warning_reasons,
            "total_risk_count": len(result),
        }

    @staticmethod
    def resolve_warning(warning_id):
        """
        解决预警
        Args:
            warning_id (int): 预警ID
        Returns:
            bool: 是否成功
        """
        warning = get_by_id(RiskWarning, warning_id)
        if warning:
            warning.is_resolved = True
            warning.resolved_at = datetime.now()
            with db_session_scope():
                pass
            return True
        return False

    @staticmethod
    def update_config(config_key, config_value, description=""):
        """
        更新预警配置
        Args:
            config_key (str): 配置键
            config_value (str): 配置值
            description (str): 描述
        Returns:
            bool: 是否成功
        """
        if config_key not in WarningService.DEFAULT_CONFIG:
            return False
        cfg = WarningConfig.query.filter_by(config_key=config_key).first()
        if cfg:
            cfg.config_value = config_value
            if description:
                cfg.description = description
            cfg.updated_at = datetime.now()
            with db_session_scope():
                pass
        else:
            cfg = WarningConfig(
                risk_type=config_key,
                config_key=config_key,
                config_value=config_value,
                description=description,
                updated_at=datetime.now(),
            )
            with db_session_scope():
                db.session.add(cfg)
        return True

    @staticmethod
    def get_config():
        """
        获取所有预警配置
        Returns:
            dict: 配置字典
        """
        configs = WarningConfig.query.all()
        result = WarningService.DEFAULT_CONFIG.copy()
        for cfg in configs:
            result[cfg.config_key] = cfg.config_value
        return result

    @staticmethod
    def evaluate_all(class_name=None):
        """评估所有风险预警（evaluate_risk 的别名）"""
        return WarningService.evaluate_risk(class_name)
