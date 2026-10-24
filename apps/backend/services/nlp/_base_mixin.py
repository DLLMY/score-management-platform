import logging
import math
import os
import pickle
import re
import threading
from datetime import date, datetime, timedelta

import jieba
import numpy as np
from numpy import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split

from config.config_loader import config_loader
from models import (
    NLPBehaviorKeyword,
    NLPMatchResult,
    NLPRuleUsage,
    NLPScoringRule,
    User,
    db,
    get_by_id,
)
from services.nlp._shared import (
    _DEFAULT_INVALID_NAMES,
    _DEFAULT_NAME_PREFIX_WORDS,
    _DEFAULT_NEGATIVE_KEYWORDS,
    _DEFAULT_POSITIVE_KEYWORDS,
    _INTENT_TRAINING_SAMPLES,
    _coerce_dt,
)
from services.nlp.ml_intent_classifier import MLIntentClassifier
from utils.logger import log_debug, log_warning


class _BaseMixin:
    """NLP 解析服务按领域拆分出的 mixin（组合进 EnhancedNLPParserService，行为不变）。"""
    def __init__(self):
        self.jieba_initialized = False
        self._init_jieba()
        self._ml_service = (
            None  # T7: 懒加载，避免解析器初始化即导入 torch 重型链（见 _get_ml_service）
        )
        self.vectorizer = None
        self._load_vectorizer()
        self.intent_classifier = MLIntentClassifier()
        from services.textcnn_service import IntentMatcher

        self.textcnn_classifier = IntentMatcher()

        self._cache = {
            "users": None,
            "user_names": None,
            "name_to_id": None,
            "behavior_keywords": None,
            "rules_by_intent": {},
            "cache_time": 0,
            "cache_ttl": 300,
        }

        self._cached_models = {}

        self.bm25_params = {
            "k1": 1.5,
            "b": 0.75,
        }
        self.bm25_index = None

        self._load_config_from_loader()

        self._parse_cache = {}
        self._parse_cache_max_size = 500

        # BERT 语义相似度缓存（见 _compute_bert_similarities）
        # 规则向量按「规则文本签名」缓存（规则变更少，避免每次请求都过 BERT）；
        # 查询向量按输入文本缓存并限容，防止无限增长。
        self._bert_rule_embeddings = {"signature": None, "vectors": []}
        self._bert_text_cache = {}
        self._bert_text_cache_max_size = 512

        self.context_memory = {
            "recent_users": [],
            "recent_rules": [],
            "recent_intents": [],
            "max_memory_size": 10,
        }


    def _load_config_from_loader(self):
        self.position_weights = config_loader.get_position_weights() or {
            "start": 1.5,
            "middle": 1.0,
            "end": 1.3,
        }

        self.keyword_importance = config_loader.get_keyword_importance() or {
            "strong": 1.3,
            "medium": 1.0,
            "weak": 0.7,
        }

        self.invalid_names = config_loader.get_invalid_names() or _DEFAULT_INVALID_NAMES

        self.referral_words = config_loader.get_referral_words() or {
            "他": "male",
            "她": "female",
            "它": "neutral",
            "该同学": "neutral",
            "这位同学": "neutral",
            "那位同学": "neutral",
            "同学": "neutral",
        }

        keywords = config_loader.get_keywords()
        self.positive_keywords = set(keywords.get("positive", [])) or _DEFAULT_POSITIVE_KEYWORDS
        self.negative_keywords = set(keywords.get("negative", [])) or _DEFAULT_NEGATIVE_KEYWORDS
        self.intent_keywords = keywords.get("intent", {}) or {
            "add": [
                "加",
                "加分",
                "奖励",
                "表扬",
                "优秀",
                "好",
                "棒",
                "赞",
                "+",
                "给予",
                "发放",
                "授予",
            ],
            "deduct": [
                "扣",
                "扣分",
                "处罚",
                "批评",
                "差",
                "罚",
                "-",
                "扣除",
                "减去",
                "罚分",
            ],
            "query": [
                "查",
                "查询",
                "多少分",
                "积分",
                "分数",
                "查看",
                "统计",
                "显示",
                "看看",
                "展示",
                "列出",
                "成绩",
                "得分",
            ],
            "reset": ["重置", "清零", "归零", "重新计算"],
        }

        self.antonym_pairs = config_loader.get_antonym_pairs() or {
            "迟到": ["按时", "准时", "及时", "提前", "不迟到"],
            "早退": ["按时", "准时", "不早退", "坚持到最后"],
            "旷课": ["出席", "到场", "参加", "不旷课"],
            "睡觉": ["清醒", "精神", "专注", "不睡觉"],
            "说话": ["安静", "沉默", "不说话"],
            "走神": ["专注", "认真", "集中", "不走神"],
            "玩手机": ["认真听讲", "专注学习", "不玩手机"],
            "打架": ["和平", "友好", "不打架"],
            "骂人": ["礼貌", "友善", "不骂人"],
            "抄袭": ["原创", "独立完成", "不抄袭"],
            "作弊": ["诚实", "不作弊"],
            "撒谎": ["诚实", "说实话"],
            "偷懒": ["勤奋", "努力", "不偷懒"],
            "马虎": ["认真", "仔细", "细心"],
            "粗心": ["细心", "认真", "仔细"],
            "不交": ["交", "提交", "完成"],
            "未完成": ["完成", "已完成"],
            "差": ["好", "优秀", "出色"],
            "消极": ["积极", "主动"],
            "违规": ["遵守", "合规"],
            "违纪": ["守纪", "遵守"],
            "顶撞": ["尊重", "服从"],
            "不尊重": ["尊重", "尊敬"],
            "损坏": ["爱护", "保护"],
            "浪费": ["节约", "珍惜"],
            "逃避": ["面对", "承担"],
        }

        self._load_patterns_from_config()


    def _load_patterns_from_config(self):
        config_patterns = config_loader.get_name_patterns()
        if config_patterns:
            self.name_patterns = [re.compile(p) for p in config_patterns]
        else:
            self.name_patterns = [
                re.compile(r"^([\u4e00-\u9fa5]{3})(?:加|扣)\d+分"),
                re.compile(r"^([\u4e00-\u9fa5]{3})(?:同学)?(?:加|扣)分"),
                re.compile(r"^([\u4e00-\u9fa5]{2})(?:加|扣)\d+分"),
                re.compile(r"^([\u4e00-\u9fa5]{2})(?:同学)?(?:加|扣)分"),
                re.compile(
                    r"[\u4e00-\u9fa5]{1,2}老师(?:表扬了|批评了|奖励了|处罚了)"
                    r"([\u4e00-\u9fa5]{3})(?:同学)?"
                ),
                re.compile(
                    r"[\u4e00-\u9fa5]{1,2}老师(?:表扬了|批评了|奖励了|处罚了)"
                    r"([\u4e00-\u9fa5]{2})(?:同学)?"
                ),
                re.compile(
                    r"[\u4e00-\u9fa5]{1,2}老师(?:表扬|批评|奖励|处罚)"
                    r"([\u4e00-\u9fa5]{3})(?:同学)?"
                ),
                re.compile(
                    r"[\u4e00-\u9fa5]{1,2}老师(?:表扬|批评|奖励|处罚)"
                    r"([\u4e00-\u9fa5]{2})(?:同学)?"
                ),
                re.compile(r"(?:表扬|批评|奖励|惩罚)([\u4e00-\u9fa5]{2})(?:加|扣)\d+分"),
                re.compile(r"(?:表扬|批评|奖励|惩罚)([\u4e00-\u9fa5]{3})(?:加|扣)\d+分"),
                re.compile(
                    r"(?:奖励|惩罚|表扬|批评|处罚)了([\u4e00-\u9fa5]{2})(?:同学)?(?:\d+分)?$"
                ),
                re.compile(
                    r"(?:奖励|惩罚|表扬|批评|处罚)了([\u4e00-\u9fa5]{3})(?:同学)?(?:\d+分)?$"
                ),
                re.compile(r"(?:奖励|惩罚|表扬|批评|处罚)([\u4e00-\u9fa5]{2})(?:同学)?(?:\d+分)?$"),
                re.compile(r"(?:奖励|惩罚|表扬|批评|处罚)([\u4e00-\u9fa5]{3})(?:同学)?(?:\d+分)?$"),
                re.compile(
                    r"(?:查询|查看|显示|看看|展示)([\u4e00-\u9fa5]{2})的(?:分数|积分|得分|成绩)"
                ),
                re.compile(
                    r"(?:查询|查看|显示|看看|展示)([\u4e00-\u9fa5]{3})的(?:分数|积分|得分|成绩)"
                ),
                re.compile(
                    r"因为(?:迟到|早退|旷课|违纪|违规|睡觉|说话|玩手机)"
                    r"([\u4e00-\u9fa5]{2})(?:同学)?被(?:扣分|加分|扣\d+分|加\d+分)"
                ),
                re.compile(
                    r"因为(?:迟到|早退|旷课|违纪|违规|睡觉|说话|玩手机)"
                    r"([\u4e00-\u9fa5]{3})(?:同学)?被(?:扣分|加分|扣\d+分|加\d+分)"
                ),
                re.compile(
                    r"^([\u4e00-\u9fa5]{3})(?:同学)?"
                ),  # N2: 3字锚定优先于2字，避免未知3字名被截断
                re.compile(
                    r"([\u4e00-\u9fa5]{2})(?:同学|的|在|上课|今天|昨天|刚才|"
                    r"表现|作业|发言|迟到|早退|旷课|做了|完成|违反|积极|"
                    r"主动|认真|努力|优秀|良好|出色|进步)"
                ),
                re.compile(r"(?:是|为|给|对|让|发现|看到)([\u4e00-\u9fa5]{2})"),
                re.compile(r"([\u4e00-\u9fa5]{2})的(?:行为|表现|作业|课堂|情况|事情)"),
                re.compile(r"(?:学生|同学)([\u4e00-\u9fa5]{2})"),
                re.compile(r"^([\u4e00-\u9fa5]{2})(?:同学)?"),  # N2: 3字优先后的2字兜底
                re.compile(
                    r"([\u4e00-\u9fa5]{3})(?:同学|的|在|上课|今天|昨天|"
                    r"刚才|表现|作业|发言|迟到|早退|旷课)"
                ),
            ]

        self.name_prefix_words = config_loader.get_name_prefix_words() or _DEFAULT_NAME_PREFIX_WORDS

        self.name_suffix_words = config_loader.get_name_suffix_words() or {
            "同学",
            "同学的",
            "表现",
            "行为",
            "作业",
            "发言",
            "上课",
            "课堂",
            "迟到",
            "早退",
            "旷课",
            "睡觉",
            "说话",
            "玩手机",
            "打架",
            "顶嘴",
            "帮助",
            "回答",
            "提问",
            "参与",
            "完成",
            "遵守",
            "值日",
            "劳动",
            "擦黑板",
            "整理",
            "打扫",
            "听讲",
            "交作业",
            "完成作业",
            "参与活动",
            "表现好",
            "表现突出",
            "进步很大",
            "态度端正",
            "学习努力",
            "作业认真",
            "团结同学",
            "乐于助人",
            "诚实守信",
            "礼貌待人",
            "尊敬老师",
            "爱护公物",
        }

        self.behavior_patterns = config_loader.get_behavior_patterns() or {
            "迟到": [
                r"(?:迟到|晚到|迟到了)\s*(\d+)分钟?",
                r"(?:迟到|晚到|来晚)",
            ],
            "早退": [
                r"(?:早退|提前走)\s*(\d+)分钟?",
                r"(?:早退|提前离开|提早走)",
            ],
            "旷课": [r"(?:旷课|没来|缺席|未到|不来上课)"],
            "发言": [r"(?:发言|回答问题|回答|举手|主动回答|积极发言)"],
            "作业": [r"(?:作业|交作业|完成作业|未交作业|作业情况)"],
            "帮助": [r"(?:帮助|帮忙|协助|支援|救助)"],
            "打架": [r"(?:打架|斗殴|争吵|争执|动手)"],
            "打扫": [r"(?:打扫|清洁|卫生|打扫卫生)"],
            "玩手机": [r"(?:玩手机|看手机|玩手机游戏|手机不离手)"],
            "睡觉": [r"(?:睡觉|打瞌睡|打盹|睡着了)"],
            "吃东西": [r"(?:吃东西|吃零食|喝水|喝饮料)"],
            "说话": [r"(?:说话|聊天|讲话|交谈|小声说话)"],
            "走神": [r"(?:走神|发呆|开小差|注意力不集中)"],
            "抄袭": [r"(?:抄袭|抄作业|剽窃|作弊)"],
            "顶嘴": [r"(?:顶嘴|顶撞|反驳|不服从)"],
            "表扬": [r"(?:表扬|夸奖|称赞|赞赏)"],
            "批评": [r"(?:批评|指责|训斥|教育)"],
            "擦黑板": [r"(?:擦黑板|擦黑板|主动擦黑板|帮忙擦黑板)"],
            "值日": [r"(?:值日|做值日|打扫卫生|整理教室)"],
            "整理": [r"(?:整理|收拾|整理课桌|整理书包)"],
            "劳动": [r"(?:劳动|大扫除|卫生打扫|打扫教室)"],
            "遵守纪律": [r"(?:遵守纪律|遵守班规|遵守校规|守纪)"],
            "认真听讲": [r"(?:认真听讲|专心听讲|认真听课|专注听课)"],
            "按时完成": [r"(?:按时完成|准时完成|及时完成)"],
            "积极参与": [r"(?:积极参与|主动参与|踊跃参与)"],
        }

        # #2 深化：内置同义词词典（含新增课堂口语/近义表达）与配置合并，
        # 配置优先、内置补位，确保增量词典在任意部署下都生效（避免被 `or` 短路丢弃）。
        _syn_default = {
            "迟到": ["晚到", "来晚", "迟到了", "迟到几分钟"],
            "早退": ["提前走", "提早走", "提前离开"],
            "旷课": ["没来", "缺席", "未到"],
            "发言": [
                "回答问题",
                "举手",
                "主动回答",
                "回答老师",
                "回答问题",
                "课堂发言",
                "上课回答",
            ],
            "上课发言": [
                "回答问题",
                "举手发言",
                "主动回答",
                "课堂发言",
                "回答老师问题",
            ],
            "回答": ["发言", "回答问题", "回答老师", "回答问题"],
            "作业": ["交作业", "完成作业", "作业情况"],
            "帮助": ["帮忙", "协助", "支援"],
            "帮助同学": ["协助同学", "帮助其他同学", "帮忙同学"],
            "帮助老师": ["协助老师", "帮忙老师"],
            "打架": ["斗殴", "争吵", "争执"],
            "玩手机": ["看手机", "玩手机游戏"],
            "睡觉": ["打瞌睡", "打盹"],
            "吃东西": ["吃零食", "喝水"],
            "说话": ["聊天", "讲话"],
            "走神": ["发呆", "开小差"],
            "抄袭": ["抄作业", "剽窃"],
            "顶嘴": ["顶撞", "反驳"],
            "表扬": ["夸奖", "称赞"],
            "批评": ["指责", "训斥"],
            "擦黑板": ["擦黑板", "主动擦黑板", "帮忙擦黑板"],
            "值日": ["做值日", "打扫卫生", "整理教室"],
            "整理": ["收拾", "整理课桌", "整理书包"],
            "劳动": ["大扫除", "卫生打扫", "打扫教室"],
            "认真": ["专注", "专心", "用心"],
            "认真听讲": ["专心听讲", "认真听课", "专注听课"],
            "努力": ["勤奋", "刻苦", "用功"],
            "优秀": ["出色", "良好", "优异"],
            "进步": ["提升", "改进", "变好"],
            "调皮": ["捣蛋", "捣乱", "顽皮"],
            "违纪": ["违规", "违反纪律"],
            "整洁": ["干净", "整齐"],
            "礼貌": ["客气", "文明"],
            "团结": ["合作", "协作"],
            "创新": ["创意", "创造"],
            "负责": ["尽责", "担当"],
            "主动": ["积极", "自觉"],
            "诚实": ["老实", "真诚"],
            "勇敢": ["大胆", "无畏"],
            "耐心": ["忍耐", "坚持"],
            "细心": ["仔细", "认真"],
            "友善": ["友好", "亲切"],
            "自律": ["自觉", "自制"],
            "自信": ["信心", "坚信"],
            "乐观": ["开朗", "积极"],
            "懒惰": ["懒散", "怠惰"],
            "粗心": ["马虎", "大意"],
            "冷漠": ["冷淡", "无情"],
            "自私": ["自利", "利己"],
            "急躁": ["浮躁", "冲动"],
            "无理": ["蛮横", "霸道"],
            "傲慢": ["骄傲", "自大"],
            "侮辱": ["羞辱", "谩骂"],
            "威胁": ["恐吓", "胁迫"],
            "欺凌": ["欺负", "霸凌"],
            "损坏": ["破坏", "损毁"],
            "浪费": ["挥霍", "滥用"],
            "逃避": ["躲避", "逃避责任"],
            "到达": ["到校", "到教室", "来到", "抵达"],
            "准时": ["按时", "及时", "准点", "准时"],
            "按时到达": ["准时到校", "按时到校", "准时到达", "按时到"],
            "协助": ["帮助", "帮忙", "支援"],
            # #2 深化：新增常见课堂口语/近义表达，提升同义词召回（纯增量）
            "主动参与": ["积极参加", "主动参加", "踊跃参与", "主动发言"],
            "积极参与": ["积极参加", "主动参加", "踊跃参与", "主动发言"],
            "主动学习": ["自觉学习", "自主学习", "积极学习"],
            "帮助他人": ["帮助同学", "协助他人", "乐于助人"],
            "友爱同学": ["团结同学", "友好同学", "关爱同学"],
            "尊师重道": ["尊敬老师", "尊重老师", "听老师话"],
            "爱护公物": ["爱护设施", "保护公物", "珍惜物品"],
            "遵守纪律": ["守纪律", "遵规守纪", "遵守班规"],
            "热爱劳动": ["积极劳动", "主动劳动", "认真值日"],
            "书写工整": ["字迹工整", "卷面整洁", "书写认真"],
            "思维活跃": ["头脑灵活", "反应敏捷", "思考积极"],
            "乐于探究": ["喜欢探索", "主动钻研", "爱思考"],
            "情绪稳定": ["心态平和", "性格开朗", "不急躁"],
            "有礼貌": ["懂礼貌", "讲文明", "尊敬他人"],
            "进步明显": ["进步很大", "提升明显", "进步快"],
            "上课专心": ["专心听讲", "认真听课", "注意力集中"],
            "作业工整": ["作业整洁", "书写认真", "卷面干净"],
            "关心集体": ["热爱集体", "集体荣誉感强", "为班争光"],
            "拾金不昧": ["归还失物", "不占便宜", "诚实"],
            "见义勇为": ["勇敢助人", "挺身而出", "正能量"],
            "勤俭节约": ["节约粮食", "不浪费", "珍惜资源"],
            "讲究卫生": ["爱干净", "勤洗手", "保持整洁"],
            "积极发言": ["主动回答", "踊跃发言", "举手发言"],
            "按时完成作业": ["准时交作业", "独立完成作业", "作业认真"],
            "诚实守信": ["诚实", "守信", "不说谎"],
            "乐于助人": ["热心助人", "主动帮忙", "关爱他人"],
            "专注学习": ["专心学习", "用心学习", "投入学习"],
            "乐观向上": ["积极乐观", "开朗阳光", "正能量"],
        }
        _syn_default.update(config_loader.get_synonym_expansion() or {})
        self.synonym_expansion = _syn_default


    def _init_jieba(self):
        if not self.jieba_initialized:
            try:
                jieba.initialize()
                self.jieba_initialized = True
            except Exception as e:
                log_warning("jieba 初始化失败", exception=e)
                self.jieba_initialized = False


    def _refresh_cache(self):
        now = datetime.now().timestamp()
        if now - self._cache["cache_time"] > self._cache["cache_ttl"]:
            self._cache["users"] = User.query.filter(User.is_active).all()
            self._cache["user_names"] = {u.name for u in self._cache["users"]}
            # S6-B-P0-5 修复: 重名学生 last-wins 会记错人——重名时 id 置 None（歧义），
            # execute_scoring 对 user_id=None 返回"存在重名学生请指定班级"
            _nti = {}
            for _u in self._cache["users"]:
                if _u.name in _nti:
                    _nti[_u.name] = None
                else:
                    _nti[_u.name] = _u.id
            self._cache["name_to_id"] = _nti
            self._cache["behavior_keywords"] = [
                {
                    "keyword": k.keyword or "",
                    "keyword_type": k.keyword_type or "",
                    "score_type": k.score_type or "",
                    "default_score": k.default_score,
                    "synonyms": k.synonyms or [],
                }
                for k in NLPBehaviorKeyword.query.all()
            ]
            self._cache["rules_by_intent"] = {}
            for intent in ["add", "deduct", "query", "reset"]:
                # 只缓存 rule.id（#912 实机：ORM 对象跨请求 detached 后访问属性
                # DetachedInstanceError；_get_rules_by_intent 每次 get_by_id 重新查询，
                # 消费点保持 ORM 语义零改动）
                self._cache["rules_by_intent"][intent] = [
                    r.id
                    for r in NLPScoringRule.query.filter(
                        NLPScoringRule.score_type == intent,
                        NLPScoringRule.is_active,
                    )
                    .order_by(NLPScoringRule.priority.desc())
                    .all()
                ]
            self._cache["cache_time"] = now
            self._cache["rule_stats"] = self._compute_rule_stats()


    def _compute_rule_stats(self):
        stats = {}

        for intent in ["add", "deduct", "query", "reset"]:
            # 缓存存 id 列表，这里走 _get_rules_by_intent 重新查询（cache_time 已更新不会递归）
            rules = self._get_rules_by_intent(intent)
            for rule in rules:
                usage_count = rule.usage_count or 0
                accuracy_rate = rule.accuracy_rate or 0

                recency_score = 1.0
                last_used = _coerce_dt(rule.last_used_at)
                if last_used:
                    hours_since_last_use = (datetime.now() - last_used).total_seconds() / 3600
                    recency_score = max(0.3, 1.0 - hours_since_last_use / 168)

                priority_score = rule.priority * 10 if rule.priority else 0

                dynamic_score = (
                    accuracy_rate * 50 + usage_count * 0.1 + recency_score * 20 + priority_score
                )

                stats[rule.id] = {
                    "rule": rule,
                    "dynamic_score": dynamic_score,
                    "usage_count": usage_count,
                    "accuracy_rate": accuracy_rate,
                    "recency_score": recency_score,
                }

        return stats


    def _get_rule_dynamic_score(self, rule):
        if rule.id in self._cache.get("rule_stats", {}):
            return self._cache["rule_stats"][rule.id]["dynamic_score"]
        return rule.priority * 10 if rule.priority else 0


    def _sort_rules_by_dynamic_priority(self, rules):
        return sorted(rules, key=self._get_rule_dynamic_score, reverse=True)


    def _get_users(self):
        self._refresh_cache()
        return self._cache["users"]


    def _get_user_names(self):
        self._refresh_cache()
        return self._cache["user_names"]


    def _get_name_to_id(self):
        self._refresh_cache()
        return self._cache["name_to_id"]


    def _get_behavior_keywords(self):
        self._refresh_cache()
        return self._cache["behavior_keywords"]


    def _get_rules_by_intent(self, intent):
        self._refresh_cache()
        rule_ids = self._cache["rules_by_intent"].get(intent, [])
        # 缓存的是 id 列表，每次重新查询返回 session-bound 对象（避免跨请求
        # detached ORM 访问属性 500；主键查询轻量，规则量小可接受）
        rules = []
        for rid in rule_ids:
            rule = get_by_id(NLPScoringRule, rid)
            if rule is not None:
                rules.append(rule)
        return rules


    def _rule_id_to_intent(self, rule_id):
        """将规则ID转换为意图类别"""
        try:
            # 尝试将rule_id转为整数
            rule_id_int = int(rule_id)
            # 查询数据库获取规则
            rule = get_by_id(NLPScoringRule, rule_id_int)
            if rule:
                # score_type就是意图类型 (add/deduct)
                return rule.score_type
        except (ValueError, TypeError) as e:
            logging.getLogger(__name__).warning("get_intent_from_rule_id: rule_id=%r 转换/查库异常，回退已知意图判定: %s", rule_id, e)
        # 如果无法转换，检查是否是已知的意图类别
        known_intents = ["add", "deduct", "query", "reset", "unknown"]
        if str(rule_id) in known_intents:
            return str(rule_id)
        return None


    def _load_vectorizer(self):
        try:

            vectorizer_path = os.path.join(
                os.path.dirname(__file__),
                "../models/trained/nlp_vectorizer.pkl",
            )
            if os.path.exists(vectorizer_path):
                with open(vectorizer_path, "rb") as f:
                    self.vectorizer = pickle.load(f)  # nosec B301 - trusted internal model
        except Exception as e:
            log_warning("加载 NLP 向量器模型失败（降级为 None）", exception=e)
            self.vectorizer = None


    def _build_bm25_index(self, documents):

        k1 = self.bm25_params["k1"]
        b = self.bm25_params["b"]

        doc_count = len(documents)
        avg_doc_len = sum(len(doc) for doc in documents) / doc_count if doc_count > 0 else 0

        doc_term_freq = []
        for doc in documents:
            terms = list(jieba.lcut(doc)) if self.jieba_initialized else list(doc)
            tf = {}
            for term in terms:
                tf[term] = tf.get(term, 0) + 1
            doc_term_freq.append(tf)

        idf = {}
        for _doc_index, doc in enumerate(documents):
            terms = list(jieba.lcut(doc)) if self.jieba_initialized else list(doc)
            unique_terms = set(terms)
            for term in unique_terms:
                idf[term] = idf.get(term, 0) + 1

        for term in idf:
            idf[term] = math.log((doc_count - idf[term] + 0.5) / (idf[term] + 0.5) + 1)

        return {
            "k1": k1,
            "b": b,
            "doc_count": doc_count,
            "avg_doc_len": avg_doc_len,
            "doc_term_freq": doc_term_freq,
            "idf": idf,
        }


    def _bm25_score(self, query, doc_index, bm25_index):
        if doc_index >= bm25_index["doc_count"]:
            return 0.0

        k1 = bm25_index["k1"]
        b = bm25_index["b"]
        doc_tf = bm25_index["doc_term_freq"][doc_index]
        doc_len = sum(doc_tf.values())
        avg_doc_len = bm25_index["avg_doc_len"]

        score = 0.0
        query_terms = list(jieba.lcut(query)) if self.jieba_initialized else list(query)

        for term in query_terms:
            if term not in bm25_index["idf"]:
                continue

            tf = doc_tf.get(term, 0)
            if tf == 0:
                continue

            idf = bm25_index["idf"][term]
            numerator = tf * (k1 + 1)
            denominator = (
                tf + k1 * (1 - b + b * doc_len / avg_doc_len) if avg_doc_len > 0 else tf + k1
            )

            score += idf * numerator / denominator

        return score


    def _get_position_weight(self, text, keyword):
        if keyword not in text:
            return 0.0

        position = text.index(keyword)
        text_len = len(text)

        if text_len == 0:
            return 1.0

        ratio = position / text_len

        if ratio <= 0.3:
            return self.position_weights["start"]
        if ratio >= 0.7:
            return self.position_weights["end"]
        return self.position_weights["middle"]


    def _get_keyword_importance(self, keyword_type):
        return self.keyword_importance.get(keyword_type, 1.0)


    def _resolve_referral(self, text):
        for referral, _gender in self.referral_words.items():
            if referral in text and self.context_memory["recent_users"]:
                recent_user = self.context_memory["recent_users"][-1]
                return recent_user, referral
        return None, None


    def _update_context_memory(self, user_name=None, rule_id=None, intent=None):
        if user_name:
            self.context_memory["recent_users"] = [
                u for u in self.context_memory["recent_users"] if u != user_name
            ]
            self.context_memory["recent_users"].append(user_name)
            if len(self.context_memory["recent_users"]) > self.context_memory["max_memory_size"]:
                self.context_memory["recent_users"].pop(0)

        if rule_id:
            self.context_memory["recent_rules"] = [
                r for r in self.context_memory["recent_rules"] if r != rule_id
            ]
            self.context_memory["recent_rules"].append(rule_id)
            if len(self.context_memory["recent_rules"]) > self.context_memory["max_memory_size"]:
                self.context_memory["recent_rules"].pop(0)

        if intent:
            self.context_memory["recent_intents"] = [
                i for i in self.context_memory["recent_intents"] if i != intent
            ]
            self.context_memory["recent_intents"].append(intent)
            if len(self.context_memory["recent_intents"]) > self.context_memory["max_memory_size"]:
                self.context_memory["recent_intents"].pop(0)


    def _expand_synonyms(self, text):
        expanded_texts = [text]

        for keyword, synonyms in self.synonym_expansion.items():
            if keyword in text:
                for synonym in synonyms:
                    expanded_texts.append(text.replace(keyword, synonym))

        return expanded_texts
