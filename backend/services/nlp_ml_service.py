import os
import time
import json
import jieba
import numpy as np
try:
    import torch

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
import scipy.sparse as sp
import random
import pickle
from models import db
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import (
    train_test_split,
    GridSearchCV,
    RandomizedSearchCV,
    cross_val_score,
    StratifiedKFold,
)
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
)
from sklearn.svm import SVC
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    AdaBoostClassifier,
    ExtraTreesClassifier,
    VotingClassifier,
    StackingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
from sklearn.pipeline import Pipeline
from sklearn.decomposition import TruncatedSVD, PCA, NMF
from sklearn.feature_selection import SelectKBest, chi2, f_classif, mutual_info_classif
from sklearn.calibration import CalibratedClassifierCV
from models import NLPScoringRule, NLPMatchResult, NLPModelTraining
from utils.db_session import db_session_scope

MODEL_DIR = os.path.join(os.path.dirname(__file__), "../models/trained")
os.makedirs(MODEL_DIR, exist_ok=True)

try:
    import xgboost as xgb

    XGB_INSTALLED = True
except ImportError:
    XGB_INSTALLED = False

try:
    import lightgbm as lgb

    LGB_INSTALLED = True
except ImportError:
    LGB_INSTALLED = False

try:
    import shap

    SHAP_INSTALLED = True
except ImportError:
    SHAP_INSTALLED = False

try:
    from catboost import CatBoostClassifier

    CATBOOST_INSTALLED = True
except ImportError:
    CATBOOST_INSTALLED = False

try:
    from gensim.models import Word2Vec, Doc2Vec
    from gensim.models.doc2vec import TaggedDocument

    GENSIM_INSTALLED = True
except ImportError:
    GENSIM_INSTALLED = False

try:
    from transformers import BertTokenizer, BertModel

    TRANSFORMERS_INSTALLED = True
except ImportError:
    TRANSFORMERS_INSTALLED = False

