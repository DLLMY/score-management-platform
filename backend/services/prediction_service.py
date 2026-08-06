from datetime import datetime, timedelta
from models import User, ScoreRecord
from services.redis_cache_service import get_cache_service
import numpy as np

# (空行)
# 学生行为预测服务模块
# 基于历史积分数据预测学生未来积分变化趋势
# (空行)
CACHE_PREFIX = "prediction:"


class PredictionService:
    """学生行为预测服务类"""

    @staticmethod
    def get_student_score_history(user_id, days=30):
        """
        获取学生积分历史数据
        Args:
            user_id: 学生ID
            days: 历史天数，默认30天
        Returns:
            list: 积分变化记录列表
        """
        start_date = datetime.now() - timedelta(days=days)
        records = (
            ScoreRecord.query.filter(ScoreRecord.user_id == user_id, ScoreRecord.created_at >= start_date)
            .order_by(ScoreRecord.created_at.asc())
            .all()
        )
        history = []
        cumulative_score = 0
        for record in records:
            cumulative_score += record.score_change
            history.append(
                {
                    "date": record.created_at.isoformat(),
                    "score_change": record.score_change,
                    "cumulative_score": cumulative_score,
                    "rule_name": record.rule_name if hasattr(record, "rule_name") else None,
                }
            )  # noqa: E501
        return history

    @staticmethod
    def calculate_trend(scores):
        """
        计算积分趋势
        Args:
            scores: 积分列表
        Returns:
            dict: 趋势信息
        """
        if len(scores) < 2:
            return {"direction": "stable", "slope": 0.0, "change_rate": 0.0}
        x = np.arange(len(scores))
        y = np.array(scores)
        n = len(scores)
        slope = (n * np.sum(x * y) - np.sum(x) * np.sum(y)) / (n * np.sum(x * x) - np.sum(x) ** 2)
        intercept = (np.sum(y) - slope * np.sum(x)) / n
        first_half = np.mean(scores[: len(scores) // 2]) if len(scores) > 2 else np.mean(scores)
        second_half = np.mean(scores[len(scores) // 2 :]) if len(scores) > 2 else scores[-1]
        if first_half != 0:
            change_rate = (second_half - first_half) / abs(first_half)
        else:
            change_rate = 0.0
        if abs(slope) < 0.1:
            direction = "stable"
        elif slope > 0:
            direction = "rising"
        else:
            direction = "falling"
        return {
            "direction": direction,
            "slope": round(float(slope), 3),
            "change_rate": round(float(change_rate), 3),
            "intercept": round(float(intercept), 2),
        }

    @staticmethod
    def predict_future_scores(user_id, days=7):
        """
        预测未来积分变化
        Args:
            user_id: 学生ID
            days: 预测天数
        Returns:
            dict: 预测结果
        """
        history = PredictionService.get_student_score_history(user_id, days=30)
        if len(history) < 7:
            return {
                "user_id": user_id,
                "current_score": 0,
                "predicted_scores": [],
                "trend": "insufficient_data",
                "confidence": 0.0,
                "message": "历史数据不足，无法进行预测",
            }
        score_changes = [h["score_change"] for h in history]
        cumulative_scores = [h["cumulative_score"] for h in history]
        current_score = cumulative_scores[-1] if cumulative_scores else 0
        # 趋势必须基于累计积分序列拟合：score_changes 是"每次变动量"，
        # 对其拟合得到的是变动量的加速度，而非积分本身的升降。
        # 例如连续每次扣 5 分（积分明显下滑）的增量序列斜率为 0，会被误判为 stable；
        # "先跌后稳"的净下滑学生甚至会被误判为 rising。
        # 与 RiskPredictService.get_risk_features 的口径保持一致。
        trend = PredictionService.calculate_trend(cumulative_scores)
        window = min(7, len(score_changes))
        avg_change = np.mean(score_changes[-window:])
        std_change = np.std(score_changes[-window:])
        # predicted_scores 保存的是"每一天的累计积分水平"，因此只能在上一天的
        # 水平上叠加当天衰减后的增量。原实现写成
        #     current_score + sum(predicted_scores) + predicted_change
        # 等于把历史累计水平又当作增量再加一遍，导致逐日翻倍（约 2^(n-1)）：
        # 预测 30 天时数值可膨胀到 1e10 量级，完全失去物理意义。
        predicted_scores = []
        predicted_cumulative = current_score
        for i in range(1, days + 1):
            decay = 0.9 ** (i / 7)
            predicted_cumulative += avg_change * decay
            predicted_scores.append(round(predicted_cumulative, 2))

        # 置信区间以预测区间中点的水平为中心，带宽按独立增量累加取 2σ√n。
        mid_idx = max(0, days // 2 - 1)
        center = predicted_scores[mid_idx] if predicted_scores else current_score
        half_width = 2 * std_change * np.sqrt(mid_idx + 1)
        confidence_interval = (
            round(center - half_width, 2),
            round(center + half_width, 2),
        )
        if len(history) >= 30:
            confidence = 0.85
        elif len(history) >= 14:
            confidence = 0.75
        elif len(history) >= 7:
            confidence = 0.65
        else:
            confidence = 0.5
        return {
            "user_id": user_id,
            "current_score": current_score,
            "predicted_scores": predicted_scores,
            "trend": trend["direction"],
            "slope": trend["slope"],
            "confidence": confidence,
            "confidence_interval": confidence_interval,
        }

    @staticmethod
    def predict_batch(class_name=None, days=7):
        """
        批量预测（按班级或全体）
        Args:
            class_name: 班级名称
            days: 预测天数
        Returns:
            dict: 批量预测结果
        """
        query = User.query.filter(User.is_active)
        if class_name:
            query = query.filter(User.class_name == class_name)
        users = query.all()
        results = {
            "total_students": len(users),
            "predictions": [],
            "summary": {"rising_count": 0, "stable_count": 0, "falling_count": 0},
        }
        for user in users:
            prediction = PredictionService.predict_future_scores(user.id, days)
            results["predictions"].append(
                {"user_id": user.id, "name": user.name, "class_name": user.class_name, "prediction": prediction}
            )
            if prediction["trend"] == "rising":
                results["summary"]["rising_count"] += 1
            elif prediction["trend"] == "stable":
                results["summary"]["stable_count"] += 1
            else:
                results["summary"]["falling_count"] += 1
        return results

    @staticmethod
    def get_risk_students(days=7, threshold=-5):
        """
        获取有下降风险的学生
        Args:
            days: 预测天数
            threshold: 预测下降阈值
        Returns:
            list: 风险学生列表
        """
        batch_result = PredictionService.predict_batch(days=days)
        risk_students = []
        for item in batch_result["predictions"]:
            prediction = item["prediction"]
            if prediction["trend"] == "falling" and prediction["slope"] < threshold:
                if prediction["predicted_scores"]:
                    predicted_change = prediction["predicted_scores"][-1] - prediction["current_score"]

                    # 以调用方给定的 threshold 作为风险基准线衡量严重度：
                    # severity = |slope| / |threshold|，因过滤条件所限必然 >= 1。
                    # 映射到与 RiskPredictService 一致的 0~1 分档（>=0.7 高，>=0.4 中）。
                    severity = abs(prediction["slope"]) / abs(threshold) if threshold else 1.0
                    risk_score = round(min(1.0, 0.7 * severity / 1.2), 2)
                    if risk_score >= 0.7:
                        risk_level = "high"
                    elif risk_score >= 0.4:
                        risk_level = "medium"
                    else:
                        risk_level = "low"

                    risk_students.append(
                        {
                            "user_id": item["user_id"],
                            "name": item["name"],
                            "class_name": item["class_name"],
                            "current_score": prediction["current_score"],
                            "predicted_change": predicted_change,
                            "risk_score": risk_score,
                            "risk_level": risk_level,
                            # 未来预测窗口内低于当前积分的天数
                            "warning_count": sum(
                                1 for s in prediction["predicted_scores"] if s < prediction["current_score"]
                            ),
                            "confidence": prediction.get("confidence", 0.0),
                        }
                    )
        risk_students.sort(key=lambda x: x["predicted_change"])
        return risk_students

    @staticmethod
    def get_prediction_cache(user_id, days=7):
        """
        获取缓存的预测结果
        Args:
            user_id: 学生ID
            days: 预测天数
        Returns:
            dict or None: 缓存的预测结果
        """
        cache = get_cache_service()
        if not cache:
            return None
        cache_key = f"{CACHE_PREFIX}predict:{user_id}:{days}"
        return cache.get(cache_key)

    @staticmethod
    def cache_prediction(user_id, days, prediction):
        """
        缓存预测结果
        Args:
            user_id: 学生ID
            days: 预测天数
            prediction: 预测结果
        """
        cache = get_cache_service()
        if not cache:
            return
        cache_key = f"{CACHE_PREFIX}predict:{user_id}:{days}"
        cache.set(cache_key, prediction, ttl=3600)

    @staticmethod
    def invalidate_prediction_cache(user_id):
        """
        清除预测缓存
        Args:
            user_id: 学生ID
        """
        cache = get_cache_service()
        if not cache:
            return
        for days in [7, 14, 30]:
            cache_key = f"{CACHE_PREFIX}predict:{user_id}:{days}"
            cache.delete(cache_key)
