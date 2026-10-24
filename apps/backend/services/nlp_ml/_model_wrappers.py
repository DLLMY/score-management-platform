"""sklearn 兼容包装器：TextCNN / BERT（内部惰性导入 services.textcnn_service / bert_service）。"""

import logging
import os

import numpy as np
from sklearn.linear_model import LogisticRegression

from utils.logger import log_warning


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
            result = self.cnn.forward(t)
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
                log_warning(f"[BertWrapper] BERT服务初始化未完成: {model_path}")
        except Exception as e:
            log_warning(f"[BertWrapper] 初始化失败: {e}", exception=e)

    def _get_embedding(self, text):
        if self._available and self.bert is not None:
            try:
                emb = self.bert.get_embedding(text)
                if emb is not None:
                    return np.array(emb)
            except Exception:
                logging.getLogger(__name__).warning(
                    "NLP best-effort operation failed; exception previously swallowed silently",
                    exc_info=True,
                )
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
                    log_warning(f"[BertWrapper] 训练失败: {e}", exception=e)
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
                    logging.getLogger(__name__).warning(
                        "NLP best-effort operation failed; exception previously swallowed silently",
                        exc_info=True,
                    )
        # 退化为使用BERT的predict_intent
        preds = []
        for t in texts:
            try:
                intent, _ = self.bert.predict_intent(t)
                preds.append(intent)
            except Exception:
                logging.getLogger(__name__).warning(
                    "NLP best-effort operation failed; exception previously swallowed silently",
                    exc_info=True,
                )
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
