"""编排入口：train/train_all/incremental_train/online_train + 偏差分析与详细交叉验证。"""

import json
from datetime import datetime

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
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

from models import NLPMatchResult, NLPModelTraining, NLPScoringRule, db
from services.nlp_ml._types import MLAlgorithmType
from utils.db_session import db_session_scope
from utils.logger import log_warning


class _OrchestrationMixin:
    def train(
        self,
        algorithm=None,
        trained_by=None,
        use_cross_validation=False,
        use_hyperparameter_tuning=False,
        tuning_method="random",
    ):
        if algorithm is None:
            return self.train_all(trained_by=trained_by)
        if not MLAlgorithmType.is_available(algorithm):
            return {
                "success": False,
                "message": f"未知或不可用算法: {algorithm}",
            }
        texts, labels, rule_id_map = self._prepare_enhanced_training_data()
        if texts is None:
            return self._train_without_data(algorithm, trained_by)
        # TextCNN和BERT需要原始文本输入，其他算法使用TF-IDF特征
        is_dl_model = algorithm in (
            MLAlgorithmType.TEXTCNN,
            MLAlgorithmType.BERT,
        )
        if is_dl_model:
            # 直接使用原始文本
            X = texts
            y = np.array(labels)
        else:
            self.vectorizer = TfidfVectorizer(
                max_features=3000,
                ngram_range=(1, 4),
                analyzer="char_wb",
                lowercase=False,
            )
            X = self.vectorizer.fit_transform(texts)
            y = labels
        num_classes = len(set(y))
        min_test_samples = max(num_classes, 10)
        test_size_ratio = min_test_samples / len(texts)
        if test_size_ratio > 0.5:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.5, random_state=42
            )
        elif len(texts) >= min_test_samples * 2:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size_ratio, random_state=42, stratify=y
            )
        else:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
        with db_session_scope(detach=False):
            training_record = NLPModelTraining(
                model_name=f'{algorithm}_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}',
                status="running",
                algorithm_type=algorithm,
                training_data_size=len(texts),
            )
            db.session.add(training_record)
        training_id = training_record.id  # detach=False：块退出不 remove，id 可安全读取
        model, tuning_info = self._train_model(
            algorithm,
            X_train,
            y_train,
            use_hyperparameter_tuning,
            tuning_method,
        )
        evaluation = self._evaluate_model(model, X_test, y_test)
        cv_results = {}
        if use_cross_validation and not is_dl_model:
            cv_results = self._cross_validate(algorithm, X, y)
        # TextCNN/BERT 直接保存自身，传入文本不需要 vectorizer
        if is_dl_model:
            self._save_model(algorithm, model, None)
        else:
            self._save_model(algorithm, model, self.vectorizer)
        # 此前直接改 training_record.status（对象已 detached）→ DB 永远停留 running。
        # 必须重新查询记录再更新才能落库。
        # 注意：不能在此处局部 `from models import NLPModelTraining`——函数内任何位置的
        # 局部 import 都会把 NLPModelTraining 变为整个函数作用域的局部变量，导致上方
        # 创建记录处 UnboundLocalError（#912 实机暴露）。模块顶部已 import，直接用。
        # detach=False：请求链/后台线程内由 app context teardown 统一清理 session，
        # 避免 db_session_scope 默认 detach=True 的 session.remove() 使对象 detached
        # 后访问属性触发 DetachedInstanceError（#912 实机暴露；TESTING 下因跳过 remove
        # 不触发，故单测未覆盖到）。
        with db_session_scope(detach=False):
            rec = db.session.get(NLPModelTraining, training_id)
            if rec is not None:
                rec.status = "completed"
                rec.trained_at = datetime.now()
                rec.accuracy = evaluation["accuracy"]
                rec.f1_score = evaluation["f1_score"]
        return {
            "success": True,
            "algorithm": algorithm,
            "algorithm_name": MLAlgorithmType.get_name(algorithm),
            "training_data_count": len(texts),
            "evaluation": evaluation,
            "cross_validation": cv_results,
            "hyperparameter_tuning": tuning_info,
            "model_saved": True,
            "message": f"{MLAlgorithmType.get_name(algorithm)} 模型训练完成",
        }

    def train_all(self, trained_by=None, use_cross_validation=True):
        texts, labels, rule_id_map = self._prepare_enhanced_training_data()
        if texts is None:
            return {"success": False, "message": "没有足够的训练数据"}
        self.vectorizer = TfidfVectorizer(
            max_features=3000,
            ngram_range=(1, 4),
            analyzer="char_wb",
            lowercase=False,
        )
        X = self.vectorizer.fit_transform(texts)
        y = labels
        num_classes = len(set(y))
        min_test_samples = max(num_classes, 10)
        test_size_ratio = min_test_samples / len(texts)
        if test_size_ratio > 0.5:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.5, random_state=42
            )
        elif len(texts) >= min_test_samples * 2:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size_ratio, random_state=42, stratify=y
            )
        else:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
        results = []
        best_algorithm = None
        best_f1 = 0.0
        best_model = None
        for algorithm in MLAlgorithmType.all():
            try:
                if not MLAlgorithmType.is_available(algorithm):
                    results.append(
                        {
                            "algorithm": algorithm,
                            "algorithm_name": MLAlgorithmType.get_name(algorithm),
                            "error": "算法依赖未安装",
                        }
                    )
                    continue
                model, tuning_info = self._train_model(algorithm, X_train, y_train)
                evaluation = self._evaluate_model(model, X_test, y_test)
                cv_results = self._cross_validate(algorithm, X, y)
                results.append(
                    {
                        "algorithm": algorithm,
                        "algorithm_name": MLAlgorithmType.get_name(algorithm),
                        "evaluation": evaluation,
                        "cross_validation": cv_results,
                        "hyperparameter_tuning": tuning_info,
                    }
                )
                if evaluation["f1_score"] > best_f1:
                    best_f1 = evaluation["f1_score"]
                    best_algorithm = algorithm
                    best_model = model
            except Exception as e:
                log_warning(f"[NLPML] 算法训练失败 {algorithm}: {e}", exception=e)
                results.append(
                    {
                        "algorithm": algorithm,
                        "algorithm_name": MLAlgorithmType.get_name(algorithm),
                        "error": str(e),
                    }
                )
        if best_model:
            self._save_model(best_algorithm, best_model, self.vectorizer)
            training_record = NLPModelTraining(
                model_name=f'auto_{best_algorithm}_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
                status="completed",
                algorithm_type=f"auto_{best_algorithm}",
                training_data_size=len(texts),
                accuracy=results[MLAlgorithmType.all().index(best_algorithm)]["evaluation"][
                    "accuracy"
                ],
                f1_score=best_f1,
                trained_at=datetime.now(),
            )
            db.session.add(training_record)
            db.session.commit()
        best_algo_name = MLAlgorithmType.get_name(best_algorithm) if best_algorithm else "无"
        return {
            "success": True,
            "results": results,
            "best_algorithm": best_algorithm,
            "best_algorithm_name": (
                MLAlgorithmType.get_name(best_algorithm) if best_algorithm else None
            ),
            "best_f1": best_f1,
            "training_data_count": len(texts),
            "message": f"自动选择最佳算法: {best_algo_name}",
        }

    def incremental_train(self, new_texts, new_labels, algorithm=None):
        if algorithm is None:
            algorithm = self._get_best_algorithm()
        model, vectorizer = self._load_model(algorithm)
        if model is None or vectorizer is None:
            return {
                "success": False,
                "message": "模型未加载，无法进行增量学习",
            }
        X_new = vectorizer.transform(new_texts)
        y_new = new_labels
        try:
            if hasattr(model, "partial_fit"):
                if hasattr(model, "classes_"):
                    model.partial_fit(X_new, y_new, classes=model.classes_)
                else:
                    model.partial_fit(X_new, y_new)
            elif hasattr(model, "estimator") and hasattr(model.estimator, "partial_fit"):
                model.estimator.partial_fit(X_new, y_new)
            else:
                X_old = None
                if hasattr(model, "X_"):
                    X_old = model.X_
                    y_old = model.y_
                    X_combined = (
                        np.vstack([X_old.toarray(), X_new.toarray()])
                        if hasattr(X_old, "toarray")
                        else np.vstack([X_old, X_new])
                    )
                    y_combined = np.concatenate([y_old, y_new])
                    model.fit(X_combined, y_combined)
                else:
                    model.fit(X_new, y_new)
            self._save_model(algorithm, model, vectorizer)
            training_record = NLPModelTraining(
                model_name=f'{algorithm}_{datetime.now().strftime("%Y%m%d_%H%M%S")}_incremental',
                status="completed",
                algorithm_type=f"incremental_{algorithm}",
                training_data_size=len(new_texts),
                accuracy=0.0,
                f1_score=0.0,
                trained_at=datetime.now(),
                error_message=json.dumps({"incremental_samples": len(new_texts)}),
            )
            db.session.add(training_record)
            db.session.commit()
            return {
                "success": True,
                "algorithm": algorithm,
                "incremental_samples": len(new_texts),
                "message": f"{MLAlgorithmType.get_name(algorithm)} 模型增量更新完成",
            }
        except Exception as e:
            log_warning(f"[NLPML] 增量学习失败: {e}", exception=e)
            return {"success": False, "message": f"增量学习失败: {e!s}"}

    def online_train(self, text, label):
        return self.incremental_train([text], [label])

    def analyze_model_bias(self):
        texts, labels, rule_id_map = self._prepare_enhanced_training_data()
        if texts is None:
            return {"success": False, "message": "没有足够的评估数据"}
        self.vectorizer = TfidfVectorizer(
            max_features=3000,
            ngram_range=(1, 4),
            analyzer="char_wb",
            lowercase=False,
        )
        X = self.vectorizer.fit_transform(texts)
        y = labels
        from collections import Counter

        label_distribution = Counter(y)
        total_samples = len(y)
        class_imbalance = {
            rule_id: {
                "count": count,
                "percentage": round(count / total_samples * 100, 2),
                "rule_description": (
                    rule_id_map[rule_id].behavior_description
                    if rule_id in rule_id_map
                    else "Unknown"
                ),
            }
            for rule_id, count in label_distribution.most_common()
        }
        algorithm = self._get_best_algorithm()
        model, _ = self._load_model(algorithm)
        if model is None:
            return {
                "success": True,
                "class_distribution": class_imbalance,
                "total_classes": len(label_distribution),
                "total_samples": total_samples,
                "model_bias": "无法分析，模型未加载",
            }
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        per_class_metrics = {}
        for rule_id in label_distribution:
            str_id = str(rule_id)
            if str_id in report:
                per_class_metrics[rule_id] = {
                    "precision": round(report[str_id]["precision"], 4),
                    "recall": round(report[str_id]["recall"], 4),
                    "f1_score": round(report[str_id]["f1_score"], 4),
                    "support": report[str_id]["support"],
                }
        mean_f1 = np.mean([m["f1_score"] for m in per_class_metrics.values()])
        std_f1 = np.std([m["f1_score"] for m in per_class_metrics.values()])
        return {
            "success": True,
            "class_distribution": class_imbalance,
            "total_classes": len(label_distribution),
            "total_samples": total_samples,
            "per_class_metrics": per_class_metrics,
            "mean_f1": round(mean_f1, 4),
            "std_f1": round(std_f1, 4),
            "bias_indicator": (
                "高偏差" if std_f1 > 0.3 else "中等偏差" if std_f1 > 0.15 else "低偏差"
            ),
        }

    def cross_validation_detailed(self, algorithm=None, cv=5):
        if algorithm is None:
            algorithm = self._get_best_algorithm()
        texts, labels, rule_id_map = self._prepare_enhanced_training_data()
        if texts is None:
            return {"success": False, "message": "没有足够的评估数据"}
        self.vectorizer = TfidfVectorizer(
            max_features=3000,
            ngram_range=(1, 4),
            analyzer="char_wb",
            lowercase=False,
        )
        X = self.vectorizer.fit_transform(texts)
        y = labels
        skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
        fold_results = []
        all_y_true = []
        all_y_pred = []
        for fold, (train_idx, test_idx) in enumerate(skf.split(X, y)):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = [y[i] for i in train_idx], [y[i] for i in test_idx]
            model, _ = self._train_model(algorithm, X_train, y_train)
            y_pred = model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            precision = precision_score(y_test, y_pred, average="weighted", zero_division=0)
            recall = recall_score(y_test, y_pred, average="weighted", zero_division=0)
            f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
            fold_results.append(
                {
                    "fold": fold + 1,
                    "accuracy": round(accuracy, 4),
                    "precision": round(precision, 4),
                    "recall": round(recall, 4),
                    "f1_score": round(f1, 4),
                    "train_samples": len(y_train),
                    "test_samples": len(y_test),
                }
            )
            all_y_true.extend(y_test)
            all_y_pred.extend(y_pred)
        overall_accuracy = accuracy_score(all_y_true, all_y_pred)
        overall_precision = precision_score(
            all_y_true, all_y_pred, average="weighted", zero_division=0
        )
        overall_recall = recall_score(all_y_true, all_y_pred, average="weighted", zero_division=0)
        overall_f1 = f1_score(all_y_true, all_y_pred, average="weighted", zero_division=0)
        return {
            "success": True,
            "algorithm": algorithm,
            "algorithm_name": MLAlgorithmType.get_name(algorithm),
            "cv_folds": cv,
            "fold_results": fold_results,
            "overall_metrics": {
                "accuracy": round(overall_accuracy, 4),
                "precision": round(overall_precision, 4),
                "recall": round(overall_recall, 4),
                "f1_score": round(overall_f1, 4),
            },
            "mean_f1": round(np.mean([f["f1_score"] for f in fold_results]), 4),
            "std_f1": round(np.std([f["f1_score"] for f in fold_results]), 4),
            "training_data_count": len(texts),
        }
