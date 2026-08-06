import time
import json
import threading
from typing import List, Dict, Optional
from config.config_loader import config_loader
import redis
import hashlib

"""
NLP性能优化服务

-模型预热与缓存
-批量推理优化
-Redis结果缓存
-响应时间监控
"""


class NLPCache:
    """NLP结果缓存"""

    def __init__(self):
        self._redis = None
        self._local_cache = {}
        self._cache_ttl = config_loader.get_config("CACHE_TTL", {}).get("nlp_result", 300)
        self._max_local_cache = 1000
        self._lock = threading.Lock()
        try:
            self._redis = redis.Redis(
                host=config_loader.get("REDIS_HOST", "localhost"),
                port=config_loader.get("REDIS_PORT", 6379),
                db=config_loader.get("REDIS_DB", 0),
                socket_timeout=5,
            )  # noqa: E501
            self._redis.ping()
            self._redis_available = True
        except Exception:
            self._redis_available = False

    def _hash_text(self, text: str) -> str:
        """生成文本缓存键"""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def get(self, text: str) -> Optional[Dict]:
        """获取缓存结果"""
        key = f"nlp:{self._hash_text(text)}"
        with self._lock:
            if key in self._local_cache:
                return self._local_cache[key]
        if self._redis_available:
            try:
                result = self._redis.get(key)
                if result:
                    data = json.loads(result)
                    with self._lock:
                        self._local_cache[key] = data
                    return data
            except Exception:
                pass
        return None

    def set(self, text: str, result: Dict):
        """设置缓存结果"""
        key = f"nlp:{self._hash_text(text)}"
        with self._lock:
            if len(self._local_cache) >= self._max_local_cache:
                self._local_cache.clear()
            self._local_cache[key] = result
        if self._redis_available:
            try:
                self._redis.setex(key, self._cache_ttl, json.dumps(result))
            except Exception:
                pass

    def batch_get(self, texts: List[str]) -> Dict[str, Optional[Dict]]:
        """批量获取缓存"""
        results = {}
        uncached_texts = []
        for text in texts:
            cached = self.get(text)
            if cached:
                results[text] = cached
            else:
                uncached_texts.append(text)
        return (results, uncached_texts)

    def batch_set(self, text_results: Dict[str, Dict]):
        """批量设置缓存"""
        for text, result in text_results.items():
            self.set(text, result)

    def clear(self):
        """清空缓存"""
        with self._lock:
            self._local_cache.clear()
        if self._redis_available:
            try:
                keys = self._redis.keys("nlp:*")
                if keys:
                    self._redis.delete(*keys)
            except Exception:
                pass


class NLPPerformanceOptimizer:
    """NLP性能优化器"""

    def __init__(self):
        self._cache = NLPCache()
        self._models_loaded = False
        self._warmup_done = False
        self._load_lock = threading.Lock()
        self._performance_stats = {
            "total_requests": 0,
            "cached_requests": 0,
            "avg_response_time": 0.0,
            "max_response_time": 0.0,
            "min_response_time": float("inf"),
        }
        self._bert_service = None
        self._nlp_ml_service = None
        self._nlp_parser_service = None

    def warmup(self):
        """模型预热"""
        if self._warmup_done:
            return
        print("[NLP优化器] 开始预热...")
        start_time = time.time()
        try:
            from services.bert_service import get_bert_service

            bert = get_bert_service()
            if bert.is_available():
                bert.warmup()
                self._bert_service = bert
        except Exception as e:
            print(f"[NLP优化器] BERT预热失败: {e}")
        try:
            from services.nlp_ml_service import NLPMLService

            ml_service = NLPMLService()
            ml_service.load_models(["logistic_regression", "svm"])
            self._nlp_ml_service = ml_service
        except Exception as e:
            print(f"[NLP优化器] ML模型预热失败: {e}")
        try:
            from services.nlp_parser_service import NLPParserService

            parser = NLPParserService()
            warmup_texts = ["张三加分", "李四扣2分", "查询王五分数"]
            for text in warmup_texts:
                parser.parse(text)
            self._nlp_parser_service = parser
        except Exception as e:
            print(f"[NLP优化器] 解析器预热失败: {e}")
        self._warmup_done = True
        self._models_loaded = True
        common_queries = [
            ("张三加分", {"intent": "add", "name": "张三", "score": 1}),
            ("李四扣2分", {"intent": "deduct", "name": "李四", "score": 2}),
            ("查询王五分数", {"intent": "query", "name": "王五"}),
            ("给小明加5分", {"intent": "add", "name": "小明", "score": 5}),
        ]
        for text, expected in common_queries:
            self._cache.set(text, expected)
        elapsed = time.time() - start_time
        print(f"[NLP优化器] 预热完成! 耗时: {elapsed:.2f}s")

    def parse_with_cache(self, text: str, parser_func) -> Dict:
        """带缓存的解析"""
        self._performance_stats["total_requests"] += 1
        cached = self._cache.get(text)
        if cached:
            self._performance_stats["cached_requests"] += 1
            return cached
        start_time = time.time()
        result = parser_func(text)
        elapsed = time.time() - start_time
        self._update_stats(elapsed)
        if result:
            self._cache.set(text, result)
        return result

    def batch_parse(self, texts: List[str], parser_func) -> List[Dict]:
        """批量解析优化"""
        results = []
        cached_results, uncached_texts = self._cache.batch_get(texts)
        if uncached_texts:
            start_time = time.time()
            new_results = {}
            for text in uncached_texts:
                result = parser_func(text)
                if result:
                    new_results[text] = result
            elapsed = time.time() - start_time
            if uncached_texts:
                self._update_stats(elapsed / len(uncached_texts))
            self._cache.batch_set(new_results)
            cached_results.update(new_results)
        for text in texts:
            results.append(cached_results.get(text, {"intent": "unknown"}))
        return results

    def _update_stats(self, elapsed: float):
        """更新性能统计"""
        stats = self._performance_stats
        stats["max_response_time"] = max(stats["max_response_time"], elapsed)
        stats["min_response_time"] = min(stats["min_response_time"], elapsed)
        total = stats["total_requests"]
        current_avg = stats["avg_response_time"]
        if total > 0:
            stats["avg_response_time"] = (current_avg * (total - 1) + elapsed) / total

    def get_stats(self) -> Dict:
        """获取性能统计"""
        stats = self._performance_stats.copy()
        stats["cache_size"] = len(self._cache._local_cache)
        stats["cache_hit_rate"] = (
            stats["cached_requests"] / stats["total_requests"] if stats["total_requests"] > 0 else 0
        )
        stats["models_loaded"] = self._models_loaded
        stats["warmup_done"] = self._warmup_done
        return stats

    def get_service(self, service_type: str):
        """获取已预热的服务实例"""
        services = {"bert": self._bert_service, "ml": self._nlp_ml_service, "parser": self._nlp_parser_service}
        return services.get(service_type)


_nlp_optimizer = None


def get_nlp_optimizer() -> NLPPerformanceOptimizer:
    """获取NLP优化器实例"""
    global _nlp_optimizer
    if _nlp_optimizer is None:
        _nlp_optimizer = NLPPerformanceOptimizer()
    return _nlp_optimizer


def warmup_nlp():
    """预热NLP服务"""
    optimizer = get_nlp_optimizer()
    optimizer.warmup()
