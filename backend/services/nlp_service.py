from typing import Dict, Optional, Any, List
from enum import Enum


import concurrent.futures
import hashlib
import threading


from utils.logger import log_info, log_warning, log_debug
class NLPParserType(Enum):
    RULE_BASED = "rule_based"
    ML_BASED = "ml_based"
    ENHANCED = "enhanced"


class NLPIntent(Enum):
    ADD = "add"
    DEDUCT = "deduct"
    QUERY = "query"
    TRANSFER = "transfer"
    UNKNOWN = "unknown"


class NLPService:
    _instance = None
    _instance_lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
                    cls._instance._parse_cache = {}
                    cls._instance._cache_lock = threading.Lock()
                    cls._instance._cache_hits = 0
                    cls._instance._cache_misses = 0
                    cls._instance._cache_max_size = 5000
                    cls._instance._redis_cache = None
                    cls._instance.parser_type = NLPParserType.ENHANCED
                    cls._instance._flask_app = None
        return cls._instance

    def initialize(
        self,
        parser_type: NLPParserType = NLPParserType.ENHANCED,
        flask_app=None,
    ):
        if self._initialized:
            return

        self.parser_type = parser_type
        self._flask_app = flask_app
        self._parsers = {}
        self._initialize_parsers()
        self._initialize_redis_cache()
        self._initialized = True
        log_info(f"NLP统一服务门面已初始化，使用解析器: {parser_type.value}")

    def set_flask_app(self, flask_app):
        self._flask_app = flask_app

    def _initialize_redis_cache(self):
        try:
            from services.redis_cache_service import get_cache_service

            self._redis_cache = get_cache_service()
            log_info("NLP服务已连接Redis缓存（二级缓存）")
        except Exception as e:
            log_warning(f"NLP服务Redis缓存连接失败: {e}", exception=e)
            self._redis_cache = None

    def _initialize_parsers(self):
        self._parsers = {}
        self._parser_instances = {}
        self._fast_parser = None
        self._start_fast_parser_async()

    def _start_fast_parser_async(self):

        def load_fast_parser():
            try:
                from services.nlp_fast_parser import FastNLPParser

                self._fast_parser = FastNLPParser()
                log_info("NLP轻量级解析器已加载（快速路径）")
            except Exception as e:
                log_warning(f"NLP轻量级解析器加载失败: {e}", exception=e)
                self._fast_parser = None

        thread = threading.Thread(target=load_fast_parser, daemon=True)
        thread.start()

    def _get_parser_instance(self, parser_type: NLPParserType) -> Any:
        if parser_type in self._parser_instances:
            return self._parser_instances[parser_type]

        try:
            if parser_type == NLPParserType.RULE_BASED:
                from services.nlp_parser_service import NLPParserService

                parser = NLPParserService()
                log_info("NLP规则解析器已加载")
            elif parser_type == NLPParserType.ENHANCED:
                from services.nlp_enhanced_service import EnhancedNLPParserService

                parser = EnhancedNLPParserService()
                log_info("NLP增强解析器已加载")
            elif parser_type == NLPParserType.ML_BASED:
                # P0-2 修复：ml_based 为潜伏死分支——NLPMLTrainingService 仅有 predict* 方法，
                # 无 parse()，调用必抛 AttributeError。门面禁用其经 API 触达，返回 None 由
                # 调用方降级为“解析器不可用”（见 parse() 中 if not parser 分支）。
                log_info("NLP机器学习解析器(ml_based)尚未实现 parse()，已禁用")
                return None
            else:
                return None

            self._parser_instances[parser_type] = parser
            return parser
        except Exception as e:
            log_warning(f"加载{parser_type.value}解析器失败: {e}", exception=e)
            return None

    def get_parser(self, parser_type: Optional[NLPParserType] = None) -> Any:
        pt = parser_type or self.parser_type
        return self._get_parser_instance(pt)

    def _get_cache_key(self, text: str, parser_type: Optional[NLPParserType] = None) -> str:
        pt = parser_type or self.parser_type
        cache_key = f"{text}:{pt.value}"
        return hashlib.sha256(cache_key.encode()).hexdigest()

    def _cache_parse_result(
        self,
        text: str,
        parser_type: Optional[NLPParserType],
        result: Dict[str, Any],
    ):
        key = self._get_cache_key(text, parser_type)
        with self._cache_lock:
            if len(self._parse_cache) >= self._cache_max_size:
                oldest_key = next(iter(self._parse_cache))
                del self._parse_cache[oldest_key]
            self._parse_cache[key] = result

    def parse(self, text: str, parser_type: Optional[NLPParserType] = None) -> Dict[str, Any]:
        cache_key = self._get_cache_key(text, parser_type)
        redis_key = f"nlp_parse:{cache_key}"

        with self._cache_lock:
            cached = cache_key in self._parse_cache
        if cached:
            self._cache_hits += 1
            with self._cache_lock:
                result = self._parse_cache[cache_key].copy()
            result["cached"] = True
            result["cache_layer"] = "memory"
            return result

        if self._redis_cache:
            redis_result = self._redis_cache.get(redis_key)
            if redis_result is not None:
                self._cache_hits += 1
                self._cache_parse_result(text, parser_type, redis_result)
                result = redis_result.copy()  # noqa: F841
                result["cached"] = True
                result["cache_layer"] = "redis"
                return result

        self._cache_misses += 1

        if self._fast_parser and not parser_type:
            fast_result = self._fast_parser.parse(text)
            if fast_result["success"] and fast_result["confidence"] >= 0.6:
                fast_result["cached"] = False
                fast_result["cache_layer"] = "none"
                self._cache_parse_result(text, parser_type, fast_result)
                if self._redis_cache:
                    self._redis_cache.set(redis_key, fast_result, ttl=300)
                return fast_result

        parser = self.get_parser(parser_type)
        if not parser:
            return {
                "success": False,
                "intent": NLPIntent.UNKNOWN.value,
                "message": "解析器不可用",
                "cached": False,
                "cache_layer": "none",
            }

        try:
            if self._flask_app:
                with self._flask_app.app_context():
                    result = parser.parse(text)  # noqa: F841
            else:
                result = parser.parse(text)  # noqa: F841

            if isinstance(result, dict):
                pt = parser_type or self.parser_type
                result["parser_type"] = pt.value
                result["cached"] = False
                result["cache_layer"] = "none"
                self._cache_parse_result(text, parser_type, result)
                if self._redis_cache:
                    self._redis_cache.set(redis_key, result, ttl=300)
                return result
            return {
                "success": False,
                "intent": NLPIntent.UNKNOWN.value,
                "message": "解析结果格式错误",
                "cached": False,
                "cache_layer": "none",
            }
        except Exception as e:
            return {
                "success": False,
                "intent": NLPIntent.UNKNOWN.value,
                "message": f"解析失败: {str(e)}",
                "cached": False,
                "cache_layer": "none",
            }

    def parse_batch(
        self, texts: List[str], parser_type: Optional[NLPParserType] = None
    ) -> List[Dict[str, Any]]:
        if not texts:
            return []

        if len(texts) <= 3:
            results = []
            for text in texts:
                results.append(self.parse(text, parser_type))
            return results

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(texts))) as executor:
            futures = [executor.submit(self.parse, text, parser_type) for text in texts]
            concurrent.futures.wait(futures, timeout=60)
            results = [
                (
                    f.result()
                    if f.done()
                    else {
                        "success": False,
                        "intent": NLPIntent.UNKNOWN.value,
                        "message": "解析超时",
                        "cached": False,
                        "cache_layer": "none",
                    }
                )
                for f in futures
            ]
            return results

    def optimize(self, text: str) -> Dict[str, Any]:
        try:
            from services.nlp_optimizer import NLPOptimizer

            optimizer = NLPOptimizer()
            return optimizer.optimize(text)
        except Exception as e:
            return {"success": False, "message": f"优化失败: {str(e)}"}

    def get_stats(self) -> Dict[str, Any]:
        total = self._cache_hits + self._cache_misses
        hit_rate = round(self._cache_hits / total * 100, 2) if total > 0 else 0
        stats = {
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "cache_hit_rate": f"{hit_rate}%",
            "cache_size": len(self._parse_cache),
            "cache_max_size": self._cache_max_size,
        }
        try:
            from services.nlp_enhanced_service import get_parser_stats

            parser_stats = get_parser_stats()
            stats.update(parser_stats)
        except Exception:
            pass
        return stats

    def clear_cache(self):
        with self._cache_lock:
            self._parse_cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0
        if self._redis_cache:
            try:
                self._redis_cache.flush(pattern="nlp_parse:*")
                log_info("NLP解析Redis缓存已清空")
            except Exception as e:
                log_warning(f"NLP解析Redis缓存清空失败: {e}", exception=e)
        log_info("NLP解析内存缓存已清空")

    def warmup(self, texts: Optional[List[str]] = None):
        warmup_texts = texts or [
            "给张三加分",
            "李四迟到扣2分",
            "查询王五的分数",
            "因为迟到李华被扣分",
            "赵六做好事加10分",
            "作业没交扣5分",
        ]
        log_info("NLP服务预热中...")

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                futures = [executor.submit(self.parse, text) for text in warmup_texts]
                concurrent.futures.wait(futures, timeout=30)

            log_info("NLP服务预热完成")
        except Exception as e:
            log_warning(f"NLP服务预热失败: {e}", exception=e)

    def async_warmup(self, texts: Optional[List[str]] = None):
        """异步预热，不阻塞主线程"""
        thread = threading.Thread(target=self.warmup, args=(texts,), daemon=True)
        thread.start()

    def shutdown(self):
        self._initialized = False
        self._parsers = {}
        log_info("NLP统一服务门面已关闭")


nlp_service = NLPService()


def get_nlp_service() -> NLPService:
    return nlp_service


def init_nlp_service(parser_type: str = "enhanced"):
    try:
        pt = NLPParserType(parser_type)
        nlp_service.initialize(pt)
        nlp_service.warmup()
        return True
    except ValueError:
        log_warning(f"无效的解析器类型: {parser_type}")
        return False
