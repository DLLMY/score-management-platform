"""融合与解释：动态加权融合 + SHAP/重要性预测解释。"""

import numpy as np

from services.nlp_ml._shared import SHAP_INSTALLED, shap
from services.nlp_ml._types import MLAlgorithmType
from utils.logger import log_warning


class _FusionMixin:
    def _dynamic_weighted_fusion(self, predictions, confidence_threshold=0.6):
        rule_confidences = {}
        for pred in predictions:
            rule_id = pred["rule_id"]
            confidence = pred["confidence"]
            algorithm = pred["algorithm"]
            algorithm_weights = {
                MLAlgorithmType.XGBOOST: 1.5,
                MLAlgorithmType.LIGHTGBM: 1.4,
                MLAlgorithmType.CATBOOST: 1.4,
                MLAlgorithmType.STACKING: 1.6,
                MLAlgorithmType.VOTING: 1.3,
                MLAlgorithmType.RANDOM_FOREST: 1.0,
                MLAlgorithmType.EXTRA_TREES: 1.0,
                MLAlgorithmType.GRADIENT_BOOSTING: 1.1,
                MLAlgorithmType.LOGISTIC_REGRESSION: 0.9,
                MLAlgorithmType.MLP: 1.2,
                MLAlgorithmType.SVM: 1.0,
                MLAlgorithmType.KNN: 0.8,
            }
            weight = algorithm_weights.get(algorithm, 1.0)
            if confidence >= confidence_threshold:
                weight *= 1.3
            if rule_id not in rule_confidences:
                rule_confidences[rule_id] = {
                    "total_weight": 0,
                    "total_confidence": 0,
                    "votes": 0,
                }
            rule_confidences[rule_id]["total_weight"] += weight
            rule_confidences[rule_id]["total_confidence"] += confidence * weight
            rule_confidences[rule_id]["votes"] += 1
        if not rule_confidences:
            return None
        weighted_results = []
        for rule_id, data in rule_confidences.items():
            avg_confidence = (
                data["total_confidence"] / data["total_weight"] if data["total_weight"] > 0 else 0
            )
            weighted_score = avg_confidence * (data["votes"] / len(predictions))
            weighted_results.append((rule_id, weighted_score, data["votes"], avg_confidence))
        weighted_results.sort(key=lambda x: x[1], reverse=True)
        best_rule_id = weighted_results[0][0]
        best_score = weighted_results[0][1]
        return {
            "rule_id": best_rule_id,
            "confidence": round(best_score, 4),
            "algorithm": "dynamic_weighted",
            "fusion_details": [
                {
                    "rule_id": r[0],
                    "weighted_score": round(r[1], 4),
                    "voting_count": r[2],
                    "avg_confidence": round(r[3], 4),
                }
                for r in weighted_results
            ],
        }

    def _explain_prediction(self, model, vectorizer, text, top_n=5):
        if not SHAP_INSTALLED:
            return None
        try:
            X = vectorizer.transform([text])
            if hasattr(model, "estimator"):
                inner_model = model.estimator if hasattr(model, "estimator") else model
            else:
                inner_model = model
            explainer = (
                shap.TreeExplainer(inner_model)
                if hasattr(inner_model, "tree_")
                else shap.KernelExplainer(inner_model.predict_proba, X)
            )
            shap_values = explainer.shap_values(X)
            feature_names = vectorizer.get_feature_names_out()
            top_features = []
            if isinstance(shap_values, list):
                shap_values = shap_values[0]
            feature_importance = np.abs(shap_values[0]).argsort()[::-1][:top_n]
            for idx in feature_importance:
                if idx < len(feature_names):
                    top_features.append(
                        {
                            "feature": feature_names[idx],
                            "importance": round(float(np.abs(shap_values[0][idx])), 4),
                            "direction": ("positive" if shap_values[0][idx] > 0 else "negative"),
                        }
                    )
            return {
                "top_features": top_features,
                "shap_summary": {
                    "mean_abs_shap_value": round(float(np.mean(np.abs(shap_values))), 4),
                    "max_shap_value": round(float(np.max(shap_values)), 4),
                    "min_shap_value": round(float(np.min(shap_values)), 4),
                },
            }
        except Exception as e:
            log_warning(f"[NLPML] 解释预测失败: {e}", exception=e)
            return {"error": str(e)}

    def _get_feature_importance(self, model, vectorizer, top_n=10):
        try:
            feature_names = vectorizer.get_feature_names_out()
            if hasattr(model, "feature_importances_"):
                importances = model.feature_importances_
            elif hasattr(model, "coef_"):
                importances = np.mean(np.abs(model.coef_), axis=0)
            elif hasattr(model, "estimator") and hasattr(model.estimator, "feature_importances_"):
                importances = model.estimator.feature_importances_
            else:
                return []
            indices = importances.argsort()[::-1][:top_n]
            return [
                {
                    "feature": (
                        feature_names[idx] if idx < len(feature_names) else f"feature_{idx}"
                    ),
                    "importance": round(float(importances[idx]), 6),
                    "rank": i + 1,
                }
                for i, idx in enumerate(indices)
            ]
        except Exception as e:
            log_warning(f"[NLPML] 获取特征重要性失败: {e}", exception=e)
            return []
