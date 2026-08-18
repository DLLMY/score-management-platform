from typing import Dict, Optional, Any
from functools import lru_cache
import re

"""
NLP轻量级解析器 - 快速路径
基于规则匹配的快速解析器，用于处理简单语句
对于复杂语句自动降级到完整解析器

特点：
- 无需加载深度学习模型
- 解析速度 < 20ms
- 支持常见意图的快速匹配
- 可扩展的规则系统
"""


class FastNLPParser:
    """轻量级NLP解析器"""

    def __init__(self):
        self._intent_patterns = {
            "add": [
                re.compile(r"(?:加|奖励|表扬|加分|加积分|给.*加分)", re.IGNORECASE),
                re.compile(
                    r"(?:积极|主动|优秀|良好|进步|认真|努力|帮助)",
                    re.IGNORECASE,
                ),
                re.compile(r"(?:发言|回答|作业|值日|打扫|擦黑板)", re.IGNORECASE),
            ],
            "deduct": [
                re.compile(r"(?:扣|处罚|批评|扣分|扣积分|给.*扣分)", re.IGNORECASE),
                re.compile(r"(?:迟到|早退|旷课|睡觉|说话|打架|顶嘴)", re.IGNORECASE),
                re.compile(r"(?:未完成|不交|偷懒|破坏|走神)", re.IGNORECASE),
            ],
            "query": [
                re.compile(r"(?:查|查询|查看|多少分|积分|分数)", re.IGNORECASE),
                re.compile(r"(?:排名|统计|成绩)", re.IGNORECASE),
            ],
            "reset": [
                re.compile(r"(?:重置|清零|归零|重新计算)", re.IGNORECASE),
            ],
        }

        self._name_patterns = [
            re.compile(r"(?:给|为|对|把)([\u4e00-\u9fa5]{2,4}?)(?:的)?"),
            re.compile(r"(?:查询|查看|显示|看看|展示)([\u4e00-\u9fa5]{2,4})的"),
            re.compile(
                r"([\u4e00-\u9fa5]{2,4})(?:迟到|早退|旷课|上课|作业|做好事|帮助|发言|回答|值日|打扫)"
            ),
            re.compile(r"([\u4e00-\u9fa5]{2,4})(?:加|扣)(?:[\d分])"),
            re.compile(r"(?:姓名|名字|同学)[：:]?([\u4e00-\u9fa5]{2,4})"),
            re.compile(r"([\u4e00-\u9fa5]{2,4})的?分"),
            re.compile(r"([\u4e00-\u9fa5]{2,4})(?:同学)?"),
        ]

        self._score_patterns = [
            re.compile(r"([+-]?\d+(?:\.\d+)?)\s*(?:分|积分)"),
            re.compile(r"(?:加|扣)([+-]?\d+(?:\.\d+)?)"),
        ]

        self._description_patterns = [
            re.compile(r"(?:因为|由于|原因)[：:](.*)"),
            re.compile(r"(?:迟到|早退|旷课|作业|发言|回答|帮助|打扫)(.*)"),
        ]

        self._quick_intent_keywords = {
            "add": {
                "加",
                "奖励",
                "表扬",
                "加分",
                "积极",
                "主动",
                "优秀",
                "良好",
                "进步",
                "认真",
                "努力",
                "帮助",
                "发言",
                "回答",
                "作业",
                "值日",
                "打扫",
                "擦黑板",
                "助人为乐",
                "团结",
            },
            "deduct": {
                "扣",
                "处罚",
                "批评",
                "扣分",
                "迟到",
                "早退",
                "旷课",
                "睡觉",
                "说话",
                "打架",
                "顶嘴",
                "未完成",
                "不交",
                "偷懒",
                "破坏",
                "走神",
                "违纪",
                "违规",
            },
            "query": {
                "查",
                "查询",
                "查看",
                "多少分",
                "积分",
                "分数",
                "排名",
                "统计",
                "成绩",
            },
            "reset": {"重置", "清零", "归零", "重新计算"},
        }

        self._cache = {}
        self._cache_max_size = 10000

        print("[FastNLPParser] 轻量级解析器已初始化")

    def _extract_name(self, text: str) -> Optional[str]:
        """从文本中提取姓名"""
        for pattern in self._name_patterns:
            match = pattern.search(text)
            if match:
                name = match.group(1).strip()
                if len(name) >= 2 and len(name) <= 4:
                    name = self._validate_name(name, text, match.start(1), match.end(1))
                    if name:
                        return name
        return None

    def _validate_name(self, name: str, text: str, start_pos: int, end_pos: int) -> Optional[str]:
        """验证姓名是否有效，排除行为关键词"""
        intent_keywords = set()
        for keywords in self._quick_intent_keywords.values():
            intent_keywords.update(keywords)

        # 单字动词兜底剥离（如「给张三加5分」捕获到「张三加」时，剔除末尾单字动词）
        single_char_verbs = {"加", "扣", "减"}
        if name and name[-1:] in single_char_verbs:
            candidate = name[:-1]
            if len(candidate) >= 2:
                return candidate

        for kw in intent_keywords:
            if kw in name and len(kw) > 1:
                if name.endswith(kw):
                    new_name = name[: -len(kw)]
                    if len(new_name) >= 2:
                        return new_name
                elif name.startswith(kw):
                    new_name = name[len(kw) :]
                    if len(new_name) >= 2:
                        return new_name

        if end_pos < len(text):
            next_char = text[end_pos]
            if next_char in "\u4e00-\u9fa5":
                if next_char not in "，。！？、 的":
                    remaining_text = text[end_pos:]
                    matched_behavior = False
                    for kw in intent_keywords:
                        if remaining_text.startswith(kw):
                            matched_behavior = True
                            break
                    if not matched_behavior:
                        return None

        return name

    def _extract_score(self, text: str) -> Optional[float]:
        """从文本中提取分数"""
        for pattern in self._score_patterns:
            match = pattern.search(text)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue
        return None

    def _extract_description(self, text: str) -> Optional[str]:
        """从文本中提取描述"""
        for pattern in self._description_patterns:
            match = pattern.search(text)
            if match:
                desc = match.group(1).strip()
                if desc:
                    return desc
        return None

    def _detect_intent(self, text: str) -> str:
        """检测意图"""
        for intent, keywords in self._quick_intent_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    return intent

        for intent, patterns in self._intent_patterns.items():
            for pattern in patterns:
                if pattern.search(text):
                    return intent

        return "unknown"

    def _is_simple_text(self, text: str) -> bool:
        """判断是否为简单文本（可使用快速路径）"""
        if len(text) > 50:
            return False

        has_name = any(pattern.search(text) for pattern in self._name_patterns)
        has_score = any(pattern.search(text) for pattern in self._score_patterns)
        has_intent = any(
            kw in text
            for kw in [k for keywords in self._quick_intent_keywords.values() for k in keywords]
        )

        return has_name or has_score or has_intent

    @lru_cache(maxsize=1000)
    def parse(self, text: str) -> Dict[str, Any]:
        """
        解析文本，返回解析结果

        返回格式：
        {
            'success': bool,
            'intent': str,
            'name': str,
            'score': float,
            'description': str,
            'confidence': float,
            'parser_type': 'fast',
            'is_simple': bool
        }
        """
        text = text.strip()
        if not text:
            return {
                "success": False,
                "intent": "unknown",
                "name": None,
                "score": None,
                "description": None,
                "confidence": 0.0,
                "parser_type": "fast",
                "is_simple": False,
            }

        is_simple = self._is_simple_text(text)

        if not is_simple:
            return {
                "success": False,
                "intent": "unknown",
                "name": None,
                "score": None,
                "description": None,
                "confidence": 0.0,
                "parser_type": "fast",
                "is_simple": False,
            }

        intent = self._detect_intent(text)
        name = self._extract_name(text)
        score = self._extract_score(text)
        description = self._extract_description(text)

        if score is None:
            if intent == "add":
                score = 1.0
            elif intent == "deduct":
                score = -1.0

        confidence = self._calculate_confidence(intent, name, score)

        return {
            "success": True,
            "intent": intent,
            "name": name,
            "extracted_name": name,
            "score": score,
            "description": description,
            "confidence": confidence,
            "parser_type": "fast",
            "is_simple": True,
        }

    def _calculate_confidence(
        self, intent: str, name: Optional[str], score: Optional[float]
    ) -> float:
        """计算置信度"""
        factors = []

        if intent != "unknown":
            factors.append(0.4)

        if name:
            factors.append(0.3)

        if score is not None:
            factors.append(0.3)

        return min(1.0, sum(factors))

    def batch_parse(self, texts: list) -> list:
        """批量解析"""
        results = []
        for text in texts:
            results.append(self.parse(text))
        return results

    def can_handle(self, text: str) -> bool:
        """判断是否可以处理该文本"""
        return self._is_simple_text(text)

    def get_stats(self) -> Dict[str, Any]:
        """获取解析器统计信息"""
        return {
            "parser_type": "fast",
            "cache_size": self.parse.cache_info().currsize,
            "cache_hits": self.parse.cache_info().hits,
            "cache_misses": self.parse.cache_info().misses,
            "intent_patterns_count": sum(len(p) for p in self._intent_patterns.values()),
            "name_patterns_count": len(self._name_patterns),
            "score_patterns_count": len(self._score_patterns),
        }

    def clear_cache(self):
        """清空缓存"""
        self.parse.cache_clear()
        print("[FastNLPParser] 缓存已清空")


fast_parser = FastNLPParser()


def get_fast_parser() -> FastNLPParser:
    """获取轻量级解析器实例"""
    return fast_parser
