from datetime import datetime, timedelta
from models import User, ScoreRecord, get_by_id
import numpy as np

# (空行)
# 积分异常检测服务模块
# 基于统计方法和机器学习算法检测积分异常
# (空行)
CACHE_PREFIX = "anomaly:"
ANOMALY_TYPES = {
    "sudden_change": {
        "name": "突变异常",
        "threshold": 3,
        "description": "单次积分变化超过3个标准差",
    },
    "trend_anomaly": {"name": "趋势异常", "window": 5, "description": "连续5天以上同向变化"},
    "group_anomaly": {
        "name": "群体异常",
        "threshold": 5,
        "description": "短时间内大量用户出现相同异常",
    },
    "frequency_anomaly": {
        "name": "频率异常",
        "threshold": 10,
        "description": "单日积分变动次数超过阈值",
    },
}


class AnomalyDetector:
    """积分异常检测器"""

    def __init__(self, contamination=0.1):
        """
        初始化异常检测器
        Args:
            contamination: 异常比例估计，默认10%
        """
        self.contamination = contamination
        self.mean = None
        self.std = None
        self.fitted = False

    def fit(self, scores):
        """
        训练异常检测模型
        Args:
            scores: 积分变化列表
        """
        scores_array = np.array(scores)
        self.mean = np.mean(scores_array)
        self.std = np.std(scores_array)
        self.fitted = True
        return self

    def detect_zscore(self, value):
        """
        使用Z-Score检测异常
        Args:
            value: 待检测的值
        Returns:
            tuple: (是否异常, Z分数)
        """
        if not self.fitted or self.std == 0:
            return (False, 0.0)
        z_score = abs((value - self.mean) / self.std)
        is_anomaly = z_score > ANOMALY_TYPES["sudden_change"]["threshold"]
        return (is_anomaly, round(z_score, 3))

    def detect_batch(self, scores):
        """
        批量检测异常
        Args:
            scores: 积分变化列表
        Returns:
            list: 异常记录列表
        """
        if not self.fitted:
            self.fit(scores)
        anomalies = []
        for i, score in enumerate(scores):
            is_anomaly, z_score = self.detect_zscore(score)
            if is_anomaly:
                anomalies.append(
                    {"index": i, "value": score, "z_score": z_score, "type": "sudden_change"}
                )
        return anomalies


