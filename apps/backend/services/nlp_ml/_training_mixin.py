"""训练数据与训练生命周期：数据准备/样本收集/文本增强/超参优化/训练/评估/交叉验证/持久化。"""

import os
import pickle
import random
from datetime import datetime

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import (
    GridSearchCV,
    RandomizedSearchCV,
    StratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler, RobustScaler, StandardScaler

from models import NLPMatchResult, NLPModelTraining, NLPScoringRule, db
from services.nlp_ml._shared import MODEL_DIR
from services.nlp_ml._types import HyperparameterConfig, MLAlgorithmType


class _TrainingMixin:
    def _prepare_training_data(self):
        rules = NLPScoringRule.query.filter(NLPScoringRule.is_active).all()
        if not rules:
            return None, None, None
        match_results = NLPMatchResult.query.all()
        if not match_results:
            return None, None, None
        texts = []
        labels = []
        rule_id_map = {rule.id: rule for rule in rules}
        for result in match_results:
            if result.input_text and result.matched_rule_id:
                texts.append(result.input_text)
                labels.append(result.matched_rule_id)
        if not texts:
            return None, None, None
        return texts, labels, rule_id_map

    def _prepare_enhanced_training_data(self):
        rules = NLPScoringRule.query.filter(NLPScoringRule.is_active).all()
        if not rules:
            return None, None, None
        texts = []
        labels = []
        rule_id_map = {rule.id: rule for rule in rules}
        match_results = NLPMatchResult.query.all()
        self._collect_match_result_samples(match_results, texts, labels)
        self._collect_rule_samples(rules, texts, labels)
        augmented_texts, augmented_labels = self._apply_text_augmentation(texts, labels)
        texts = augmented_texts
        labels = augmented_labels
        if not texts:
            return None, None, None
        return texts, labels, rule_id_map

    @staticmethod
    def _collect_match_result_samples(match_results, texts, labels):
        for result in match_results:
            if result.input_text and result.matched_rule_id:
                texts.append(result.input_text)
                labels.append(result.matched_rule_id)
                if result.behavior_description:
                    texts.append(result.behavior_description)
                    labels.append(result.matched_rule_id)

    def _collect_rule_samples(self, rules, texts, labels):
        for rule in rules:
            if rule.behavior_description:
                texts.append(rule.behavior_description)
                labels.append(rule.id)
                for variant in self._generate_text_variants(rule.behavior_description):
                    texts.append(variant)
                    labels.append(rule.id)
            if rule.match_pattern:
                for pattern in rule.match_pattern.split("|"):
                    texts.append(pattern.strip())
                    labels.append(rule.id)
            if rule.behavior_keyword:
                texts.append(rule.behavior_keyword)
                labels.append(rule.id)
                if rule.behavior_tags:
                    for tag in rule.behavior_tags:
                        texts.append(f"{rule.behavior_keyword} {tag}")
                        labels.append(rule.id)
                        texts.append(f"{tag} {rule.behavior_keyword}")
                        labels.append(rule.id)

    def _generate_text_variants(self, text):
        variants = []
        prefixes = ["同学", "学生", "今天", "上课", "在", ""]
        suffixes = ["表现", "行为", "作业", "情况", "记录", ""]
        for prefix in prefixes:
            for suffix in suffixes:
                if prefix or suffix:
                    variants.append(f"{prefix}{text}{suffix}")
        return variants

    def _apply_text_augmentation(self, texts, labels):
        augmented_texts = []
        augmented_labels = []
        for i, text in enumerate(texts):
            augmented_texts.append(text)
            augmented_labels.append(labels[i])
            augmented_texts.append(text + " 的行为")
            augmented_labels.append(labels[i])
            augmented_texts.append("记录 " + text)
            augmented_labels.append(labels[i])
            augmented_texts.append(text + " 表现良好")
            augmented_labels.append(labels[i])
            if len(text) > 4:
                chars = list(text)
                idx1, idx2 = random.sample(range(len(chars)), 2)
                chars[idx1], chars[idx2] = chars[idx2], chars[idx1]
                augmented_texts.append("".join(chars))
                augmented_labels.append(labels[i])
        return augmented_texts, augmented_labels

    def _optimize_hyperparameters(self, algorithm, X, y, method="random", n_iter=20):
        params = HyperparameterConfig.get_params(algorithm)
        if not params:
            return self.models[algorithm], {}
        base_model = self.models[algorithm]
        if method == "grid":
            search = GridSearchCV(
                base_model,
                params,
                cv=3,
                scoring="f1_weighted",
                n_jobs=-1,
                verbose=1,
            )
        else:
            search = RandomizedSearchCV(
                base_model,
                params,
                n_iter=n_iter,
                cv=3,
                scoring="f1_weighted",
                n_jobs=-1,
                verbose=1,
                random_state=42,
            )
        search.fit(X, y)
        return search.best_estimator_, {
            "best_params": search.best_params_,
            "best_score": round(search.best_score_, 4),
            "method": method,
            "n_iter": n_iter if method == "random" else None,
        }

    def _train_model(
        self,
        algorithm,
        X_train,
        y_train,
        use_hyperparameter_tuning=False,
        tuning_method="random",
    ):
        if algorithm == MLAlgorithmType.VOTING:
            model = self._get_voting_model()
        elif algorithm == MLAlgorithmType.STACKING:
            model = self._get_stacking_model()
        elif algorithm not in self.models:
            raise ValueError(f"未知算法: {algorithm}")
        else:
            model = self.models[algorithm]
        if use_hyperparameter_tuning and algorithm not in [
            MLAlgorithmType.VOTING,
            MLAlgorithmType.STACKING,
        ]:
            model, tuning_info = self._optimize_hyperparameters(
                algorithm, X_train, y_train, tuning_method
            )
        else:
            tuning_info = {}
        if algorithm == MLAlgorithmType.MLP:
            scaler = StandardScaler(with_mean=False)
            X_train_scaled = scaler.fit_transform(X_train)
            model.fit(X_train_scaled, y_train)
            return (
                Pipeline([("scaler", scaler), ("classifier", model)]),
                tuning_info,
            )
        model.fit(X_train, y_train)
        return model, tuning_info

    def _evaluate_model(self, model, X_test, y_test):
        y_pred = model.predict(X_test)
        y_test_str = np.array([str(y) for y in y_test])
        y_pred_str = np.array([str(y) for y in y_pred])
        accuracy = accuracy_score(y_test_str, y_pred_str)
        precision = precision_score(y_test_str, y_pred_str, average="weighted", zero_division=0)
        recall = recall_score(y_test_str, y_pred_str, average="weighted", zero_division=0)
        f1 = f1_score(y_test_str, y_pred_str, average="weighted", zero_division=0)
        return {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
        }

    def _cross_validate(self, algorithm, X, y, cv=5):
        if algorithm == MLAlgorithmType.VOTING:
            model = self._get_voting_model()
        elif algorithm == MLAlgorithmType.STACKING:
            model = self._get_stacking_model()
        elif algorithm not in self.models:
            raise ValueError(f"未知算法: {algorithm}")
        else:
            model = self.models[algorithm]
        scores = cross_val_score(model, X, y, cv=cv, scoring="f1_weighted", n_jobs=-1)
        return {
            "mean_f1": round(scores.mean(), 4),
            "std_f1": round(scores.std(), 4),
            "min_f1": round(scores.min(), 4),
            "max_f1": round(scores.max(), 4),
        }

    def _save_model(self, algorithm, model, vectorizer):
        model_path = os.path.join(MODEL_DIR, f"nlp_{algorithm}_model.pkl")
        vectorizer_path = os.path.join(MODEL_DIR, "nlp_vectorizer.pkl")
        with open(model_path, "wb") as f:
            pickle.dump(model, f)
        if vectorizer is not None:
            with open(vectorizer_path, "wb") as f:
                pickle.dump(vectorizer, f)
        return model_path

    def _load_model(self, algorithm):
        model_path = os.path.join(MODEL_DIR, f"nlp_{algorithm}_model.pkl")
        vectorizer_path = os.path.join(MODEL_DIR, "nlp_vectorizer.pkl")
        if not os.path.exists(model_path):
            return None, None
        with open(model_path, "rb") as f:
            model = pickle.load(f)  # nosec B301 - trusted internal model
        vectorizer = None
        if os.path.exists(vectorizer_path):
            with open(vectorizer_path, "rb") as f:
                vectorizer = pickle.load(f)  # nosec B301 - trusted internal model
        return model, vectorizer

    def _train_without_data(self, algorithm, trained_by):
        # P2-2 修复: 无训练数据不再伪造 accuracy=0.85/completed，标记 untrained 且指标归零
        training_record = NLPModelTraining(
            model_name=f'{algorithm}_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
            algorithm_type=algorithm,
            training_data_size=0,
            accuracy=0.0,
            f1_score=0.0,
            status="untrained",
            trained_at=datetime.now(),
        )
        db.session.add(training_record)
        db.session.commit()
        return {
            "success": True,
            "algorithm": algorithm,
            "algorithm_name": MLAlgorithmType.get_name(algorithm),
            "training_data_count": 0,
            "evaluation": {
                "accuracy": 0.0,
                "precision": 0.0,
                "recall": 0.0,
                "f1_score": 0.0,
            },
            "message": "无训练数据，模型未训练（标记 untrained）",
        }
