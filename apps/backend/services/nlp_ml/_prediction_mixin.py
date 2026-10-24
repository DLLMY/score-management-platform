"""预测与评估：单模型/多模型/集成预测 + 全算法评估 + 解释输出。"""

import os
import time

from models import NLPMatchResult, NLPModelTraining, NLPScoringRule, db
from services.nlp_ml._types import MLAlgorithmType
from utils.logger import log_warning


class _PredictionMixin:
    def predict(self, text, algorithm=None):
        if algorithm is None:
            algorithm = self._get_best_algorithm()
        model, vectorizer = self._load_model(algorithm)
        if model is None or vectorizer is None:
            return None
        X = vectorizer.transform([text])
        try:
            rule_id = model.predict(X)[0]
            if hasattr(model, "predict_proba"):
                confidence = model.predict_proba(X)[0].max()
            else:
                confidence = 0.5
        except Exception as e:
            log_warning(f"[NLPML] 预测失败: {e}", exception=e)
            return None
        return {
            "rule_id": rule_id,
            "confidence": round(confidence, 4),
            "algorithm": algorithm,
        }

    def predict_with_multiple_models(self, text, top_n=3):
        results = []
        for algorithm in MLAlgorithmType.all():
            if not MLAlgorithmType.is_available(algorithm):
                continue
            try:
                model, vectorizer = self._load_model(algorithm)
                if model is None or vectorizer is None:
                    continue
                X = vectorizer.transform([text])
                rule_id = model.predict(X)[0]
                if hasattr(model, "predict_proba"):
                    confidence = model.predict_proba(X)[0].max()
                else:
                    confidence = 0.5
                results.append(
                    {
                        "algorithm": algorithm,
                        "algorithm_name": MLAlgorithmType.get_name(algorithm),
                        "rule_id": rule_id,
                        "confidence": round(confidence, 4),
                    }
                )
            except Exception as e:
                log_warning(f"[NLPML] 多模型预测单模型失败: {e}", exception=e)
                continue
        results.sort(key=lambda x: x["confidence"], reverse=True)
        return results[:top_n]

    def ensemble_predict(self, text):
        predictions = self.predict_with_multiple_models(text, top_n=5)
        if not predictions:
            return None
        rule_counts = {}
        total_confidence = {}
        for pred in predictions:
            rule_id = pred["rule_id"]
            confidence = pred["confidence"]
            rule_counts[rule_id] = rule_counts.get(rule_id, 0) + 1
            total_confidence[rule_id] = total_confidence.get(rule_id, 0) + confidence
        weighted_results = []
        for rule_id, count in rule_counts.items():
            avg_confidence = total_confidence[rule_id] / count
            weighted_score = avg_confidence * (count / len(predictions))
            weighted_results.append((rule_id, weighted_score, count, avg_confidence))
        weighted_results.sort(key=lambda x: x[1], reverse=True)
        best_rule_id = weighted_results[0][0]
        best_score = weighted_results[0][1]
        return {
            "rule_id": best_rule_id,
            "confidence": round(best_score, 4),
            "algorithm": "ensemble",
            "ensemble_details": [
                {
                    "rule_id": r[0],
                    "weighted_score": round(r[1], 4),
                    "voting_count": r[2],
                    "avg_confidence": round(r[3], 4),
                }
                for r in weighted_results
            ],
        }

    def _get_best_algorithm(self):
        latest_record = (
            NLPModelTraining.query.filter(NLPModelTraining.status == "completed")
            .order_by(NLPModelTraining.created_at.desc())
            .first()
        )
        if latest_record and latest_record.algorithm_type:
            if latest_record.algorithm_type.startswith("auto_"):
                return latest_record.algorithm_type[5:]
            return latest_record.algorithm_type
        return MLAlgorithmType.LOGISTIC_REGRESSION

    def get_available_algorithms(self):
        return [
            {
                "value": algo,
                "label": MLAlgorithmType.get_name(algo),
                "available": MLAlgorithmType.is_available(algo),
            }
            for algo in MLAlgorithmType.all()
        ]

    def evaluate_all(self):
        """评估所有算法性能（优化版：仅查询数据库记录）"""
        start_time = time.time()
        results = []
        # 直接从数据库获取训练记录，不加载模型
        for algorithm in MLAlgorithmType.all():
            try:
                if not MLAlgorithmType.is_available(algorithm):
                    results.append(
                        {
                            "algorithm": algorithm,
                            "algorithm_name": MLAlgorithmType.get_name(algorithm),
                            "error": "算法依赖未安装",
                            "evaluation": {"accuracy": 0.0},
                        }
                    )
                    continue
                # 从数据库获取最近的训练记录
                latest_training = (
                    NLPModelTraining.query.filter(
                        NLPModelTraining.algorithm_type == algorithm,
                        NLPModelTraining.status == "completed",
                    )
                    .order_by(NLPModelTraining.created_at.desc())
                    .first()
                )
                if latest_training:
                    results.append(
                        {
                            "algorithm": algorithm,
                            "algorithm_name": MLAlgorithmType.get_name(algorithm),
                            "evaluation": {
                                "accuracy": latest_training.accuracy_after or 0.0,
                                "precision": latest_training.precision or 0.0,
                                "recall": latest_training.recall or 0.0,
                                "f1_score": latest_training.f1_score or 0.0,
                            },
                            "training_data_count": (latest_training.training_data_count),
                            "training_version": (latest_training.training_version),
                        }
                    )
                else:
                    # 检查模型文件是否存在
                    model_path = os.path.join(
                        os.path.dirname(os.path.dirname(__file__)),
                        "models",
                        "trained",
                        f"nlp_{algorithm}_model.pkl",
                    )
                    if os.path.exists(model_path):
                        results.append(
                            {
                                "algorithm": algorithm,
                                "algorithm_name": MLAlgorithmType.get_name(algorithm),
                                "evaluation": {"accuracy": 0.0},
                                "error": "模型已训练但无记录",
                            }
                        )
                    else:
                        results.append(
                            {
                                "algorithm": algorithm,
                                "algorithm_name": MLAlgorithmType.get_name(algorithm),
                                "evaluation": {"accuracy": 0.0},
                                "error": "模型未训练",
                            }
                        )
            except Exception as e:
                log_warning(f"[NLPML] 评估算法失败 {algorithm}: {e}", exception=e)
                results.append(
                    {
                        "algorithm": algorithm,
                        "algorithm_name": MLAlgorithmType.get_name(algorithm),
                        "error": str(e)[:100],
                    }
                )
        elapsed_time = time.time() - start_time
        return {
            "success": True,
            "results": results,
            "elapsed_time": round(elapsed_time, 2),
        }

    def dynamic_weighted_predict(self, text):
        predictions = self.predict_with_multiple_models(text, top_n=8)
        if not predictions:
            return None
        return self._dynamic_weighted_fusion(predictions)

    def predict_with_explanation(self, text, algorithm=None):
        if algorithm is None:
            algorithm = self._get_best_algorithm()
        model, vectorizer = self._load_model(algorithm)
        if model is None or vectorizer is None:
            return None
        X = vectorizer.transform([text])
        try:
            rule_id = model.predict(X)[0]
            if hasattr(model, "predict_proba"):
                confidence = model.predict_proba(X)[0].max()
            else:
                confidence = 0.5
            explanation = self._explain_prediction(model, vectorizer, text)
            feature_importance = self._get_feature_importance(model, vectorizer)
        except Exception as e:
            log_warning(f"[NLPML] 带解释预测失败: {e}", exception=e)
            return None
        return {
            "rule_id": rule_id,
            "confidence": round(confidence, 4),
            "algorithm": algorithm,
            "explanation": explanation,
            "feature_importance": feature_importance,
        }

    def get_model_explanation(self, algorithm=None):
        if algorithm is None:
            algorithm = self._get_best_algorithm()
        model, vectorizer = self._load_model(algorithm)
        if model is None or vectorizer is None:
            return {"success": False, "message": "模型未加载"}
        feature_importance = self._get_feature_importance(model, vectorizer, top_n=20)
        return {
            "success": True,
            "algorithm": algorithm,
            "algorithm_name": MLAlgorithmType.get_name(algorithm),
            "feature_importance": feature_importance,
            "model_type": type(model).__name__,
        }
