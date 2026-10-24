"""模型装配：_init_models 全算法实例化 + voting/stacking/blending 集成构造 + 置信度校准。"""

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (
    AdaBoostClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    RandomForestClassifier,
    StackingClassifier,
    VotingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import (
    GridSearchCV,
    RandomizedSearchCV,
    StratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.naive_bayes import MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

from services.nlp_ml._model_wrappers import _SklearnBertWrapper, _SklearnTextCNNWrapper
from services.nlp_ml._shared import (
    BERT_INSTALLED,
    CATBOOST_INSTALLED,
    LGB_INSTALLED,
    TEXTCNN_INSTALLED,
    XGB_INSTALLED,
    CatBoostClassifier,
    lgb,
    xgb,
)
from services.nlp_ml._types import MLAlgorithmType
from utils.logger import log_warning


class _ModelsMixin:
    def _init_models(self):
        self.models = {
            MLAlgorithmType.SVM: SVC(
                kernel="rbf",
                probability=True,
                random_state=42,
                class_weight="balanced",
                C=1.0,
                gamma="scale",
            ),
            MLAlgorithmType.RANDOM_FOREST: RandomForestClassifier(
                n_estimators=300,
                max_depth=25,
                min_samples_split=2,
                min_samples_leaf=1,
                random_state=42,
                class_weight="balanced",
                n_jobs=-1,
                max_features="sqrt",
            ),
            MLAlgorithmType.LOGISTIC_REGRESSION: LogisticRegression(
                max_iter=2000,
                random_state=42,
                class_weight="balanced",
                C=1.0,
                solver="saga",
                penalty="elasticnet",
                l1_ratio=0.5,
            ),
            MLAlgorithmType.DECISION_TREE: DecisionTreeClassifier(
                max_depth=30, random_state=42, class_weight="balanced"
            ),
            MLAlgorithmType.NAIVE_BAYES: MultinomialNB(alpha=0.5),
            MLAlgorithmType.KNN: KNeighborsClassifier(n_neighbors=7, weights="distance", n_jobs=-1),
            MLAlgorithmType.GRADIENT_BOOSTING: GradientBoostingClassifier(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=7,
                random_state=42,
                subsample=0.8,
            ),
            MLAlgorithmType.ADA_BOOST: AdaBoostClassifier(
                n_estimators=150, learning_rate=0.8, random_state=42
            ),
            MLAlgorithmType.EXTRA_TREES: ExtraTreesClassifier(
                n_estimators=300,
                max_depth=25,
                random_state=42,
                class_weight="balanced",
                n_jobs=-1,
                max_features="sqrt",
            ),
            MLAlgorithmType.MLP: MLPClassifier(
                hidden_layer_sizes=(512, 256, 128),
                activation="relu",
                solver="adam",
                max_iter=1000,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.1,
                learning_rate="adaptive",
            ),
        }
        if XGB_INSTALLED:
            self.models[MLAlgorithmType.XGBOOST] = xgb.XGBClassifier(
                n_estimators=300,
                learning_rate=0.05,
                max_depth=7,
                subsample=0.8,
                colsample_bytree=0.8,
                gamma=0.1,
                reg_alpha=0.1,
                reg_lambda=10,
                objective="multi:softprob",
                random_state=42,
                n_jobs=-1,
                use_label_encoder=False,
                eval_metric="mlogloss",
            )
        if LGB_INSTALLED:
            self.models[MLAlgorithmType.LIGHTGBM] = lgb.LGBMClassifier(
                n_estimators=300,
                learning_rate=0.05,
                max_depth=7,
                num_leaves=63,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                n_jobs=-1,
                class_weight="balanced",
            )
        if CATBOOST_INSTALLED:
            self.models[MLAlgorithmType.CATBOOST] = CatBoostClassifier(
                iterations=300,
                learning_rate=0.05,
                depth=8,
                l2_leaf_reg=3,
                subsample=0.8,
                random_state=42,
                verbose=0,
                auto_class_weights="Balanced",
            )
        # TextCNN: 项目自实现的轻量级文本卷积分类器
        if TEXTCNN_INSTALLED:
            try:
                self.models[MLAlgorithmType.TEXTCNN] = _SklearnTextCNNWrapper(
                    embedding_dim=128,
                    max_len=32,
                    num_filters=64,
                    filter_sizes=[2, 3, 4],
                )
            except Exception as e:
                log_warning(f"[NLPMLTrainingService] TextCNN初始化失败: {e}", exception=e)
        # BERT: 预训练Transformer模型（CPU环境使用轻量级模式）
        if BERT_INSTALLED:
            try:
                self.models[MLAlgorithmType.BERT] = _SklearnBertWrapper(
                    model_path="models/bert", use_quantization=True
                )
            except Exception as e:
                log_warning(f"[NLPMLTrainingService] BERT初始化失败: {e}", exception=e)

    def _get_voting_model(self):
        base_models = []
        if MLAlgorithmType.RANDOM_FOREST in self.models:
            base_models.append(("rf", self.models[MLAlgorithmType.RANDOM_FOREST]))
        if MLAlgorithmType.GRADIENT_BOOSTING in self.models:
            base_models.append(("gb", self.models[MLAlgorithmType.GRADIENT_BOOSTING]))
        if MLAlgorithmType.EXTRA_TREES in self.models:
            base_models.append(("et", self.models[MLAlgorithmType.EXTRA_TREES]))
        if MLAlgorithmType.LOGISTIC_REGRESSION in self.models:
            base_models.append(("lr", self.models[MLAlgorithmType.LOGISTIC_REGRESSION]))
        if XGB_INSTALLED and MLAlgorithmType.XGBOOST in self.models:
            base_models.append(("xgb", self.models[MLAlgorithmType.XGBOOST]))
        if LGB_INSTALLED and MLAlgorithmType.LIGHTGBM in self.models:
            base_models.append(("lgb", self.models[MLAlgorithmType.LIGHTGBM]))
        return VotingClassifier(
            estimators=base_models,
            voting="soft",
            n_jobs=-1,
            weights=[1, 1.2, 1, 0.8, 1.5, 1.5],
        )

    def _get_stacking_model(self):
        base_models = []
        if MLAlgorithmType.RANDOM_FOREST in self.models:
            base_models.append(("rf", self.models[MLAlgorithmType.RANDOM_FOREST]))
        if MLAlgorithmType.EXTRA_TREES in self.models:
            base_models.append(("et", self.models[MLAlgorithmType.EXTRA_TREES]))
        if MLAlgorithmType.GRADIENT_BOOSTING in self.models:
            base_models.append(("gb", self.models[MLAlgorithmType.GRADIENT_BOOSTING]))
        if XGB_INSTALLED and MLAlgorithmType.XGBOOST in self.models:
            base_models.append(("xgb", self.models[MLAlgorithmType.XGBOOST]))
        if LGB_INSTALLED and MLAlgorithmType.LIGHTGBM in self.models:
            base_models.append(("lgb", self.models[MLAlgorithmType.LIGHTGBM]))
        meta_model = LogisticRegression(
            max_iter=2000,
            random_state=42,
            class_weight="balanced",
            C=10,
            solver="saga",
        )
        return StackingClassifier(
            estimators=base_models,
            final_estimator=meta_model,
            cv=5,
            stack_method="predict_proba",
            n_jobs=-1,
            passthrough=True,
        )

    def _get_blending_model(self, X_train, y_train):
        base_models = []
        model_names = []
        if MLAlgorithmType.RANDOM_FOREST in self.models:
            base_models.append(("rf", self.models[MLAlgorithmType.RANDOM_FOREST]))
            model_names.append("rf")
        if MLAlgorithmType.EXTRA_TREES in self.models:
            base_models.append(("et", self.models[MLAlgorithmType.EXTRA_TREES]))
            model_names.append("et")
        if MLAlgorithmType.GRADIENT_BOOSTING in self.models:
            base_models.append(("gb", self.models[MLAlgorithmType.GRADIENT_BOOSTING]))
            model_names.append("gb")
        if XGB_INSTALLED and MLAlgorithmType.XGBOOST in self.models:
            base_models.append(("xgb", self.models[MLAlgorithmType.XGBOOST]))
            model_names.append("xgb")
        if LGB_INSTALLED and MLAlgorithmType.LIGHTGBM in self.models:
            base_models.append(("lgb", self.models[MLAlgorithmType.LIGHTGBM]))
            model_names.append("lgb")
        if CATBOOST_INSTALLED and MLAlgorithmType.CATBOOST in self.models:
            base_models.append(("cb", self.models[MLAlgorithmType.CATBOOST]))
            model_names.append("cb")
        if not base_models:
            return None, None, None
        X_train_part1, X_train_part2, y_train_part1, y_train_part2 = train_test_split(
            X_train,
            y_train,
            test_size=0.5,
            random_state=42,
            stratify=y_train,
        )
        meta_features = []
        trained_base_models = []
        for name, model in base_models:
            model.fit(X_train_part1, y_train_part1)
            trained_base_models.append((name, model))
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X_train_part2)
                meta_features.append(probs)
            else:
                preds = model.predict(X_train_part2)
                meta_features.append(preds.reshape(-1, 1))
        meta_X = np.hstack(meta_features)
        meta_model = LogisticRegression(
            max_iter=2000,
            random_state=42,
            class_weight="balanced",
            C=1.0,
            solver="saga",
        )
        meta_model.fit(meta_X, y_train_part2)
        return trained_base_models, meta_model, model_names

    def _calibrate_confidence(self, model, X, y):
        if hasattr(model, "predict_proba"):
            calibrated_model = CalibratedClassifierCV(model, cv=3, method="sigmoid")
            calibrated_model.fit(X, y)
            return calibrated_model
        return model
