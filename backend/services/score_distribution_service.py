from models import User
from utils.db_session import db_session_scope


import math


class ScoreDistributionController:
    """评分分布控制器"""

    def __init__(self):
        self.target_distribution = {
            "excellent": {"min_score": 90, "target_ratio": 0.10},
            "good": {"min_score": 80, "target_ratio": 0.30},
            "medium": {"min_score": 70, "target_ratio": 0.40},
            "low": {"min_score": 0, "target_ratio": 0.20},
        }

    def calculate_adjusted_scores(self, raw_scores):
        """计算调整后的评分，满足分布要求"""
        n = len(raw_scores)
        if n == 0:
            return []

        sorted_scores = sorted(raw_scores, reverse=True)

        # 按目标比例确定各档在降序排序中的分界索引（不再强制每档至少 1 人），
        # 避免小班级各档人数累加超过 n 导致 cutoff 全部塌缩到最高分。
        n_exc = int(round(n * 0.10))
        n_good = int(round(n * 0.30))
        n_med = int(round(n * 0.40))
        idx_exc = max(0, min(n_exc, n - 1))
        idx_good = max(idx_exc, min(idx_exc + n_good, n - 1))
        idx_med = max(idx_good, min(idx_good + n_med, n - 1))

        excellent_cutoff = sorted_scores[idx_exc]
        good_cutoff = sorted_scores[idx_good]
        medium_cutoff = sorted_scores[idx_med]

        adjusted_scores = []
        for score in raw_scores:
            if score >= excellent_cutoff:
                adjusted = 90 + (score - excellent_cutoff) * 0.5
            elif score >= good_cutoff:
                adjusted = 80 + (score - good_cutoff) * 0.8
            elif score >= medium_cutoff:
                adjusted = 70 + (score - medium_cutoff) * 0.6
            else:
                adjusted = score * 0.7

            adjusted_scores.append(min(max(round(adjusted, 1), 0), 100))

        return adjusted_scores

    def validate_distribution(self, scores):
        """验证评分分布是否符合要求"""
        n = len(scores)
        if n == 0:
            return {"valid": False, "error": "无数据"}

        excellent = sum(1 for s in scores if s >= 90)
        good = sum(1 for s in scores if 80 <= s < 90)
        medium = sum(1 for s in scores if 70 <= s < 80)
        low = sum(1 for s in scores if s < 70)

        ratios = {
            "excellent": excellent / n,
            "good": good / n,
            "medium": medium / n,
            "low": low / n,
        }

        valid = all(
            abs(ratios[k] - self.target_distribution[k]["target_ratio"]) <= 0.05 for k in ratios
        )

        return {
            "valid": valid,
            "ratios": ratios,
            "targets": self.target_distribution,
            "counts": {
                "excellent": excellent,
                "good": good,
                "medium": medium,
                "low": low,
            },
        }

    def adjust_class_scores(self, class_name):
        """调整班级评分分布"""
        if class_name:
            users = User.query.filter(User.class_name == class_name).all()
        else:
            users = User.query.all()

        raw_scores = [u.current_score or 0 for u in users]
        adjusted_scores = self.calculate_adjusted_scores(raw_scores)

        for i, user in enumerate(users):
            user.current_score = adjusted_scores[i]

        with db_session_scope():
            pass

        validation = self.validate_distribution(adjusted_scores)

        return {
            "success": True,
            "class_name": class_name or "全校",
            "total_students": len(users),
            "adjusted_scores": adjusted_scores,
            "distribution": validation["ratios"],
            "validation": validation,
        }

    def get_distribution_statistics(self, class_name=None):
        """获取评分分布统计"""
        if class_name:
            users = User.query.filter(User.class_name == class_name).all()
        else:
            users = User.query.all()

        scores = [u.current_score or 0 for u in users]
        if not scores:
            return {"success": False, "error": "无数据"}

        n = len(scores)
        excellent = sum(1 for s in scores if s >= 90)
        good = sum(1 for s in scores if 80 <= s < 90)
        medium = sum(1 for s in scores if 70 <= s < 80)
        low = sum(1 for s in scores if s < 70)

        avg_score = sum(scores) / n
        std_score = math.sqrt(sum((s - avg_score) ** 2 for s in scores) / n)
        min_score = min(scores)
        max_score = max(scores)

        return {
            "success": True,
            "class_name": class_name or "全校",
            "total_students": n,
            "distribution": {
                "excellent": excellent / n,
                "good": good / n,
                "medium": medium / n,
                "low": low / n,
            },
            "counts": {
                "excellent": excellent,
                "good": good,
                "medium": medium,
                "low": low,
            },
            "statistics": {
                "avg": round(avg_score, 2),
                "std": round(std_score, 2),
                "min": min_score,
                "max": max_score,
            },
            "target_distribution": self.target_distribution,
        }


class ScoreValidator:
    """评分合理性校验器"""

    def __init__(self):
        self.max_daily_change = 20
        self.z_score_threshold = 3

    def validate_score(self, user_id, new_score, previous_score, change_reason):
        """校验单个分数是否合理"""
        daily_change = abs(new_score - previous_score)
        if daily_change > self.max_daily_change:
            return {
                "valid": False,
                "error_type": "excessive_change",
                "message": (
                    f"单日分数变化({daily_change})超过最大允许幅度(" f"{self.max_daily_change})"
                ),
                "suggested_score": previous_score + (new_score - previous_score) * 0.5,
            }

        return {"valid": True}

    def detect_outliers(self, scores):
        """检测离群值"""
        if len(scores) < 3:
            return {"outliers": [], "valid": True}

        sorted_scores = sorted(scores)
        n = len(sorted_scores)

        q1_index = n // 4
        q3_index = 3 * n // 4
        q1 = sorted_scores[q1_index]
        q3 = sorted_scores[q3_index]
        iqr = q3 - q1

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        mean = sum(scores) / len(scores)

        outliers = []
        for i, score in enumerate(scores):
            if score < lower_bound or score > upper_bound:
                z_score = 0
                std = math.sqrt(sum((s - mean) ** 2 for s in scores) / len(scores)) if scores else 0
                if std > 0:
                    z_score = abs(score - mean) / std
                outliers.append(
                    {
                        "index": i,
                        "score": score,
                        "z_score": round(z_score, 2),
                        "suggested_value": round(mean, 1),
                    }
                )

        std = math.sqrt(sum((s - mean) ** 2 for s in scores) / len(scores)) if scores else 0

        return {
            "outliers": outliers,
            "valid": len(outliers) == 0,
            "mean": round(mean, 2),
            "std": round(std, 2),
            "threshold": self.z_score_threshold,
        }

    def auto_correct(self, scores, outliers):
        """自动修正离群值"""
        corrected = scores.copy()
        for outlier in outliers:
            corrected[outlier["index"]] = outlier["suggested_value"]

        return corrected

    def validate_and_correct(self, scores):
        """校验并修正分数"""
        detection_result = self.detect_outliers(scores)

        if detection_result["valid"]:
            return {
                "success": True,
                "scores": scores,
                "corrected": False,
                "outliers": [],
                "message": "分数正常，无需修正",
            }

        corrected_scores = self.auto_correct(scores, detection_result["outliers"])

        return {
            "success": True,
            "scores": corrected_scores,
            "corrected": True,
            "outliers": detection_result["outliers"],
            "corrected_count": len(detection_result["outliers"]),
            "message": f'检测到{len(detection_result["outliers"])}个离群值，已自动修正',
        }
