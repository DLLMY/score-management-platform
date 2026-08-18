"""
TextCNN意图分类器服务

使用纯Python numpy实现的轻量级卷积神经网络。
用于意图分类和语义相似度计算。
"""

import os
import sys
import numpy as np
import time
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TextCNNClassifier:

    def __init__(self, embedding_dim=128, max_len=32, num_filters=64, filter_sizes=[2, 3, 4]):
        self.embedding_dim = embedding_dim
        self.max_len = max_len
        self.num_filters = num_filters
        self.filter_sizes = filter_sizes
        self.vocab = {}
        self.vocab_size = 0
        self.intent_labels = ["praise", "punish", "attendance", "behavior", "other"]
        self.num_classes = len(self.intent_labels)
        self.embeddings = None
        self.filters = {}
        self.filter_biases = {}
        self.fc_weights = None
        self.fc_bias = None
        self._trained = False
        self._build_vocab()
        self._initialize_weights()

    def _build_vocab(self):
        """构建字符级词汇表"""
        base_chars = "".join([chr(i) for i in range(19968, 40959)])
        punctuation = "，。！？、；：“”‘’（）【】《》—…·"
        digits = "0123456789"
        letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
        all_chars = base_chars + punctuation + digits + letters
        self.vocab[""] = 0
        for i, char in enumerate(all_chars):
            self.vocab[char] = i + 1
        self.vocab_size = len(self.vocab)

    def _initialize_weights(self):
        """初始化网络权重"""
        np.random.seed(42)
        self.embeddings = np.random.randn(self.vocab_size, self.embedding_dim) * 0.01
        for size in self.filter_sizes:
            self.filters[size] = np.random.randn(self.num_filters, size, self.embedding_dim) * 0.01
            self.filter_biases[size] = np.zeros(self.num_filters)
        total_features = self.num_filters * len(self.filter_sizes)
        self.fc_weights = np.random.randn(total_features, self.num_classes) * 0.01
        self.fc_bias = np.zeros(self.num_classes)

    def _tokenize(self, text):
        """字符级分词"""
        tokens = []
        for char in text:
            if char in self.vocab:
                tokens.append(self.vocab[char])
            else:
                tokens.append(0)
        if len(tokens) < self.max_len:
            tokens += [0] * (self.max_len - len(tokens))
        else:
            tokens = tokens[: self.max_len]
        return np.array(tokens)

    def _conv1d(self, inputs, filter_size):
        """1维卷积操作（向量化实现，CPU友好）"""
        filter_weight = self.filters[filter_size]
        bias = self.filter_biases[filter_size]
        from numpy.lib.stride_tricks import sliding_window_view

        windows = sliding_window_view(inputs, window_shape=filter_size, axis=1)
        output = np.einsum("btij,fji->btf", windows, filter_weight) + bias
        return output.transpose(0, 2, 1)

    def _relu(self, x):
        """ReLU激活函数"""
        return np.maximum(0, x)

    def _max_pool(self, inputs):
        """最大池化"""
        return np.max(inputs, axis=2)

    def forward(self, texts):
        """前向传播"""
        if isinstance(texts, str):
            texts = [texts]
        batch_tokens = np.array([self._tokenize(t) for t in texts])
        batch_size = len(texts)
        embedded = self.embeddings[batch_tokens]
        all_features = []
        for size in self.filter_sizes:
            conv_out = self._conv1d(embedded, size)
            relu_out = self._relu(conv_out)
            pooled = self._max_pool(relu_out)
            all_features.append(pooled)
        features = np.concatenate(all_features, axis=1)
        flattened = features.reshape(batch_size, -1)
        logits = flattened @ self.fc_weights + self.fc_bias
        exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
        probabilities = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
        predictions = np.argmax(probabilities, axis=1)
        return {"predictions": predictions, "probabilities": probabilities, "features": flattened}

    def predict_intent(self, text):
        """预测意图"""
        result = self.forward(text)
        intent_idx = result["predictions"][0]
        intent = self.intent_labels[intent_idx]
        confidence = float(result["probabilities"][0][intent_idx])
        return (intent, confidence)

    def get_sentence_embedding(self, text):
        """获取句子向量"""
        result = self.forward(text)
        return result["features"][0]

    def cosine_similarity(self, text1, text2):
        """计算语义相似度"""
        emb1 = self.get_sentence_embedding(text1)
        emb2 = self.get_sentence_embedding(text2)
        dot = np.dot(emb1, emb2)
        mag1 = np.linalg.norm(emb1)
        mag2 = np.linalg.norm(emb2)
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return float(dot / (mag1 * mag2))

    def save_model(self, path):
        """保存模型"""
        model_data = {
            "embedding_dim": self.embedding_dim,
            "max_len": self.max_len,
            "num_filters": self.num_filters,
            "filter_sizes": self.filter_sizes,
            "vocab": self.vocab,
            "intent_labels": self.intent_labels,
            "embeddings": self.embeddings.tolist(),
            "filters": {k: v.tolist() for k, v in self.filters.items()},
            "filter_biases": {k: v.tolist() for k, v in self.filter_biases.items()},
            "fc_weights": self.fc_weights.tolist(),
            "fc_bias": self.fc_bias.tolist(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(model_data, f, ensure_ascii=False)

    def load_model(self, path):
        """加载模型"""
        with open(path, "r", encoding="utf-8") as f:
            model_data = json.load(f)
        self.embedding_dim = model_data["embedding_dim"]
        self.max_len = model_data["max_len"]
        self.num_filters = model_data["num_filters"]
        self.filter_sizes = model_data["filter_sizes"]
        self.vocab = model_data["vocab"]
        self.intent_labels = model_data["intent_labels"]
        self.num_classes = len(self.intent_labels)
        self.embeddings = np.array(model_data["embeddings"])
        self.filters = {k: np.array(v) for k, v in model_data["filters"].items()}
        self.filter_biases = {k: np.array(v) for k, v in model_data["filter_biases"].items()}
        self.fc_weights = np.array(model_data["fc_weights"])
        self.fc_bias = np.array(model_data["fc_bias"])
        self.vocab_size = len(self.vocab)
        self._trained = True

    def train(self, texts, labels, epochs=10, learning_rate=0.01):
        """训练模型"""
        label_mapping = {label: i for i, label in enumerate(self.intent_labels)}
        X = np.array([self._tokenize(t) for t in texts])
        y = np.array([label_mapping.get(label, 0) for label in labels])
        n_samples = len(texts)
        batch_size = min(256, n_samples)
        for epoch in range(epochs):
            indices = np.random.permutation(n_samples)
            epoch_loss = 0
            for batch_start in range(0, n_samples, batch_size):
                batch_end = min(batch_start + batch_size, n_samples)
                batch_idx = indices[batch_start:batch_end]
                X_batch = X[batch_idx]
                y_batch = y[batch_idx]
                embedded = self.embeddings[X_batch]
                all_features = []
                for size in self.filter_sizes:
                    conv_out = self._conv1d(embedded, size)
                    relu_out = self._relu(conv_out)
                    pooled = self._max_pool(relu_out)
                    all_features.append(pooled)
                features = np.concatenate(all_features, axis=1)
                flattened = features.reshape(len(batch_idx), -1)
                logits = flattened @ self.fc_weights + self.fc_bias
                exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
                probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
                one_hot = np.zeros((len(batch_idx), self.num_classes))
                one_hot[np.arange(len(batch_idx)), y_batch] = 1
                loss = -np.mean(np.sum(one_hot * np.log(probs + 1e-08), axis=1))
                epoch_loss += loss * len(batch_idx)
                delta = (probs - one_hot) / len(batch_idx)
                max_grad = 1.0
                delta = np.clip(delta, -max_grad, max_grad)
                fc_grad_w = flattened.T @ delta
                fc_grad_b = np.sum(delta, axis=0)
                self.fc_weights -= learning_rate * fc_grad_w
                self.fc_bias -= learning_rate * fc_grad_b
            avg_loss = epoch_loss / n_samples
            if (epoch + 1) % 10 == 0:
                all_embedded = self.embeddings[X]
                all_features = []
                for size in self.filter_sizes:
                    conv_out = self._conv1d(all_embedded, size)
                    relu_out = self._relu(conv_out)
                    pooled = self._max_pool(relu_out)
                    all_features.append(pooled)
                all_flat = np.concatenate(all_features, axis=1).reshape(n_samples, -1)
                all_logits = all_flat @ self.fc_weights + self.fc_bias
                predictions = np.argmax(all_logits, axis=1)
                accuracy = np.mean(predictions == y)
                print(f"Epoch {epoch + 1}/{epochs}, Loss: {avg_loss:.4f}, Accuracy: {accuracy:.4f}")
        self._trained = True


class IntentMatcher:
    """意图匹配器"""

    def __init__(self):
        self.cnn = TextCNNClassifier()
        self.praise_patterns = [
            "发言",
            "回答",
            "举手",
            "提问",
            "积极",
            "主动",
            "优秀",
            "良好",
            "帮助",
            "协助",
            "助人为乐",
            "认真",
            "努力",
            "进步",
            "表扬",
            "奖励",
            "加分",
            "好",
            "棒",
            "赞",
            "完成",
            "按时",
            "提前",
            "遵守",
            "礼貌",
            "文明",
            "团结",
            "合作",
            "分享",
            "贡献",
        ]
        self.punish_patterns = [
            "迟到",
            "早退",
            "旷课",
            "缺席",
            "睡觉",
            "讲话",
            "打闹",
            "打架",
            "骂人",
            "争吵",
            "违纪",
            "违规",
            "不遵守",
            "扰乱",
            "影响",
            "扣分",
            "处罚",
            "批评",
            "警告",
            "差",
            "坏",
            "错误",
            "忘记",
            "未完成",
            "拖欠",
            "不交",
            "抄袭",
            "作弊",
            "撒谎",
            "欺骗",
        ]
        self.attendance_patterns = [
            "迟到",
            "早退",
            "旷课",
            "请假",
            "出勤",
            "到场",
            "签到",
            "缺席",
            "请假",
            "病假",
            "事假",
            "公假",
            "早退",
            "迟到",
        ]
        self.behavior_patterns = [
            "发言",
            "回答",
            "提问",
            "睡觉",
            "讲话",
            "打闹",
            "打架",
            "帮助",
            "协助",
            "值日",
            "打扫",
            "整理",
            "作业",
            "完成",
            "交作业",
            "作业完成",
            "课堂表现",
            "上课",
            "下课",
        ]

    def match_pattern(self, text, patterns):
        """匹配行为模式"""
        matched = []
        for pattern in patterns:
            if pattern in text:
                matched.append(pattern)
        return matched

    def predict(self, text):
        """综合预测"""
        cnn_intent, cnn_confidence = self.cnn.predict_intent(text)
        praise_matches = self.match_pattern(text, self.praise_patterns)
        punish_matches = self.match_pattern(text, self.punish_patterns)
        attendance_matches = self.match_pattern(text, self.attendance_patterns)
        behavior_matches = self.match_pattern(text, self.behavior_patterns)
        rule_confidence = 0
        rule_intent = "other"
        if praise_matches:
            rule_intent = "praise"
            rule_confidence = min(1.0, len(praise_matches) * 0.3)
        elif punish_matches:
            rule_intent = "punish"
            rule_confidence = min(1.0, len(punish_matches) * 0.3)
        elif attendance_matches:
            rule_intent = "attendance"
            rule_confidence = min(1.0, len(attendance_matches) * 0.3)
        elif behavior_matches:
            rule_intent = "behavior"
            rule_confidence = min(1.0, len(behavior_matches) * 0.3)
        if rule_confidence > 0.5:
            final_intent = rule_intent
            final_confidence = rule_confidence * 0.7 + cnn_confidence * 0.3
        elif rule_confidence > 0:
            # 规则弱匹配：信任规则意图，但置信度不超过规则本身，不盲信 CNN 随机输出
            final_intent = rule_intent
            final_confidence = rule_confidence
        else:
            # 规则完全无法匹配：CNN 未经训练时为随机结果，不可信，诚实返回无法确定
            if getattr(self.cnn, "_trained", False):
                final_intent = cnn_intent
                final_confidence = cnn_confidence * 0.5
            else:
                final_intent = "other"
                final_confidence = 0.0
        return {
            "intent": final_intent,
            "confidence": final_confidence,
            "cnn_intent": cnn_intent,
            "cnn_confidence": cnn_confidence,
            "rule_intent": rule_intent,
            "rule_confidence": rule_confidence,
            "matches": {
                "praise": praise_matches,
                "punish": punish_matches,
                "attendance": attendance_matches,
                "behavior": behavior_matches,
            },
            "method": "hybrid",
        }

    def semantic_search(self, text, candidates, top_k=3):
        """语义搜索"""
        results = []
        for candidate in candidates:
            similarity = self.cnn.cosine_similarity(text, candidate)
            results.append({"text": candidate, "similarity": similarity})
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    def benchmark(self, test_texts):
        """性能基准测试"""
        start_time = time.time()
        for text in test_texts:
            self.predict(text)
        elapsed = time.time() - start_time
        avg_time = elapsed / len(test_texts) * 1000
        print(f"TextCNN Benchmark: {len(test_texts)} samples, Avg: {avg_time:.2f} ms/sample")
        return avg_time


if __name__ == "__main__":
    matcher = IntentMatcher()
    test_texts = [
        "何鑫上课发言",
        "张三迟到",
        "李四积极回答问题",
        "王五帮助同学",
        "赵六打架",
        "他主动擦黑板",
        "她作业完成得很好",
        "这个同学表现优秀",
        "李明上课睡觉",
        "钱七打扫卫生",
    ]
    print("=" * 60)
    print("TextCNN意图分类测试")
    print("=" * 60)
    for text in test_texts:
        result = matcher.predict(text)
        print(f"文本: '{text}'")
        print(f"  意图: {result['intent']}, 置信度: {result['confidence']:.3f}")
        print(f"  CNN意图: {result['cnn_intent']} ({result['cnn_confidence']:.3f})")
        print(f"  规则意图: {result['rule_intent']} ({result['rule_confidence']:.3f})")
        for k, v in result["matches"].items():
            if v:
                print(f"  {k}匹配: {', '.join(v)}")
        print()
    matcher.benchmark(test_texts)
    print("\n" + "=" * 60)
    print("语义相似度测试")
    print("=" * 60)
    test_pairs = [
        ("上课发言", "主动回答老师问题"),
        ("上课发言", "在课堂上说话"),
        ("迟到", "按时到达"),
        ("帮助同学", "协助其他同学"),
        ("打架", "与同学争吵"),
    ]
    for text1, text2 in test_pairs:
        similarity = matcher.cnn.cosine_similarity(text1, text2)
        print(f"'{text1}' vs '{text2}' -> 相似度: {similarity:.3f}")