TEXTCNN_INSTALLED = True
BERT_INSTALLED = TRANSFORMERS_INSTALLED


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
    SVM_PARAMS = {
        "C": [0.1, 1, 10, 100],
        "kernel": ["linear", "rbf", "poly"],
        "gamma": ["scale", "auto", 0.1, 1],
        "degree": [2, 3, 4],
    }
    RANDOM_FOREST_PARAMS = {
        "n_estimators": [100, 200, 300, 500],
        "max_depth": [10, 20, 30, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
        "max_features": ["sqrt", "log2", None],
    }
    LOGISTIC_REGRESSION_PARAMS = {
        "C": [0.01, 0.1, 1, 10, 100],
        "penalty": ["l1", "l2", "elasticnet", None],
        "solver": ["lbfgs", "liblinear", "saga"],
        "max_iter": [500, 1000, 2000],
    }
    GRADIENT_BOOSTING_PARAMS = {
        "n_estimators": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1, 0.2],
        "max_depth": [3, 5, 7, 9],
        "subsample": [0.6, 0.8, 1.0],
    }
    XGBOOST_PARAMS = {
        "n_estimators": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "max_depth": [3, 5, 7],
        "subsample": [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
        "gamma": [0, 0.1, 0.2, 0.5],
        "reg_alpha": [0, 0.1, 1],
        "reg_lambda": [1, 10, 100],
    }
    LIGHTGBM_PARAMS = {
        "n_estimators": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "max_depth": [3, 5, 7, -1],
        "num_leaves": [31, 63, 127],
        "subsample": [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
    }
    CATBOOST_PARAMS = {
        "iterations": [100, 200, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "depth": [4, 6, 8, 10],
        "l2_leaf_reg": [1, 3, 5, 10],
        "subsample": [0.6, 0.8, 1.0],
    }
    EXTRA_TREES_PARAMS = {
        "n_estimators": [100, 200, 300],
        "max_depth": [10, 20, 30, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    }
    MLP_PARAMS = {
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


class FeatureEngineeringService:
    def __init__(self):
        self.vectorizer = None
        self.w2v_model = None
        self.d2v_model = None
        self.bert_model = None
        self.bert_tokenizer = None
        self.svd_model = None
        self.pca_model = None
        self.feature_selectors = {}
        self.embedding_models = {}

    def build_tfidf_features(self, texts, max_features=3000, ngram_range=(1, 4)):
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            analyzer="char_wb",
            lowercase=False,
        )
        return self.vectorizer.fit_transform(texts)

    def build_char_features(self, texts, max_features=2000, ngram_range=(1, 5)):
        char_vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            analyzer="char",
            lowercase=False,
        )
        return char_vectorizer.fit_transform(texts)

    def build_word_features(self, texts, max_features=2000, ngram_range=(1, 2)):
        tokenized_texts = [" ".join(jieba.lcut(text)) for text in texts]
        word_vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            analyzer="word",
            lowercase=False,
        )
        return word_vectorizer.fit_transform(tokenized_texts)

    def build_w2v_features(self, texts, vector_size=100, window=5, min_count=1):
        if not GENSIM_INSTALLED:
            return None
        tokenized_texts = [jieba.lcut(text) for text in texts]
        self.w2v_model = Word2Vec(
            tokenized_texts,
            vector_size=vector_size,
            window=window,
            min_count=min_count,
            workers=4,
            epochs=10,
        )
        features = []
        for tokens in tokenized_texts:
            vectors = [self.w2v_model.wv[token] for token in tokens if token in self.w2v_model.wv]
            if vectors:
                features.append(sum(vectors) / len(vectors))
            else:
                features.append([0] * vector_size)
        return features

    def build_doc2vec_features(self, texts, vector_size=100, window=5, min_count=1):
        if not GENSIM_INSTALLED:
            return None
        tokenized_texts = [jieba.lcut(text) for text in texts]
        tagged_docs = [
            TaggedDocument(words=tokens, tags=[str(i)]) for i, tokens in enumerate(tokenized_texts)
        ]
        self.d2v_model = Doc2Vec(
            tagged_docs,
            vector_size=vector_size,
            window=window,
            min_count=min_count,
            workers=4,
            epochs=10,
            dm=1,
        )
        features = []
        for tokens in tokenized_texts:
            features.append(self.d2v_model.infer_vector(tokens))
        return features

    def build_bert_features(self, texts, model_name="bert-base-chinese", max_length=64):
        if not TRANSFORMERS_INSTALLED or not TORCH_AVAILABLE:
            return None
        self.bert_tokenizer = BertTokenizer.from_pretrained(model_name, revision="main")  # nosec
        self.bert_model = BertModel.from_pretrained(model_name, revision="main")  # nosec
        self.bert_model.eval()
        features = []
        for text in texts:
            inputs = self.bert_tokenizer(
                text,
                padding="max_length",
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            )
            with torch.no_grad():
                outputs = self.bert_model(**inputs)
            cls_embedding = outputs.last_hidden_state[:, 0, :].numpy().flatten()
            features.append(cls_embedding)
        return features

    def build_statistical_features(self, texts):
        features = []
        for text in texts:
            text_len = len(text)
            if self.jieba_initialized:
                words = jieba.lcut(text)
                word_count = len(words)
                avg_word_len = sum(len(word) for word in words) / max(word_count, 1)
            else:
                word_count = text_len
                avg_word_len = 1.0
            digit_count = sum(1 for char in text if char.isdigit())
            punctuation_count = sum(1 for char in text if char in "，。！？、；：“”‘’（）【】")
            whitespace_count = sum(1 for char in text if char.isspace())
            features.append(
                [
                    text_len,
                    word_count,
                    avg_word_len,
                    digit_count,
                    punctuation_count,
                    whitespace_count,
                    digit_count / max(text_len, 1),
                    punctuation_count / max(text_len, 1),
                ]
            )
        return np.array(features)

    def combine_features(self, *feature_list):
        valid_features = []
        for features in feature_list:
            if features is None:
                continue
            if sp.issparse(features):
                valid_features.append(features.toarray())
            else:
                valid_features.append(np.array(features))
        if not valid_features:
            return None
        combined = np.hstack(valid_features)
        return sp.csr_matrix(combined)

    def apply_dimensionality_reduction(self, features, n_components=100, method="svd"):
        if method == "pca":
            if sp.issparse(features):
                features = features.toarray()
            self.pca_model = PCA(n_components=n_components, random_state=42)
            return self.pca_model.fit_transform(features)
        elif method == "nmf":
            if sp.issparse(features):
                features = features.toarray()
            nmf_model = NMF(n_components=n_components, random_state=42, init="nndsvda")
            return nmf_model.fit_transform(features)
        else:
            self.svd_model = TruncatedSVD(n_components=n_components, random_state=42)
            return self.svd_model.fit_transform(features)

    def apply_feature_selection(self, features, labels, k=500, method="chi2"):
        if method == "f_classif":
            selector = SelectKBest(f_classif, k=min(k, features.shape[1]))
        elif method == "mutual_info":
            selector = SelectKBest(mutual_info_classif, k=min(k, features.shape[1]))
        else:
            selector = SelectKBest(chi2, k=min(k, features.shape[1]))
        self.feature_selectors[method] = selector
        return selector.fit_transform(features, labels)

    def apply_scaling(self, features, method="standard"):
        if method == "minmax":
            scaler = MinMaxScaler()
        elif method == "robust":
            scaler = RobustScaler()
        else:
            scaler = StandardScaler(with_mean=False)
        if sp.issparse(features):
            return scaler.fit_transform(features)
        return scaler.fit_transform(features)

    def build_hybrid_features(
        self,
        texts,
        use_w2v=True,
        use_doc2vec=True,
        use_char=True,
        use_word=True,
        use_stat=True,
        use_bert=False,
    ):
        features_list = []
        tfidf_features = self.build_tfidf_features(texts)
        features_list.append(tfidf_features)
        if use_char:
            char_features = self.build_char_features(texts)
            features_list.append(char_features)
        if use_word:
            word_features = self.build_word_features(texts)
            features_list.append(word_features)
        if use_w2v:
            w2v_features = self.build_w2v_features(texts)
            features_list.append(w2v_features)
        if use_doc2vec:
            d2v_features = self.build_doc2vec_features(texts)
            features_list.append(d2v_features)
        if use_stat:
            stat_features = self.build_statistical_features(texts)
            features_list.append(stat_features)
        if use_bert:
            bert_features = self.build_bert_features(texts)
            features_list.append(bert_features)
        return self.combine_features(*features_list)


class _SklearnTextCNNWrapper:
    """TextCNN的sklearn兼容包装器，使TextCNN能作为统一ML算法接入训练流水线"""

    def __init__(self, embedding_dim=128, max_len=32, num_filters=64, filter_sizes=None):
        from services.textcnn_service import TextCNNClassifier

        if filter_sizes is None:
            filter_sizes = [2, 3, 4]
        self.embedding_dim = embedding_dim
        self.max_len = max_len
        self.num_filters = num_filters
        self.filter_sizes = filter_sizes
        self.cnn = TextCNNClassifier(
            embedding_dim=embedding_dim,
            max_len=max_len,
            num_filters=num_filters,
            filter_sizes=filter_sizes,
        )
        self.classes_ = None
        self.label_mapping = {}

    def fit(self, X, y):
        texts = [str(t) for t in X]
        labels = [str(label) for label in y]
        unique_labels = sorted(set(labels))
        self.classes_ = np.array(unique_labels)
        self.label_mapping = {label: i for i, label in enumerate(unique_labels)}
        self.cnn.intent_labels = unique_labels
        self.cnn.num_classes = len(unique_labels)
        total_features = self.cnn.num_filters * len(self.cnn.filter_sizes)
        self.cnn.fc_weights = np.random.randn(total_features, self.cnn.num_classes) * 0.01
        self.cnn.fc_bias = np.zeros(self.cnn.num_classes)
        # 优化参数：增加epoch次数，使用SGD+momentum优化器
        self.cnn.train(texts, labels, epochs=50, learning_rate=0.005)
        return self

    def predict(self, X):
        texts = [str(t) for t in X]
        preds = []
        for t in texts:
            intent, _ = self.cnn.predict_intent(t)
            preds.append(intent)
        return np.array(preds)

    def predict_proba(self, X):
        texts = [str(t) for t in X]
        probs_list = []
        for t in texts:
            result = self.cnn.forward(t)  # noqa: F841
            probs = result["probabilities"][0]
            row = np.zeros(len(self.classes_))
            for i, cls in enumerate(self.classes_):
                if cls in self.label_mapping:
                    row[i] = probs[self.label_mapping[cls]]
            probs_list.append(row)
        return np.array(probs_list)


class _SklearnBertWrapper:
    """BERT的sklearn兼容包装器"""

    def __init__(self, model_path="models/bert", use_quantization=True):
        from services.bert_service import BertNLPService

        # 使用绝对路径
        if not os.path.isabs(model_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_path = os.path.join(base_dir, model_path)
        self.model_path = model_path
        self.use_quantization = use_quantization
        self.classes_ = None
        self.bert = None
        self._available = False
        try:
            self.bert = BertNLPService(model_path=model_path, use_quantization=use_quantization)
            if self.bert.is_available():
                self._available = True
            else:
                print(f"[BertWrapper] BERT服务初始化未完成: {model_path}")
        except Exception as e:
            print(f"[BertWrapper] 初始化失败: {e}")

    def _get_embedding(self, text):
        if self._available and self.bert is not None:
            try:
                emb = self.bert.get_embedding(text)
                if emb is not None:
                    return np.array(emb)
            except Exception:
                pass
        return None

    def fit(self, X, y):
        texts = [str(t) for t in X]
        labels = [str(label) for label in y]
        unique_labels = sorted(set(labels))
        self.classes_ = np.array(unique_labels)
        if self._available:
            embeddings = []
            for t in texts:
                emb = self._get_embedding(t)
                if emb is not None:
                    embeddings.append(emb)
            if len(embeddings) >= len(texts) * 0.5:
                clf = LogisticRegression(max_iter=500, random_state=42)
                try:
                    clf.fit(np.array(embeddings), labels)
                    self._fallback_clf = clf
                except Exception as e:
                    print(f"[BertWrapper] 训练失败: {e}")
                    self._fallback_clf = None
            else:
                self._fallback_clf = None
        return self

    def predict(self, X):
        texts = [str(t) for t in X]
        if not self._available:
            return np.array([self.classes_[0]] * len(texts))
        if hasattr(self, "_fallback_clf") and self._fallback_clf is not None:
            embeddings = []
            for t in texts:
                emb = self._get_embedding(t)
                if emb is not None:
                    embeddings.append(emb)
            if embeddings:
                try:
                    return self._fallback_clf.predict(np.array(embeddings))
                except Exception:
                    pass
        # 退化为使用BERT的predict_intent
        preds = []
        for t in texts:
            try:
                intent, _ = self.bert.predict_intent(t)
                preds.append(intent)
            except Exception:
                preds.append(self.classes_[0])
        return np.array(preds)

    def predict_proba(self, X):
        preds = self.predict(X)
        label_to_idx = {l: i for i, l in enumerate(self.classes_)}
        probs = np.zeros((len(X), len(self.classes_)))
        for i, p in enumerate(preds):
            if p in label_to_idx:
                probs[i, label_to_idx[p]] = 0.7
            else:
                probs[i, 0] = 0.5
        return probs


class NLPMLTrainingService:
    def __init__(self):
        self.vectorizer = None
        self.models = {}
        self.feature_service = FeatureEngineeringService()
        self._init_models()

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
                print(f"[NLPMLTrainingService] TextCNN初始化失败: {e}")
        # BERT: 预训练Transformer模型（CPU环境使用轻量级模式）
        if BERT_INSTALLED:
            try:
                self.models[MLAlgorithmType.BERT] = _SklearnBertWrapper(
                    model_path="models/bert", use_quantization=True
                )
            except Exception as e:
                print(f"[NLPMLTrainingService] BERT初始化失败: {e}")

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
        except Exception:
            return []

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
        for result in match_results:
            if result.input_text and result.matched_rule_id:
                texts.append(result.input_text)
                labels.append(result.matched_rule_id)
                if result.behavior_description:
                    texts.append(result.behavior_description)
                    labels.append(result.matched_rule_id)
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
        augmented_texts, augmented_labels = self._apply_text_augmentation(texts, labels)
        texts = augmented_texts
        labels = augmented_labels
        if not texts:
            return None, None, None
        return texts, labels, rule_id_map

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
        except Exception:
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
            except Exception:
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
        except Exception:
            return None
        return {
            "rule_id": rule_id,
            "confidence": round(confidence, 4),
            "algorithm": algorithm,
            "explanation": explanation,
            "feature_importance": feature_importance,
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
            return {"success": False, "message": f"增量学习失败: {str(e)}"}

    def online_train(self, text, label):
        return self.incremental_train([text], [label])

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
