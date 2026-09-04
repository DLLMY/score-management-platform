import os
import time
import psutil
import numpy as np
from typing import List, Tuple, Dict

try:
    import torch

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

"""
BERT服务模块 - 意图分类与语义相似度计算
基于bert-base-chinese模型，支持INT8量化、预热和批量推理
"""
try:
    from transformers import AutoTokenizer, AutoModel

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False


from utils.logger import log_info, log_warning, log_debug
class BertNLPService:
    def __init__(self, model_path: str = None, use_quantization: bool = True):
        self.model_path = model_path or os.path.join(
            os.path.dirname(__file__), "..", "models", "bert"
        )
        self.use_quantization = use_quantization
        self.tokenizer = None
        self.model = None
        self._initialized = False
        self._warmup_done = False
        self._load_time = 0.0
        self._memory_usage = 0.0
        self.intent_labels = {
            0: "add",
            1: "deduct",
            2: "query",
            3: "reset",
            4: "unknown",
        }
        self.intent_keywords = {
            "add": [
                "表扬",
                "奖励",
                "加分",
                "发言",
                "回答",
                "帮助",
                "优秀",
                "主动",
                "积极",
                "认真",
                "努力",
                "进步",
                "表现好",
                "完成作业",
                "打扫",
                "擦黑板",
                "值日",
            ],
            "deduct": [
                "批评",
                "惩罚",
                "扣分",
                "迟到",
                "早退",
                "旷课",
                "睡觉",
                "说话",
                "打架",
                "顶嘴",
                "破坏",
                "偷懒",
                "未完成",
                "不交",
                "走神",
            ],
            "query": [
                "查询",
                "查看",
                "多少分",
                "积分",
                "成绩",
                "排名",
                "多少",
                "怎么样",
                "如何",
            ],
            "reset": ["重置", "清零", "归零", "重新计算"],
        }
        if TRANSFORMERS_AVAILABLE and os.path.exists(self.model_path):
            self._load_model()

    def _load_model(self):
        try:
            start_time = time.time()
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_path, revision="main"  # nosec
            )
            self.model = AutoModel.from_pretrained(self.model_path, revision="main")  # nosec
            if self.use_quantization and TORCH_AVAILABLE:
                try:
                    self.model = torch.quantization.quantize_dynamic(
                        self.model, {torch.nn.Linear}, dtype=torch.qint8
                    )
                    log_info("PyTorch动态量化成功")
                except Exception as e:
                    log_warning(f"动态量化失败: {e}", exception=e)
                    self.use_quantization = False
            self.model.eval()
            self._initialized = True
            self._load_time = time.time() - start_time
            try:
                process = psutil.Process()
                self._memory_usage = process.memory_info().rss / 1024 / 1024
            except Exception:
                pass
            log_info(
                (
                    f"BERT模型加载成功! 量化: {self.use_quantization}, "
                    f"耗时: {self._load_time:.2f}s, "
                    f"内存: {self._memory_usage:.0f}MB"
                )
            )
        except Exception as e:
            log_warning(f"BERT模型加载失败: {e}", exception=e)
            self._initialized = False

    def warmup(self):
        if not self._initialized:
            return
        if self._warmup_done:
            return
        log_info("BERT模型预热中...")
        start_time = time.time()
        warmup_texts = ["上课发言", "迟到", "帮助同学", "打架", "认真听讲"]
        for text in warmup_texts:
            self.get_embedding(text)
        self._warmup_done = True
        log_info(f"BERT预热完成! 耗时: {time.time() - start_time:.2f}s")

    def is_available(self) -> bool:
        return self._initialized

    def get_stats(self) -> Dict:
        return {
            "initialized": self._initialized,
            "warmup_done": self._warmup_done,
            "load_time": self._load_time,
            "memory_usage": self._memory_usage,
            "use_quantization": self.use_quantization,
        }

    def get_embedding(self, text: str) -> np.ndarray:
        if not self._initialized:
            return None
        try:
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=64,
            )
            with torch.no_grad():
                outputs = self.model(**inputs)
            embedding = outputs.last_hidden_state.mean(dim=1).cpu().numpy()[0]
            return embedding
        except Exception as e:
            log_warning(f"获取向量失败: {e}", exception=e)
            return None

    def batch_get_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        if not self._initialized:
            return [None] * len(texts)
        try:
            inputs = self.tokenizer(
                texts,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=64,
            )
            with torch.no_grad():
                outputs = self.model(**inputs)
            embeddings = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
            return [embeddings[i] for i in range(len(texts))]
        except Exception as e:
            log_warning(f"批量获取向量失败: {e}", exception=e)
            return [None] * len(texts)

    def predict_intent(self, text: str) -> Tuple[str, float]:
        if not self._initialized:
            return "unknown", 0.0
        embedding = self.get_embedding(text)
        if embedding is None:
            return "unknown", 0.0
        keyword_scores = {}
        for intent, keywords in self.intent_keywords.items():
            score = 0
            for keyword in keywords:
                if keyword in text:
                    score += 1
            keyword_scores[intent] = score
        intent_confidence = {}
        for intent in self.intent_keywords.keys():
            intent_keywords_text = " ".join(self.intent_keywords[intent])
            intent_embedding = self.get_embedding(intent_keywords_text)
            if intent_embedding is not None:
                similarity = self._cosine_sim(embedding, intent_embedding)
                keyword_bonus = keyword_scores[intent] * 0.1
                intent_confidence[intent] = similarity + keyword_bonus
        if intent_confidence:
            best_intent = max(intent_confidence, key=intent_confidence.get)
            confidence = intent_confidence[best_intent]
            if confidence > 0.6:
                return best_intent, min(confidence, 1.0)
            elif confidence > 0.4:
                return best_intent, min(confidence, 1.0)
        return "unknown", 0.0

    def batch_predict_intent(self, texts: List[str]) -> List[Tuple[str, float]]:
        if not self._initialized:
            return [("unknown", 0.0)] * len(texts)
        results = []
        for text in texts:
            results.append(self.predict_intent(text))
        return results

    def calculate_similarity(self, text1: str, text2: str) -> float:
        if not self._initialized:
            return 0.0
        emb1 = self.get_embedding(text1)
        emb2 = self.get_embedding(text2)
        if emb1 is None or emb2 is None:
            return 0.0
        return self._cosine_sim(emb1, emb2)

    def batch_calculate_similarity(self, texts: List[str], target: str) -> List[float]:
        if not self._initialized:
            return [0.0] * len(texts)
        target_emb = self.get_embedding(target)
        if target_emb is None:
            return [0.0] * len(texts)
        text_embeddings = self.batch_get_embeddings(texts)
        similarities = []
        for emb in text_embeddings:
            if emb is not None:
                similarities.append(self._cosine_sim(emb, target_emb))
            else:
                similarities.append(0.0)
        return similarities

    def _cosine_sim(self, a: np.ndarray, b: np.ndarray) -> float:
        try:
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return np.dot(a, b) / (norm_a * norm_b)
        except Exception as e:
            log_warning(f"[BERT] 余弦相似度计算异常，回退 0.0: {e}", exception=e)
            return 0.0

    def analyze_sentiment(self, text: str) -> Dict:
        if not self._initialized:
            return {"positive": 0, "negative": 0, "neutral": 0, "score": 0.0}
        positive_words = [
            "表扬",
            "奖励",
            "优秀",
            "进步",
            "认真",
            "努力",
            "积极",
            "主动",
            "帮助",
            "良好",
            "出色",
            "完成",
        ]
        negative_words = [
            "批评",
            "惩罚",
            "迟到",
            "早退",
            "旷课",
            "打架",
            "顶嘴",
            "破坏",
            "偷懒",
            "未完成",
        ]
        positive_count = sum(1 for w in positive_words if w in text)
        negative_count = sum(1 for w in negative_words if w in text)
        total = positive_count + negative_count
        if total == 0:
            return {"positive": 0, "negative": 0, "neutral": 1, "score": 0.0}
        return {
            "positive": positive_count / total,
            "negative": negative_count / total,
            "neutral": 0,
            "score": (positive_count - negative_count) / total,
        }


bert_service = None


def get_bert_service() -> BertNLPService:
    global bert_service
    if bert_service is None:
        bert_service = BertNLPService(use_quantization=True)
    return bert_service


def initialize_bert_service(warmup: bool = False) -> bool:
    global bert_service
    bert_service = BertNLPService(use_quantization=True)
    if warmup and bert_service.is_available():
        bert_service.warmup()
    return bert_service.is_available()
