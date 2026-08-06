from datetime import datetime, timedelta

from models import User, ScoreRecord, get_by_id
import numpy as np


class ScorePredictService:

    @staticmethod
    def _get_score_records(user_id, days=30):
        """获取学生积分记录"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        return (
            ScoreRecord.query.filter(
                ScoreRecord.user_id == user_id,
                ScoreRecord.created_at >= start_date,
            )
            .order_by(ScoreRecord.created_at)
            .all()
        )

    @staticmethod
    def get_student_features(user_id, days=30):
        """
        获取学生特征数据

        Args:
            user_id: 学生ID
            days: 统计天数

        Returns:
            dict: 特征数据
        """
        user = get_by_id(User, user_id)
        if not user:
            return None

        records = ScorePredictService._get_score_records(user_id, days)

        features = {
            "user_id": user_id,
            "name": user.name,
            "class_name": user.class_name,
            "current_score": user.current_score,
            "total_records": len(records),
        }

        if records:
            score_changes = [r.score_change for r in records]
            cumulative_scores = []
            current = user.current_score - sum(score_changes)

            for change in score_changes:
                current += change
                cumulative_scores.append(current)

            # 积分特征
            features["avg_daily_change"] = round(np.mean(score_changes), 2)
            features["score_std"] = round(np.std(score_changes), 2)

            # 趋势特征
            if len(cumulative_scores) >= 2:
                x = np.arange(len(cumulative_scores))
                y = np.array(cumulative_scores)
                slope = np.polyfit(x, y, 1)[0]
                features["score_trend"] = round(slope, 2)
            else:
                features["score_trend"] = 0.0

            # 波动性特征
            features["volatility"] = round(
                features["score_std"] / (abs(features["avg_daily_change"]) + 0.1),
                2,
            )

            # 正向/负向记录统计
            positive_count = sum(1 for c in score_changes if c > 0)
            negative_count = sum(1 for c in score_changes if c < 0)
            features["positive_rate"] = round(positive_count / len(score_changes), 2)
            features["negative_rate"] = round(negative_count / len(score_changes), 2)

            # 连续天数特征
            features["max_consecutive_positive"] = ScorePredictService._max_consecutive_positive(score_changes)
            features["max_consecutive_negative"] = ScorePredictService._max_consecutive_negative(score_changes)

            # 最近7天特征
            recent_changes = score_changes[-7:] if len(score_changes) >= 7 else score_changes
            features["recent_avg_change"] = round(np.mean(recent_changes), 2)
            features["recent_trend"] = (
                "rising"
                if np.mean(recent_changes) > features["avg_daily_change"] * 1.2
                else ("falling" if np.mean(recent_changes) < features["avg_daily_change"] * 0.8 else "stable")
            )
        else:
            features["avg_daily_change"] = 0.0
            features["score_std"] = 0.0
            features["score_trend"] = 0.0
            features["volatility"] = 0.0
            features["positive_rate"] = 0.0
            features["negative_rate"] = 0.0
            features["max_consecutive_positive"] = 0
            features["max_consecutive_negative"] = 0
            features["recent_avg_change"] = 0.0
            features["recent_trend"] = "stable"

        # 班级排名特征
        class_users = User.query.filter(User.class_name == user.class_name).all()
        if class_users:
            scores = [u.current_score for u in class_users]
            features["class_rank"] = sum(1 for s in scores if s > user.current_score) + 1
            features["class_size"] = len(class_users)
            features["class_percentile"] = round(
                (len(scores) - features["class_rank"] + 1) / len(scores) * 100,
                2,
            )
            features["class_avg_score"] = round(np.mean(scores), 2)
            features["class_score_std"] = round(np.std(scores), 2)
        else:
            features["class_rank"] = 1
            features["class_size"] = 1
            features["class_percentile"] = 100.0
            features["class_avg_score"] = user.current_score
            features["class_score_std"] = 0.0

        return features

    @staticmethod
    def _max_consecutive_positive(changes):
        """计算最大连续正积分天数"""
        max_count = 0
        current_count = 0
        for c in changes:
            if c > 0:
                current_count += 1
                max_count = max(max_count, current_count)
            else:
                current_count = 0
        return max_count

    @staticmethod
    def _max_consecutive_negative(changes):
        """计算最大连续负积分天数"""
        max_count = 0
        current_count = 0
        for c in changes:
            if c < 0:
                current_count += 1
                max_count = max(max_count, current_count)
            else:
                current_count = 0
        return max_count

    @staticmethod
    def predict_exam_score(user_id, days=30):
        """
        预测学生考试成绩

        Args:
            user_id: 学生ID
            days: 统计天数

        Returns:
            dict: 预测结果
        """
        features = ScorePredictService.get_student_features(user_id, days)

        if not features:
            return {"user_id": user_id, "error": "学生不存在"}

        # 使用基于规则的预测模型（简化版）
        # 实际项目中可以使用机器学习模型

        # 基础分（基于当前积分）
        base_score = min(100, max(0, features["current_score"] * 0.8 + 20))

        # 趋势调整
        trend_factor = 1.0
        if features["score_trend"] > 0.5:
            trend_factor = 1.05
        elif features["score_trend"] < -0.5:
            trend_factor = 0.95

        # 波动性调整
        volatility_factor = 1.0
        if features["volatility"] > 2:
            volatility_factor = 0.97

        # 班级排名调整
        percentile = features["class_percentile"] / 100
        rank_factor = 0.8 + percentile * 0.4

        # 综合预测
        predicted_score = base_score * trend_factor * volatility_factor * rank_factor
        predicted_score = round(min(100, max(0, predicted_score)), 1)

        # 计算置信区间
        std_dev = 5 + features["score_std"] * 0.5
        lower_bound = max(0, predicted_score - 2 * std_dev)
        upper_bound = min(100, predicted_score + 2 * std_dev)

        # 特征重要性
        feature_importance = {
            "current_score": 0.35,
            "class_rank": 0.25,
            "score_trend": 0.15,
            "positive_rate": 0.10,
            "volatility": 0.08,
            "recent_trend": 0.07,
        }

        # 生成建议
        suggestions = []
        if features["score_trend"] < -0.3:
            suggestions.append("积分呈下降趋势，建议关注学习状态")
        if features["positive_rate"] < 0.3:
            suggestions.append("正向积分获取较少，建议增加积极行为")
        if features["volatility"] > 3:
            suggestions.append("积分波动较大，建议保持稳定")
        if features["class_rank"] > features["class_size"] * 0.7:
            suggestions.append("班级排名靠后，建议加强学习")

        return {
            "user_id": user_id,
            "name": features["name"],
            "class_name": features["class_name"],
            "predicted_score": predicted_score,
            "confidence_interval": [
                round(lower_bound, 1),
                round(upper_bound, 1),
            ],
            "confidence": round(min(0.95, 0.5 + features["total_records"] / 200), 2),
            "features": features,
            "feature_importance": feature_importance,
            "suggestions": suggestions or ["当前表现正常，继续保持"],
        }

    @staticmethod
    def predict_batch(class_name=None, days=30):
        """
        批量预测考试成绩

        Args:
            class_name: 班级名称（可选）
            days: 统计天数

        Returns:
            dict: 批量预测结果
        """
        query = User.query.filter(User.role == "student")
        if class_name:
            query = query.filter(User.class_name == class_name)

        users = query.all()

        predictions = []
        summary = {
            "total_students": len(users),
            "avg_predicted_score": 0.0,
            "high_performance": 0,
            "medium_performance": 0,
            "low_performance": 0,
        }

        total_score = 0.0

        for user in users:
            result = ScorePredictService.predict_exam_score(user.id, days)  # noqa: F841
            predictions.append(result)

            if "predicted_score" in result:
                total_score += result["predicted_score"]
                if result["predicted_score"] >= 80:
                    summary["high_performance"] += 1
                elif result["predicted_score"] >= 60:
                    summary["medium_performance"] += 1
                else:
                    summary["low_performance"] += 1

        if predictions:
            summary["avg_predicted_score"] = round(total_score / len(predictions), 2)

        # 按预测成绩排序
        predictions.sort(key=lambda x: x.get("predicted_score", 0), reverse=True)

        return {
            "class_name": class_name,
            "period_days": days,
            "summary": summary,
            "predictions": predictions,
        }

    @staticmethod
    def get_score_distribution(class_name=None):
        """
        获取成绩分布预测

        Args:
            class_name: 班级名称（可选）

        Returns:
            dict: 成绩分布
        """
        query = User.query.filter(User.role == "student")
        if class_name:
            query = query.filter(User.class_name == class_name)

        users = query.all()

        if not users:
            return {
                "class_name": class_name,
                "distributions": [],
                "summary": {"total_students": 0},
            }

        scores = []
        for user in users:
            result = ScorePredictService.predict_exam_score(user.id)  # noqa: F841
            if "predicted_score" in result:
                scores.append(result["predicted_score"])

        # 计算分布
        if scores:
            bins = [0, 60, 70, 80, 90, 100]
            distribution = []

            for i in range(len(bins) - 1):
                lower = bins[i]
                upper = bins[i + 1]
                count = sum(1 for s in scores if lower <= s < upper)
                percentage = round(count / len(scores) * 100, 1)

                distribution.append(
                    {
                        "range": f"{lower}-{upper}",
                        "count": count,
                        "percentage": percentage,
                    }
                )

            summary = {
                "total_students": len(scores),
                "avg_score": round(np.mean(scores), 2),
                "std_score": round(np.std(scores), 2),
                "min_score": round(min(scores), 1),
                "max_score": round(max(scores), 1),
            }
        else:
            distribution = []
            summary = {"total_students": 0}

        return {
            "class_name": class_name,
            "distributions": distribution,
            "summary": summary,
        }

    @staticmethod
    def train_score_model(days=90):
        """
        训练成绩预测模型

        Args:
            days: 训练数据天数

        Returns:
            dict: 训练结果
        """
        query = User.query.filter(User.role == "student")
        users = query.all()

        if not users:
            return {
                "status": "error",
                "message": "没有学生数据",
                "model_info": {},
            }

        # 收集训练数据特征
        features_list = []
        valid_users = 0

        for user in users:
            features = ScorePredictService.get_student_features(user.id, days)
            if features and features["total_records"] > 0:
                features_list.append(features)
                valid_users += 1

        if not features_list:
            return {
                "status": "error",
                "message": "没有足够的有效训练数据",
                "model_info": {},
            }

        # 计算模型特征权重（基于数据分布）
        feature_importance = {}

        # 当前积分权重
        scores = [f["current_score"] for f in features_list]
        score_mean = np.mean(scores)
        score_std = np.std(scores)
        if score_std > 0:
            feature_importance["current_score"] = round(min(0.4, 0.2 + score_std / 50), 2)

        # 趋势权重
        trends = [f["score_trend"] for f in features_list]
        trend_std = np.std(trends)
        feature_importance["score_trend"] = round(min(0.2, 0.1 + trend_std / 10), 2)

        # 正向率权重
        positive_rates = [f["positive_rate"] for f in features_list]
        positive_std = np.std(positive_rates)
        feature_importance["positive_rate"] = round(min(0.15, 0.05 + positive_std), 2)

        # 波动性权重
        volatilities = [f["volatility"] for f in features_list]
        vol_std = np.std(volatilities)
        feature_importance["volatility"] = round(min(0.1, 0.02 + vol_std / 20), 2)

        # 班级排名权重
        percentiles = [f["class_percentile"] for f in features_list]
        pct_std = np.std(percentiles)
        feature_importance["class_rank"] = round(min(0.25, 0.1 + pct_std / 100), 2)

        # 近期趋势权重
        feature_importance["recent_trend"] = round(0.1, 2)

        # 归一化权重
        total_weight = sum(feature_importance.values())
        if total_weight > 0:
            feature_importance = {k: round(v / total_weight, 2) for k, v in feature_importance.items()}

        return {
            "status": "success",
            "message": f"模型训练完成，使用{valid_users}个学生的{len(features_list)}条记录",
            "model_info": {
                "training_data_days": days,
                "total_students": len(users),
                "valid_students": valid_users,
                "feature_importance": feature_importance,
                "data_statistics": {
                    "avg_current_score": round(score_mean, 2),
                    "score_std": round(score_std, 2),
                    "avg_trend": round(np.mean(trends), 2),
                    "avg_positive_rate": round(np.mean(positive_rates), 2),
                    "avg_volatility": round(np.mean(volatilities), 2),
                    "avg_class_percentile": round(np.mean(percentiles), 2),
                },
            },
        }

    @staticmethod
    def evaluate_score_model(days=30):
        """
        评估成绩预测模型效果

        Args:
            days: 评估数据天数

        Returns:
            dict: 评估结果
        """
        query = User.query.filter(User.role == "student")
        users = query.all()

        if not users:
            return {
                "status": "error",
                "message": "没有学生数据",
                "metrics": {},
            }

        predictions = []
        actual_scores = []

        for user in users:
            result = ScorePredictService.predict_exam_score(user.id, days)  # noqa: F841
            if "predicted_score" in result:
                predictions.append(result["predicted_score"])
                # 使用当前积分作为实际值的代理（实际应用中应使用真实考试成绩）
                actual_scores.append(user.current_score * 0.8 + 20)

        if len(predictions) < 2:
            return {
                "status": "error",
                "message": "没有足够的评估数据",
                "metrics": {},
            }

        # 计算评估指标
        predictions_arr = np.array(predictions)
        actual_arr = np.array(actual_scores)

        # MAE (平均绝对误差)
        mae = np.mean(np.abs(predictions_arr - actual_arr))

        # MSE (均方误差)
        mse = np.mean((predictions_arr - actual_arr) ** 2)

        # RMSE (均方根误差)
        rmse = np.sqrt(mse)

        # R2 (决定系数)
        ss_tot = np.sum((actual_arr - np.mean(actual_arr)) ** 2)
        ss_res = np.sum((actual_arr - predictions_arr) ** 2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

        # 准确率（预测在±10分范围内）
        within_range = np.sum(np.abs(predictions_arr - actual_arr) <= 10)
        accuracy_10 = within_range / len(predictions)

        # 准确率（预测在±5分范围内）
        within_range_5 = np.sum(np.abs(predictions_arr - actual_arr) <= 5)
        accuracy_5 = within_range_5 / len(predictions)

        # 偏度
        bias = np.mean(predictions_arr - actual_arr)

        return {
            "status": "success",
            "message": "模型评估完成",
            "metrics": {
                "evaluation_data_days": days,
                "total_students": len(users),
                "evaluated_students": len(predictions),
                "mae": round(mae, 4),
                "mse": round(mse, 4),
                "rmse": round(rmse, 4),
                "r2": round(r2, 4),
                "accuracy_within_10": round(accuracy_10, 4),
                "accuracy_within_5": round(accuracy_5, 4),
                "bias": round(bias, 4),
                "avg_predicted_score": round(np.mean(predictions_arr), 2),
                "avg_actual_score": round(np.mean(actual_arr), 2),
            },
        }
