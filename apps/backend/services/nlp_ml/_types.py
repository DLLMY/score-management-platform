"""算法枚举与超参配置（叶子模块，无兄弟类依赖之外的循环）。"""

from typing import ClassVar

from services.nlp_ml._shared import (
    BERT_INSTALLED,
    CATBOOST_INSTALLED,
    LGB_INSTALLED,
    TEXTCNN_INSTALLED,
    XGB_INSTALLED,
)


class MLAlgorithmType:
    SVM = "svm"
    RANDOM_FOREST = "random_forest"
    LOGISTIC_REGRESSION = "logistic_regression"
    DECISION_TREE = "decision_tree"
    NAIVE_BAYES = "naive_bayes"
    KNN = "knn"
    GRADIENT_BOOSTING = "gradient_boosting"
    ADA_BOOST = "ada_boost"
    EXTRA_TREES = "extra_trees"
    MLP = "mlp"
    VOTING = "voting"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    CATBOOST = "catboost"
    STACKING = "stacking"
    TEXTCNN = "textcnn"
    BERT = "bert"

    @classmethod
    def all(cls):
        algorithms = [
            cls.SVM,
            cls.RANDOM_FOREST,
            cls.LOGISTIC_REGRESSION,
            cls.DECISION_TREE,
            cls.NAIVE_BAYES,
            cls.KNN,
            cls.GRADIENT_BOOSTING,
            cls.ADA_BOOST,
            cls.EXTRA_TREES,
            cls.MLP,
            cls.VOTING,
        ]
        if XGB_INSTALLED:
            algorithms.append(cls.XGBOOST)
        if LGB_INSTALLED:
            algorithms.append(cls.LIGHTGBM)
        if CATBOOST_INSTALLED:
            algorithms.append(cls.CATBOOST)
        algorithms.append(cls.STACKING)
        if TEXTCNN_INSTALLED:
            algorithms.append(cls.TEXTCNN)
        if BERT_INSTALLED:
            algorithms.append(cls.BERT)
        return algorithms

    @classmethod
    def get_name(cls, algorithm):
        names = {
            cls.SVM: "支持向量机",
            cls.RANDOM_FOREST: "随机森林",
            cls.LOGISTIC_REGRESSION: "逻辑回归",
            cls.DECISION_TREE: "决策树",
            cls.NAIVE_BAYES: "朴素贝叶斯",
            cls.KNN: "K近邻",
            cls.GRADIENT_BOOSTING: "梯度提升",
            cls.ADA_BOOST: "AdaBoost",
            cls.EXTRA_TREES: "极端随机树",
            cls.MLP: "多层感知器",
            cls.VOTING: "集成投票",
            cls.XGBOOST: "XGBoost",
            cls.LIGHTGBM: "LightGBM",
            cls.CATBOOST: "CatBoost",
            cls.STACKING: "Stacking集成",
            cls.TEXTCNN: "TextCNN(轻量文本卷积)",
            cls.BERT: "BERT(预训练Transformer)",
        }
        return names.get(algorithm, algorithm)

    @classmethod
    def is_available(cls, algorithm):
        if algorithm == cls.XGBOOST and not XGB_INSTALLED:
            return False
        if algorithm == cls.LIGHTGBM and not LGB_INSTALLED:
            return False
        if algorithm == cls.CATBOOST and not CATBOOST_INSTALLED:
            return False
        if algorithm == cls.TEXTCNN and not TEXTCNN_INSTALLED:
            return False
        if algorithm == cls.BERT and not BERT_INSTALLED:
            return False
        return algorithm in cls.all()


class HyperparameterConfig:
    SVM_PARAMS: ClassVar[dict] = {
        "C": [0.1, 1, 10, 100],
        "kernel": ["linear", "rbf", "poly"],
        "gamma": ["scale", "auto", 0.1, 1],
        "degree": [2, 3, 4],
    }
    RANDOM_FOREST_PARAMS: ClassVar[dict] = {
        "n_estimators": [100, 200, 300, 500],
        "max_depth": [10, 20, 30, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
        "max_features": ["sqrt", "log2", None],
    }
    LOGISTIC_REGRESSION_PARAMS: ClassVar[dict] = {
        "C": [0.01, 0.1, 1, 10, 100],
        "penalty": ["l1", "l2", "elasticnet", None],
        "solver": ["lbfgs", "liblinear", "saga"],
        "max_iter": [500, 1000, 2000],
    }
    GRADIENT_BOOSTING_PARAMS: ClassVar[dict] = {
        "n_estimators": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1, 0.2],
        "max_depth": [3, 5, 7, 9],
        "subsample": [0.6, 0.8, 1.0],
    }
    XGBOOST_PARAMS: ClassVar[dict] = {
        "n_estimators": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "max_depth": [3, 5, 7],
        "subsample": [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
        "gamma": [0, 0.1, 0.2, 0.5],
        "reg_alpha": [0, 0.1, 1],
        "reg_lambda": [1, 10, 100],
    }
    LIGHTGBM_PARAMS: ClassVar[dict] = {
        "n_estimators": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "max_depth": [3, 5, 7, -1],
        "num_leaves": [31, 63, 127],
        "subsample": [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
    }
    CATBOOST_PARAMS: ClassVar[dict] = {
        "iterations": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "depth": [4, 6, 8, 10],
        "l2_leaf_reg": [1, 3, 5, 10],
        "subsample": [0.6, 0.8, 1.0],
    }
    EXTRA_TREES_PARAMS: ClassVar[dict] = {
        "n_estimators": [100, 200, 300],
        "max_depth": [10, 20, 30, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    }
    MLP_PARAMS: ClassVar[dict] = {
        "hidden_layer_sizes": [
            (64,),
            (128, 64),
            (256, 128, 64),
            (512, 256, 128),
        ],
        "activation": ["relu", "tanh", "logistic"],
        "solver": ["adam", "sgd"],
        "learning_rate": ["constant", "adaptive"],
        "max_iter": [300, 500, 1000],
    }

    @classmethod
    def get_params(cls, algorithm):
        param_map = {
            MLAlgorithmType.SVM: cls.SVM_PARAMS,
            MLAlgorithmType.RANDOM_FOREST: cls.RANDOM_FOREST_PARAMS,
            MLAlgorithmType.LOGISTIC_REGRESSION: (cls.LOGISTIC_REGRESSION_PARAMS),
            MLAlgorithmType.GRADIENT_BOOSTING: cls.GRADIENT_BOOSTING_PARAMS,
            MLAlgorithmType.XGBOOST: cls.XGBOOST_PARAMS,
            MLAlgorithmType.LIGHTGBM: cls.LIGHTGBM_PARAMS,
            MLAlgorithmType.CATBOOST: cls.CATBOOST_PARAMS,
            MLAlgorithmType.EXTRA_TREES: cls.EXTRA_TREES_PARAMS,
            MLAlgorithmType.MLP: cls.MLP_PARAMS,
        }
        return param_map.get(algorithm, {})