class AnomalyService:
    """积分异常检测服务类"""

    @staticmethod
    def get_student_score_changes(user_id, days=30):
        """
        获取学生积分变化记录
        Args:
            user_id: 学生ID
            days: 历史天数
        Returns:
            list: 积分变化记录
        """
        start_date = datetime.now() - timedelta(days=days)
        records = (
            ScoreRecord.query.filter(
                ScoreRecord.student_id == user_id, ScoreRecord.created_at >= start_date
            )
            .order_by(ScoreRecord.created_at.asc())
            .all()
        )
        changes = []
        for record in records:
            changes.append(
                {
                    "date": record.created_at,
                    "score_change": record.score_change,
                    "rule_name": getattr(record, "rule_name", None),
                    "category": getattr(record, "category", None),
                }
            )
        return changes

    @staticmethod
    def detect_sudden_change(user_id, days=30):
        """
        检测突变异常
        Args:
            user_id: 学生ID
            days: 历史天数
        Returns:
            list: 突变异常列表
        """
        changes = AnomalyService.get_student_score_changes(user_id, days)
        if len(changes) < 10:
            return []
        score_changes = [c["score_change"] for c in changes]
        detector = AnomalyDetector()
        detector.fit(score_changes)
        anomalies = detector.detect_batch(score_changes)
        result = []
        for anomaly in anomalies:
            idx = anomaly["index"]
            result.append(
                {
                    "date": changes[idx]["date"].isoformat(),
                    "score_change": changes[idx]["score_change"],
                    "rule_name": changes[idx]["rule_name"],
                    "z_score": anomaly["z_score"],
                    "description": f'检测到{anomaly["z_score"]:.2f}分的异常变化',
                }
            )
        return result

    @staticmethod
    def detect_trend_anomaly(user_id, days=30):
        """
        检测趋势异常
        Args:
            user_id: 学生ID
            days: 历史天数
        Returns:
            dict: 趋势异常信息
        """
        changes = AnomalyService.get_student_score_changes(user_id, days)
        if len(changes) < ANOMALY_TYPES["trend_anomaly"]["window"]:
            return {"has_anomaly": False, "trend": "stable"}
        daily_changes = {}
        for change in changes:
            date_key = change["date"].date().isoformat()
            if date_key not in daily_changes:
                daily_changes[date_key] = 0
            daily_changes[date_key] += change["score_change"]
        daily_list = list(daily_changes.values())
        if len(daily_list) < ANOMALY_TYPES["trend_anomaly"]["window"]:
            return {"has_anomaly": False, "trend": "stable"}
        window = ANOMALY_TYPES["trend_anomaly"]["window"]
        recent_changes = daily_list[-window:]
        all_positive = all((c > 0 for c in recent_changes))
        all_negative = all((c < 0 for c in recent_changes))
        if all_positive:
            total_change = sum(recent_changes)
            return {
                "has_anomaly": True,
                "trend": "rising",
                "consecutive_days": window,
                "total_change": round(total_change, 2),
                "description": f"连续{window}天积分持续上升，总计上升{total_change}分",
            }
        elif all_negative:
            total_change = sum(recent_changes)
            return {
                "has_anomaly": True,
                "trend": "falling",
                "consecutive_days": window,
                "total_change": round(total_change, 2),
                "description": f"连续{window}天积分持续下降，总计下降{abs(total_change)}分",
            }
        return {"has_anomaly": False, "trend": "stable"}

    @staticmethod
    def detect_group_anomaly(user_id, days=30):
        """
        检测群体异常（与班级对比）
        Args:
            user_id: 学生ID
            days: 历史天数
        Returns:
            dict: 群体异常信息
        """
        user = get_by_id(User, user_id)
        if not user or not user.class_name:
            return {"has_anomaly": False, "deviation": 0}
        changes = AnomalyService.get_student_score_changes(user_id, days)
        if not changes:
            return {"has_anomaly": False, "deviation": 0}
        user_total = sum((c["score_change"] for c in changes))
        classmates = User.query.filter(
            User.class_name == user.class_name, User.id != user_id, User.is_active
        ).all()
        if not classmates:
            return {"has_anomaly": False, "deviation": 0}
        classmate_totals = []
        for classmate in classmates:
            classmate_changes = AnomalyService.get_student_score_changes(classmate.id, days)
            if classmate_changes:
                classmate_totals.append(sum((c["score_change"] for c in classmate_changes)))
        if not classmate_totals:
            return {"has_anomaly": False, "deviation": 0}
        class_mean = float(np.mean(classmate_totals))
        class_std = float(np.std(classmate_totals)) if len(classmate_totals) > 1 else 1.0
        if class_std == 0:
            return {"has_anomaly": False, "deviation": 0}
        # 转 Python 原生类型：numpy 标量(bool_/float64) Flask 默认 JSON 不可序列化
        deviation = float((user_total - class_mean) / class_std)
        threshold = ANOMALY_TYPES["group_anomaly"]["threshold"]
        is_anomaly = bool(abs(deviation) > threshold)
        return {
            "has_anomaly": is_anomaly,
            "deviation": round(deviation, 2),
            "user_total": round(float(user_total), 2),
            "class_mean": round(class_mean, 2),
            "class_std": round(class_std, 2),
            "description": f"该学生积分偏离班级均值{abs(deviation):.1f}个标准差",
        }

    @staticmethod
    def detect_frequency_anomaly(user_id, days=1):
        """
        检测频率异常（短时间积分次数）
        Args:
            user_id: 学生ID
            days: 时间窗口（天）
        Returns:
            dict: 频率异常信息
        """
        start_date = datetime.now() - timedelta(days=days)
        count = ScoreRecord.query.filter(
            ScoreRecord.student_id == user_id, ScoreRecord.created_at >= start_date
        ).count()
        threshold = ANOMALY_TYPES["frequency_anomaly"]["threshold"]
        is_anomaly = count > threshold
        return {
            "has_anomaly": is_anomaly,
            "count": count,
            "threshold": threshold,
            "time_window_days": days,
            "description": f"24小时内有{count}条积分记录" if is_anomaly else "积分频率正常",
        }

    @staticmethod
    def detect_all_anomalies(user_id, days=30):
        """
        综合检测所有类型的异常
        Args:
            user_id: 学生ID
            days: 历史天数
        Returns:
            dict: 综合异常检测结果
        """
        result = {
            "user_id": user_id,
            "has_anomaly": False,
            "anomalies": [],
            "summary": {
                "sudden_change": 0,
                "trend_anomaly": False,
                "group_anomaly": False,
                "frequency_anomaly": False,
            },
        }
        sudden_changes = AnomalyService.detect_sudden_change(user_id, days)
        result["summary"]["sudden_change"] = len(sudden_changes)
        for anomaly in sudden_changes:
            result["anomalies"].append(
                {
                    "type": "sudden_change",
                    "name": ANOMALY_TYPES["sudden_change"]["name"],
                    "date": anomaly["date"],
                    "details": anomaly["description"],
                    "severity": "high" if anomaly.get("z_score", 0) > 3 else "medium",
                }
            )  # noqa: E501
        trend_anomaly = AnomalyService.detect_trend_anomaly(user_id, days)
        result["summary"]["trend_anomaly"] = trend_anomaly["has_anomaly"]
        if trend_anomaly["has_anomaly"]:
            result["anomalies"].append(
                {
                    "type": "trend_anomaly",
                    "name": ANOMALY_TYPES["trend_anomaly"]["name"],
                    "details": trend_anomaly["description"],
                    "severity": "high" if abs(trend_anomaly["total_change"]) > 10 else "medium",
                }
            )  # noqa: E501
        group_anomaly = AnomalyService.detect_group_anomaly(user_id, days)
        result["summary"]["group_anomaly"] = group_anomaly["has_anomaly"]
        if group_anomaly["has_anomaly"]:
            result["anomalies"].append(
                {
                    "type": "group_anomaly",
                    "name": ANOMALY_TYPES["group_anomaly"]["name"],
                    "details": group_anomaly["description"],
                    "severity": "high" if abs(group_anomaly["deviation"]) > 10 else "medium",
                }
            )  # noqa: E501
        frequency_anomaly = AnomalyService.detect_frequency_anomaly(user_id, days=1)
        result["summary"]["frequency_anomaly"] = frequency_anomaly["has_anomaly"]
        if frequency_anomaly["has_anomaly"]:
            result["anomalies"].append(
                {
                    "type": "frequency_anomaly",
                    "name": ANOMALY_TYPES["frequency_anomaly"]["name"],
                    "details": frequency_anomaly["description"],
                    "severity": "medium",
                }
            )
        result["has_anomaly"] = len(result["anomalies"]) > 0
        result["suggestions"] = AnomalyService._generate_suggestions(result["anomalies"])
        return result

    @staticmethod
    def _generate_suggestions(anomalies):
        """
        根据异常类型生成处理建议
        Args:
            anomalies: 异常列表
        Returns:
            list: 建议列表
        """
        suggestions = []
        for anomaly in anomalies:
            if anomaly["type"] == "sudden_change":
                suggestions.append(
                    {
                        "type": "调查",
                        "priority": "high",
                        "message": "检测到积分突变，建议核查该记录的真实性",
                    }
                )
            elif anomaly["type"] == "trend_anomaly":
                suggestions.append(
                    {
                        "type": "关注",
                        "priority": "medium",
                        "message": "积分持续变化，建议关注学生近期表现",
                    }
                )
            elif anomaly["type"] == "group_anomaly":
                suggestions.append(
                    {
                        "type": "对比分析",
                        "priority": "medium",
                        "message": "积分偏离班级平均较大，建议与班主任沟通了解情况",
                    }
                )
            elif anomaly["type"] == "frequency_anomaly":
                suggestions.append(
                    {
                        "type": "设备检查",
                        "priority": "low",
                        "message": "积分频率异常，建议检查设备是否正常",
                    }
                )
        return suggestions

    @staticmethod
    def get_all_anomalies(class_name=None, days=30):
        """
        获取所有学生的异常
        Args:
            class_name: 班级名称（可选）
            days: 历史天数
        Returns:
            dict: 与前端 BatchAnomalyData 对齐
                  {summary:{total_anomalies,high/medium/low_severity_count,
                            total_students,students_with_anomaly,anomalies_by_type},
                   anomalies:[{user_id,name,class_name,current_score,
                               anomaly_type,severity,description,score_change,detected_at}]}
        """
        query = User.query.filter(User.is_active)
        if class_name:
            query = query.filter(User.class_name == class_name)
        users = query.all()

        # 与前端 BatchAnomalyData.summary 对齐：初始化 0 兜底，避免前端读到 undefined 崩溃。
        results = {
            "total_students": len(users),
            "students_with_anomaly": 0,
            "anomalies_by_type": {
                "sudden_change": 0,
                "trend_anomaly": 0,
                "group_anomaly": 0,
                "frequency_anomaly": 0,
            },
            "summary": {
                "total_anomalies": 0,
                "high_severity_count": 0,
                "medium_severity_count": 0,
                "low_severity_count": 0,
            },
            "anomalies": [],
        }

        for user in users:
            anomaly_result = AnomalyService.detect_all_anomalies(user.id, days)
            user_anomalies = anomaly_result.get("anomalies") or []
            if not user_anomalies:
                continue

            results["students_with_anomaly"] += 1

            for a in user_anomalies:
                atype = a.get("type") or "unknown"
                # 映射后端 severity -> 统计：'medium'/'high' 已知，频率类型可能 None 视为 low。
                sev = a.get("severity") or "low"
                results["summary"]["total_anomalies"] += 1
                if atype in results["anomalies_by_type"]:
                    results["anomalies_by_type"][atype] += 1
                if sev == "high":
                    results["summary"]["high_severity_count"] += 1
                elif sev == "medium":
                    results["summary"]["medium_severity_count"] += 1
                else:
                    results["summary"]["low_severity_count"] += 1

                # A18 归因补全：sudden_change 用 z_score；trend 用连续同向总变化
                # （total_change 带符号）；group 用与班级均值的标准差偏差（deviation）。
                # 全部 int() 归一，前端 .toFixed() 不会 NaN。
                score_change = 0
                if atype == "sudden_change":
                    score_change = int(a.get("z_score", 0) or 0)
                elif atype == "trend_anomaly":
                    score_change = int(a.get("total_change", 0) or 0)
                elif atype == "group_anomaly":
                    score_change = int(a.get("deviation", 0) or 0)

                # detected_at：仅 sudden_change 带 date，其它用当前时间。
                detected_at = a.get("date")
                if isinstance(detected_at, datetime):
                    detected_at_str = detected_at.strftime("%Y-%m-%d %H:%M")
                else:
                    detected_at_str = datetime.now().strftime("%Y-%m-%d %H:%M")

                results["anomalies"].append(
                    {
                        "user_id": user.id,
                        "name": user.name,
                        "class_name": user.class_name,
                        "current_score": user.current_score,
                        "anomaly_type": atype,
                        "anomaly_type_label": ANOMALY_TYPES.get(atype, {}).get("name", atype),
                        "severity": sev,
                        "description": a.get("details") or a.get("description") or "",
                        "score_change": score_change,
                        "detected_at": detected_at_str,
                    }
                )

        # 异常计数多的在前
        results["anomalies"].sort(
            key=lambda x: (
                0 if x.get("severity") == "high" else 1 if x.get("severity") == "medium" else 2,
                -(x.get("score_change") or 0),
            )
        )
        return results
