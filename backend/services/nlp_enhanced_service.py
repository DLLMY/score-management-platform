import os
import re
import threading
import jieba
import numpy as np
from numpy import hstack
import pickle
import math
from datetime import datetime, timedelta, date
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split
from models import (
    NLPScoringRule,
    NLPBehaviorKeyword,
    NLPMatchResult,
    NLPRuleUsage,
    User,
    get_by_id,
    db,
)
from services.nlp_ml_service import NLPMLTrainingService
from config.config_loader import config_loader
from utils.db_session import db_session_scope


def _coerce_dt(value):
    """将可能的 str/date/datetime 统一解析为 datetime；无法解析返回 None。

    用于 NLPScoringRule.last_used_at 等被声明为 String(50) 但实际存 datetime
    的字段——SQLAlchemy 从 String 列加载时一律返回字符串，直接做
    `datetime.now() - value` 会触发 TypeError: datetime - str。
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, str):
        s = value.strip()
        for fmt in (
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            return None
    return None


class MLIntentClassifier:
    def __init__(self):
        self.intent_vectorizer = None
        self.intent_model = None
        self.intent_labels = {
            "add": 0,
            "deduct": 1,
            "query": 2,
            "reset": 3,
            "unknown": 4,
        }
        self.intent_labels_reverse = {v: k for k, v in self.intent_labels.items()}

        intent_words = config_loader.get_intent_words()
        self.positive_intent_words = set(intent_words.get("positive", [])) or {
            "加",
            "奖励",
            "表扬",
            "优秀",
            "好",
            "棒",
            "赞",
            "积极",
            "认真",
            "努力",
            "勤奋",
            "出色",
            "进步",
            "良好",
            "贡献",
            "助人为乐",
            "团结",
            "主动",
            "热心",
            "诚实",
            "守信",
            "负责",
            "专注",
            "耐心",
            "细心",
            "友善",
            "感恩",
            "自律",
            "自信",
            "乐观",
            "尊师重道",
            "整洁",
            "守纪",
            "礼貌",
            "尊敬",
            "友爱",
            "创新",
            "钻研",
            "坚持",
            "勇敢",
            "正直",
            "准时",
            "完成",
            "合作",
            "参与",
            "帮助",
            "提问",
            "发言",
            "回答",
            "擦黑板",
            "值日",
            "整理",
            "劳动",
            "打扫",
            "听讲",
            "作业",
            "提交",
            "遵守",
            "配合",
            "积极向上",
            "认真负责",
            "专心致志",
            "一丝不苟",
            "精益求精",
            "团结协作",
            "乐于助人",
            "诚实守信",
        }
        self.negative_intent_words = set(intent_words.get("negative", [])) or {
            "扣",
            "处罚",
            "批评",
            "差",
            "罚",
            "违纪",
            "违规",
            "迟到",
            "早退",
            "旷课",
            "睡觉",
            "玩手机",
            "说话",
            "走神",
            "抄袭",
            "作弊",
            "打架",
            "顶嘴",
            "破坏",
            "偷懒",
            "马虎",
            "撒谎",
            "不尊重",
            "粗心",
            "懒惰",
            "散漫",
            "冷漠",
            "自私",
            "急躁",
            "无理",
            "傲慢",
            "侮辱",
            "威胁",
            "欺凌",
            "损坏",
            "浪费",
            "逃避",
            "屡教不改",
            "态度恶劣",
            "扰乱课堂",
            "拒不配合",
            "恶意破坏",
            "故意捣乱",
            "消极怠工",
            "敷衍了事",
            "心不在焉",
            "东张西望",
            "喧哗",
            "骂人",
            "争吵",
            "捣乱",
            "调皮",
            "未完成",
            "不交",
            "顶撞",
            "反驳",
            "不服从",
            "作弊",
            "偷窃",
            "逃避责任",
        }
        self.query_intent_words = set(intent_words.get("query", [])) or {
            "查",
            "查询",
            "多少分",
            "积分",
            "分数",
            "查看",
            "统计",
            "排名",
            "得分",
            "剩余",
            "总分数",
            "积分明细",
            "得分情况",
            "成绩",
            "个人分数",
        }
        self.reset_intent_words = set(intent_words.get("reset", [])) or {
            "重置",
            "清零",
            "归零",
            "重新计算",
            "清空",
            "重新开始",
            "初始化",
        }
        self._train_intent_classifier()

    def _prepare_intent_data(self):
        intent_samples = {
            "add": [
                "加分",
                "奖励",
                "表扬",
                "优秀",
                "好",
                "棒",
                "赞",
                "给予奖励",
                "发放积分",
                "主动回答问题",
                "积极发言",
                "帮助同学",
                "完成作业",
                "遵守纪律",
                "按时到校",
                "按时到达",
                "准时到校",
                "准时到达",
                "按时到达学校",
                "准时到校上学",
                "到达学校",
                "到校",
                "认真听讲",
                "勤奋学习",
                "表现良好",
                "做出贡献",
                "助人为乐",
                "团结同学",
                "积极参与",
                "认真负责",
                "专心致志",
                "一丝不苟",
                "精益求精",
                "诚实守信",
                "尊师重道",
                "进步明显",
                "成绩优异",
                "课堂表现好",
                "作业完成好",
                "帮助他人",
                "主动擦黑板",
                "主动打扫卫生",
                "主动整理教室",
                "积极值日",
                "认真打扫",
                "准时交作业",
                "按时完成任务",
                "积极回答问题",
                "主动举手",
                "认真完成作业",
                "帮助老师",
                "帮助同学解决问题",
                "积极参与活动",
                "表现突出",
                "进步很大",
                "遵守校规",
                "遵守班规",
                "上课认真",
                "态度端正",
                "学习努力",
                "作业认真",
                "团结同学",
                "乐于助人",
                "热心帮助",
                "诚实守信",
                "礼貌待人",
                "尊敬老师",
                "爱护公物",
                "保持整洁",
                "整理课桌",
                "整理书包",
                "认真值日",
                "主动劳动",
                "协助同学",
                "协助老师",
                "帮助其他同学",
                "帮忙同学",
                "协助其他同学",
            ],
            "deduct": [
                "扣分",
                "处罚",
                "批评",
                "差",
                "罚",
                "扣除",
                "违反纪律",
                "迟到",
                "早退",
                "旷课",
                "睡觉",
                "玩手机",
                "上课说话",
                "上课聊天",
                "走神",
                "抄袭",
                "打架",
                "顶嘴",
                "不遵守纪律",
                "扰乱课堂",
                "未完成作业",
                "作业不交",
                "态度恶劣",
                "屡教不改",
                "故意捣乱",
                "消极怠工",
                "敷衍了事",
                "心不在焉",
                "东张西望",
                "不尊重老师",
                "破坏公物",
                "浪费资源",
                "逃避责任",
                "考试作弊",
                "辱骂同学",
                "威胁他人",
                "上课睡觉",
                "上课玩手机",
                "在课堂上说话",
                "上课聊天",
                "上课走神",
                "上课发呆",
                "开小差",
                "注意力不集中",
                "作业抄袭",
                "抄作业",
                "考试作弊",
                "违纪行为",
                "违反校规",
                "违反班规",
                "迟到早退",
                "旷课缺席",
                "打架斗殴",
                "争吵闹事",
                "顶撞老师",
                "辱骂他人",
                "威胁同学",
                "破坏教室",
                "损坏物品",
                "浪费水电",
                "逃避值日",
                "不做值日",
                "不打扫卫生",
                "不整理课桌",
                "不遵守课堂纪律",
                "扰乱课堂秩序",
                "影响他人学习",
                "屡教屡犯",
                "态度不端正",
                "学习不认真",
            ],
            "query": [
                "查询分数",
                "多少分",
                "积分",
                "分数",
                "查看",
                "显示",
                "看看",
                "统计",
                "我的得分",
                "查询积分",
                "剩余积分",
                "总分数",
                "积分明细",
                "得分情况",
                "分数查询",
                "成绩查询",
                "查看排名",
                "班级排名",
                "个人分数",
                "积分统计",
                "查一下分数",
                "看看多少分",
                "分数是多少",
                "积分有多少",
                "查看积分",
                "查询总分",
                "我的积分",
                "我的分数",
                "当前积分",
                "当前分数",
                "积分排名",
                "班级积分排名",
                "个人积分排名",
                "成绩排名",
                "积分详情",
                "分数详情",
                "查看积分明细",
                "查看分数明细",
            ],
            "reset": [
                "重置分数",
                "清零",
                "归零",
                "重新计算",
                "重置积分",
                "清空积分",
                "分数重置",
                "重新开始",
                "初始化分数",
                "把分数清零",
                "重置所有积分",
                "清空所有分数",
                "重新计算积分",
                "初始化积分",
                "分数归零",
                "积分解零",
            ],
        }

        texts = []
        labels = []

        for intent, samples in intent_samples.items():
            for sample in samples:
                texts.append(sample)
                labels.append(self.intent_labels[intent])

        for _ in range(50):
            texts.append("")
            labels.append(self.intent_labels["unknown"])

        for _ in range(30):
            texts.append("这是一段无关的文本")
            labels.append(self.intent_labels["unknown"])

        for _ in range(20):
            texts.append("测试数据")
            labels.append(self.intent_labels["unknown"])

        return texts, labels

    def _extract_intent_features(self, text):
        features = []

        text_lower = text.lower()

        positive_count = sum(1 for w in self.positive_intent_words if w in text_lower)
        negative_count = sum(1 for w in self.negative_intent_words if w in text_lower)
        query_count = sum(1 for w in self.query_intent_words if w in text_lower)
        reset_count = sum(1 for w in self.reset_intent_words if w in text_lower)

        features.append(positive_count)
        features.append(negative_count)
        features.append(query_count)
        features.append(reset_count)

        features.append(len(text))

        if positive_count > 0 and negative_count == 0:
            features.append(1)
        else:
            features.append(0)

        if negative_count > 0 and positive_count == 0:
            features.append(1)
        else:
            features.append(0)

        if query_count > 0:
            features.append(1)
        else:
            features.append(0)

        if reset_count > 0:
            features.append(1)
        else:
            features.append(0)

        return features

    def _train_intent_classifier(self):
        texts, labels = self._prepare_intent_data()

        if not texts:
            return

        self.intent_vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 4),
            analyzer="char_wb",
            lowercase=False,
            min_df=2,
        )

        X_tfidf = self.intent_vectorizer.fit_transform(texts)

        feature_matrix = []
        for text in texts:
            features = self._extract_intent_features(text)
            feature_matrix.append(features)

        from scipy.sparse import hstack

        X_features = np.array(feature_matrix)
        X = hstack([X_tfidf, X_features])
        y = np.array(labels)

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        from sklearn.linear_model import LogisticRegression

        model = LogisticRegression(
            max_iter=2000,
            random_state=42,
            class_weight="balanced",
            C=15,
            solver="lbfgs",
        )

        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        from sklearn.metrics import f1_score

        _ = f1_score(y_test, y_pred, average="weighted")  # noqa: F841

        self.intent_model = model

        # 预测结果缓存
        self._prediction_cache = {}
        self._cache_max_size = 1000

    def predict_intent(self, text, use_cache: bool = True):
        # 检查缓存
        if use_cache and text in self._prediction_cache:
            return self._prediction_cache[text]

        if not self.intent_model or not self.intent_vectorizer:
            return None, 0.0

        try:
            X_tfidf = self.intent_vectorizer.transform([text])
            features = self._extract_intent_features(text)
            X_features = np.array([features])

            X = hstack([X_tfidf, X_features])

            intent_idx = self.intent_model.predict(X)[0]
            confidence = self.intent_model.predict_proba(X)[0][intent_idx]

            result = (  # noqa: F841
                self.intent_labels_reverse[intent_idx],
                round(confidence, 4),
            )

            # 缓存结果
            if use_cache:
                if len(self._prediction_cache) >= self._cache_max_size:
                    # 简单的FIFO策略，删除最早的缓存
                    oldest_key = next(iter(self._prediction_cache))
                    del self._prediction_cache[oldest_key]
                self._prediction_cache[text] = result

            return result
        except Exception:
            return None, 0.0


class EnhancedNLPParserService:

    def __init__(self):
        self.jieba_initialized = False
        self._init_jieba()
        self.ml_service = NLPMLTrainingService()
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

        self.invalid_names = config_loader.get_invalid_names() or {
            "奖励",
            "惩罚",
            "批评",
            "表扬",
            "处罚",
            "扣分",
            "加分",
            "查询",
            "查看",
            "显示",
            "看看",
            "展示",
            "统计",
            "列出",
            "给予",
            "发放",
            "授予",
            "扣除",
            "减去",
            "清零",
            "重置",
            "因为",
            "把分",
            "加分项",
            "扣分项",
            "查询分",
            "查看分",
            "显示分",
            "看看分",
            "展示分",
            "查询分数",
            "查看分数",
            "显示分数",
            "看看分数",
            "查询积分",
            "查看积分",
            "显示积分",
            "同学",
            "学生",
            "老师",
            "班长",
            "组长",
            "队长",
            "代表",
            "昨天",
            "今天",
            "刚才",
            "现在",
            "之前",
            "之后",
            "早上",
            "下午",
            "晚上",
            "上课",
            "迟到",
            "早退",
            "旷课",
            "作业",
            "发言",
            "表现",
            "完成",
            "帮助",
            "积极",
            "主动",
            "认真",
            "努力",
            "优秀",
            "良好",
            "出色",
            "进步",
            "按时",
            "准时",
            "及时",
            "提前",
            "守纪",
            "礼貌",
            "尊敬",
            "友爱",
            "团结",
            "创新",
            "睡觉",
            "违纪",
            "违规",
            "说话",
            "聊天",
            "走神",
            "玩手机",
            "吃东西",
            "喧哗",
            "破坏",
            "偷懒",
            "马虎",
            "抄袭",
            "作弊",
            "撒谎",
            "顶撞",
            "为给",
            "对让",
            "是表",
            "把分",
            "把王",
            "把张",
            "把李",
            "把刘",
            "把陈",
            "加分",
            "扣分",
            "分数",
            "积分",
            "成绩",
            "得分",
            "行为",
            "情况",
            "事情",
            "加",
            "扣",
            "查",
            "看",
            "给",
            "为",
            "对",
            "让",
            "把",
            "被",
            "因",
            "了",
            "的",
            "在",
            "是",
            "有",
            "做",
            "说",
            "来",
            "去",
            "好",
            "差",
            "很",
            "太",
        }

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
        self.positive_keywords = set(keywords.get("positive", [])) or {
            "积极",
            "优秀",
            "认真",
            "努力",
            "勤奋",
            "刻苦",
            "良好",
            "出色",
            "进步",
            "表扬",
            "奖励",
            "加分",
            "好",
            "棒",
            "赞",
            "贡献",
            "回答",
            "发言",
            "提问",
            "参与",
            "帮助",
            "合作",
            "完成",
            "准时",
            "整洁",
            "守纪",
            "礼貌",
            "尊敬",
            "友爱",
            "团结",
            "创新",
            "钻研",
            "专注",
            "负责",
            "主动",
            "热心",
            "诚实",
            "守信",
            "正直",
            "勇敢",
            "坚持",
            "耐心",
            "细心",
            "友善",
            "感恩",
            "自律",
            "自信",
            "乐观",
            "助人为乐",
            "积极向上",
            "认真负责",
            "专心致志",
            "一丝不苟",
            "精益求精",
            "团结协作",
            "乐于助人",
            "诚实守信",
            "尊师重道",
            "擦黑板",
            "整理",
            "值日",
            "劳动",
            "打扫卫生",
            "保持整洁",
        }
        self.negative_keywords = set(keywords.get("negative", [])) or {
            "睡觉",
            "迟到",
            "早退",
            "旷课",
            "违纪",
            "违规",
            "扣分",
            "差",
            "调皮",
            "捣乱",
            "争吵",
            "打架",
            "骂人",
            "作业",
            "不交",
            "未完成",
            "说话",
            "聊天",
            "走神",
            "玩手机",
            "游戏",
            "吃东西",
            "喧哗",
            "破坏",
            "偷懒",
            "马虎",
            "抄袭",
            "作弊",
            "撒谎",
            "顶撞",
            "不尊重",
            "粗心",
            "懒惰",
            "散漫",
            "冷漠",
            "自私",
            "急躁",
            "无理",
            "傲慢",
            "侮辱",
            "威胁",
            "欺凌",
            "作弊",
            "偷窃",
            "损坏",
            "浪费",
            "逃避",
            "屡教不改",
            "态度恶劣",
            "扰乱课堂",
            "拒不配合",
            "恶意破坏",
            "故意捣乱",
            "消极怠工",
            "敷衍了事",
            "心不在焉",
            "东张西望",
        }
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
                re.compile(r"^([\u4e00-\u9fa5]{2})(?:同学)?"),
                re.compile(
                    r"([\u4e00-\u9fa5]{2})(?:同学|的|在|上课|今天|昨天|刚才|"
                    r"表现|作业|发言|迟到|早退|旷课|做了|完成|违反|积极|"
                    r"主动|认真|努力|优秀|良好|出色|进步)"
                ),
                re.compile(r"(?:是|为|给|对|让|发现|看到)([\u4e00-\u9fa5]{2})"),
                re.compile(r"([\u4e00-\u9fa5]{2})的(?:行为|表现|作业|课堂|情况|事情)"),
                re.compile(r"(?:学生|同学)([\u4e00-\u9fa5]{2})"),
                re.compile(r"^([\u4e00-\u9fa5]{3})(?:同学)?"),
                re.compile(
                    r"([\u4e00-\u9fa5]{3})(?:同学|的|在|上课|今天|昨天|"
                    r"刚才|表现|作业|发言|迟到|早退|旷课)"
                ),
            ]

        self.name_prefix_words = config_loader.get_name_prefix_words() or {
            "积极",
            "主动",
            "认真",
            "努力",
            "勤奋",
            "刻苦",
            "优秀",
            "良好",
            "出色",
            "进步",
            "良好",
            "及时",
            "准时",
            "按时",
            "专心",
            "专注",
            "耐心",
            "细心",
            "热心",
            "友善",
            "诚实",
            "守信",
            "正直",
            "勇敢",
            "坚持",
            "自信",
            "自律",
            "乐观",
            "团结",
            "友善",
            "乐于助人",
            "认真负责",
            "专心致志",
            "一丝不苟",
            "精益求精",
            "积极向上",
            "迟到",
            "早退",
            "旷课",
            "睡觉",
            "说话",
            "走神",
            "玩手机",
            "打架",
            "顶嘴",
            "破坏",
            "偷懒",
            "马虎",
            "抄袭",
            "作弊",
            "撒谎",
            "不尊重",
            "粗心",
            "懒惰",
            "散漫",
            "冷漠",
            "自私",
            "急躁",
            "无理",
            "傲慢",
            "侮辱",
            "威胁",
            "欺凌",
            "损坏",
            "浪费",
            "逃避",
            "调皮",
            "捣乱",
            "争吵",
            "骂人",
            "喧哗",
            "吃东西",
            "游戏",
            "不按时",
            "未完成",
            "不交",
        }

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

        self.synonym_expansion = config_loader.get_synonym_expansion() or {
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
        }

    def _init_jieba(self):
        if not self.jieba_initialized:
            try:
                jieba.initialize()
                self.jieba_initialized = True
            except Exception:
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
            self._cache["behavior_keywords"] = NLPBehaviorKeyword.query.all()
            self._cache["rules_by_intent"] = {}
            for intent in ["add", "deduct", "query", "reset"]:
                self._cache["rules_by_intent"][intent] = (
                    NLPScoringRule.query.filter(
                        NLPScoringRule.score_type == intent,
                        NLPScoringRule.is_active,
                    )
                    .order_by(NLPScoringRule.priority.desc())
                    .all()
                )
            self._cache["cache_time"] = now
            self._cache["rule_stats"] = self._compute_rule_stats()

    def _compute_rule_stats(self):
        stats = {}

        for intent in ["add", "deduct", "query", "reset"]:
            rules = self._cache["rules_by_intent"].get(intent, [])
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
        return self._cache["rules_by_intent"].get(intent, [])

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
        except (ValueError, TypeError):
            pass
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
        except Exception:
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
        for doc_index, doc in enumerate(documents):
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
        elif ratio >= 0.7:
            return self.position_weights["end"]
        else:
            return self.position_weights["middle"]

    def _get_keyword_importance(self, keyword_type):
        return self.keyword_importance.get(keyword_type, 1.0)

    def _analyze_sentiment(self, text):
        positive_score = 0
        negative_score = 0

        for word in self.positive_keywords:
            count = text.count(word)
            positive_score += count * len(word) * 0.5

        for word in self.negative_keywords:
            count = text.count(word)
            negative_score += count * len(word) * 0.5

        total_score = positive_score + negative_score

        if total_score == 0:
            return 0.0

        sentiment = (positive_score - negative_score) / total_score

        return sentiment

    def _resolve_referral(self, text):
        for referral, gender in self.referral_words.items():
            if referral in text:
                if self.context_memory["recent_users"]:
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

    def extract_name(self, text):
        text = text.strip()

        user_names = self._get_user_names()
        name_to_id = self._get_name_to_id()

        behavior_keywords = self._get_behavior_keywords()

        behavior_kw_list = []
        for kw in behavior_keywords:
            if hasattr(kw, "keyword"):
                behavior_kw_list.append(kw.keyword)

        for name in user_names:
            if name in text:
                name_pos = text.index(name)
                valid = True

                if name_pos > 0:
                    for prefix in self.name_prefix_words:
                        if text.startswith(prefix, max(0, name_pos - len(prefix)), name_pos):
                            valid = False
                            break

                if valid and name_pos + len(name) < len(text):
                    found_suffix = False
                    for suffix in self.name_suffix_words:
                        if text.startswith(suffix, name_pos + len(name)):
                            found_suffix = True
                            break

                    if found_suffix:
                        valid = True
                    else:
                        remaining_text = text[name_pos + len(name) :]
                        matched_behavior = False
                        for kw in behavior_kw_list:
                            if remaining_text.startswith(kw):
                                matched_behavior = True
                                break

                        if matched_behavior:
                            valid = True
                        else:
                            next_char = text[name_pos + len(name)]
                            if next_char not in "，。！？、 ":
                                valid = False

                if valid:
                    return name, name_to_id.get(name)

        for pattern in self.name_patterns:
            match = pattern.search(text)
            if match:
                name = match.group(1)
                if 2 <= len(name) <= 4:
                    invalid_chars = (
                        "同学上课昨天今天刚才为给对让是表现作业发言迟到早退旷课"
                        "学生积极主动认真努力优秀良好出色进步按时准时及时提前"
                        "把因为奖励惩罚批评表扬处罚"
                    )
                    if name not in self.invalid_names and not any(
                        char in invalid_chars for char in name
                    ):
                        if name in name_to_id:
                            return name, name_to_id[name]
                        return name, None

        for i in range(2, 5):
            if i <= len(text):
                candidate = text[:i]
                if candidate in self.invalid_names:
                    continue
                remaining = text[i:]
                # 获取行为关键词列表（字符串）
                keyword_objs = self._get_behavior_keywords()
                behavior_kw_list = [
                    kw.keyword if hasattr(kw, "keyword") else str(kw) for kw in keyword_objs
                ]
                for kw in behavior_kw_list:
                    if remaining.startswith(kw):
                        if candidate in name_to_id:
                            return candidate, name_to_id[candidate]
                        return candidate, None

        return None, None

    def extract_entities(self, text, name=None):
        if name:
            text_no_name = text.replace(name, "").replace(name + "同学", "")
        else:
            text_no_name = text

        entities = {
            "names": [],
            "times": [],
            "numbers": [],
            "scores": [],
            "dates": [],
            "behaviors": [],
        }

        user_names = self._get_user_names()

        for user_name in user_names:
            if user_name in text:
                entities["names"].append(
                    {
                        "text": user_name,
                        "type": "student",
                        "start": text.index(user_name),
                        "end": text.index(user_name) + len(user_name),
                    }
                )

        time_patterns = [
            (r"(\d+)分钟", "minutes"),
            (r"(\d+)小时", "hours"),
            (r"(\d+)秒", "seconds"),
            (r"(\d+)点(\d+)?分?", "time"),
            (r"(\d+)时(\d+)?分?", "time"),
            (r"迟到(\d+)分钟", "late_minutes"),
            (r"早退(\d+)分钟", "early_minutes"),
        ]

        for pattern, entity_type in time_patterns:
            for match in re.finditer(pattern, text):
                entities["times"].append(
                    {
                        "text": match.group(0),
                        "type": entity_type,
                        "value": int(match.group(1)),
                        "start": match.start(),
                        "end": match.end(),
                    }
                )

        number_patterns = [
            (r"(\d+\.?\d*)分", "score"),
            (r"(\d+\.?\d*)分?加", "add_score"),
            (r"(\d+\.?\d*)分?扣", "deduct_score"),
            (r"加(\d+\.?\d*)", "add_value"),
            (r"扣(\d+\.?\d*)", "deduct_value"),
            (r"(\d+\.?\d*)分", "points"),
            (r"(\d+)次", "count"),
            (r"(\d+)个", "quantity"),
            (r"(\d+)人", "people"),
        ]

        for pattern, entity_type in number_patterns:
            for match in re.finditer(pattern, text):
                try:
                    value = float(match.group(1))
                    entities["numbers"].append(
                        {
                            "text": match.group(0),
                            "type": entity_type,
                            "value": value,
                            "start": match.start(),
                            "end": match.end(),
                        }
                    )
                    if entity_type in [
                        "score",
                        "add_score",
                        "deduct_score",
                        "add_value",
                        "deduct_value",
                        "points",
                    ]:
                        entities["scores"].append(
                            {
                                "text": match.group(0),
                                "type": entity_type,
                                "value": value,
                                "start": match.start(),
                                "end": match.end(),
                            }
                        )
                except ValueError:
                    pass

        date_patterns = [
            (r"今天", "today"),
            (r"昨天", "yesterday"),
            (r"前天", "day_before_yesterday"),
            (r"明天", "tomorrow"),
            (r"(\d+)月(\d+)日", "date"),
            (r"(\d+)月(\d+)号", "date"),
            (r"(\d{4})年(\d+)月(\d+)日", "full_date"),
        ]

        for pattern, entity_type in date_patterns:
            for match in re.finditer(pattern, text):
                date_value = None
                if entity_type == "today":
                    date_value = datetime.now().strftime("%Y-%m-%d")
                elif entity_type == "yesterday":
                    date_value = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                elif entity_type == "day_before_yesterday":
                    date_value = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
                elif entity_type == "tomorrow":
                    date_value = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

                entities["dates"].append(
                    {
                        "text": match.group(0),
                        "type": entity_type,
                        "value": date_value,
                        "start": match.start(),
                        "end": match.end(),
                    }
                )

        # S10 修复: 每请求全表查行为词库 → 走 _refresh_cache 300s TTL 缓存
        behavior_keywords = self._get_behavior_keywords()
        for kw in behavior_keywords:
            if kw.keyword in text_no_name:
                entities["behaviors"].append(
                    {
                        "text": kw.keyword,
                        "type": kw.keyword_type,
                        "score_type": kw.score_type,
                        "default_score": kw.default_score,
                        "start": text_no_name.index(kw.keyword),
                        "end": text_no_name.index(kw.keyword) + len(kw.keyword),
                    }
                )

        return entities

    def extract_behavior(self, text, name=None):
        text = text.strip()

        if name:
            text_no_name = text.replace(name, "").replace(name + "同学", "")
        else:
            text_no_name = text

        behavior_keywords = self._get_behavior_keywords()
        matched_keywords = []
        matched_patterns = []

        expanded_texts = self._expand_synonyms(text_no_name)

        for pattern_name, patterns in self.behavior_patterns.items():
            for pattern in patterns:
                for expanded_text in expanded_texts:
                    match = re.search(pattern, expanded_text)
                    if match:
                        matched_patterns.append((pattern_name, match.group(0)))
                        kw = next(
                            (k for k in behavior_keywords if k.keyword == pattern_name),
                            None,
                        )
                        if kw:
                            matched_keywords.append(
                                (
                                    kw.keyword,
                                    kw.keyword_type,
                                    kw.score_type,
                                    kw.default_score,
                                )
                            )
                        break

        for kw in behavior_keywords:
            for expanded_text in expanded_texts:
                if kw.keyword in expanded_text:
                    if kw.keyword not in [k[0] for k in matched_keywords]:
                        matched_keywords.append(
                            (
                                kw.keyword,
                                kw.keyword_type,
                                kw.score_type,
                                kw.default_score,
                            )
                        )
                    for synonym in kw.synonyms:
                        if synonym in expanded_text and synonym not in [
                            k[0] for k in matched_keywords
                        ]:
                            matched_keywords.append(
                                (
                                    synonym,
                                    kw.keyword_type,
                                    kw.score_type,
                                    kw.default_score,
                                )
                            )

        if self.jieba_initialized:
            words = jieba.lcut(text_no_name)
            for word in words:
                if len(word) >= 2:
                    kw = next(
                        (k for k in behavior_keywords if k.keyword == word),
                        None,
                    )
                    if kw and word not in [k[0] for k in matched_keywords]:
                        matched_keywords.append(
                            (
                                word,
                                kw.keyword_type,
                                kw.score_type,
                                kw.default_score,
                            )
                        )

                    for base_word, synonyms in self.synonym_expansion.items():
                        if word == base_word or word in synonyms:
                            kw = next(
                                (k for k in behavior_keywords if k.keyword == base_word),
                                None,
                            )
                            if kw and base_word not in [k[0] for k in matched_keywords]:
                                matched_keywords.append(
                                    (
                                        base_word,
                                        kw.keyword_type,
                                        kw.score_type,
                                        kw.default_score,
                                    )
                                )

        positive_count = 0
        negative_count = 0

        if self.jieba_initialized:
            words = jieba.lcut(text_no_name)
            for word in words:
                if word in self.positive_keywords:
                    positive_count += 1
                if word in self.negative_keywords:
                    negative_count += 1
        else:
            for kw in self.positive_keywords:
                if kw in text_no_name:
                    positive_count += 1
            for kw in self.negative_keywords:
                if kw in text_no_name:
                    negative_count += 1

        return {
            "keywords": matched_keywords,
            "patterns": matched_patterns,
            "positive_count": positive_count,
            "negative_count": negative_count,
            "text": text_no_name.strip(),
            "expanded_texts": expanded_texts,
        }

    def _has_antonym_conflict(self, text, rule):
        rule_text = ""
        if rule.behavior_keyword:
            rule_text += rule.behavior_keyword + " "
        if rule.behavior_description:
            rule_text += rule.behavior_description + " "
        if rule.match_pattern:
            rule_text += rule.match_pattern

        for negative_word, antonyms in self.antonym_pairs.items():
            if negative_word in rule_text:
                for antonym in antonyms:
                    if antonym in text:
                        return True
        return False

    def determine_intent(self, text, behavior_result):
        text_lower = text.lower()
        # S6 修复: 否定词前缀（"不要扣分/别加分/禁止减分"含意图词子串 → 原误判意图）
        _NEG_PREFIXES = ("不要", "别", "请勿", "禁止", "不想", "别给", "别扣", "别加")

        # 快速规则匹配（优先级最高）
        rule_based_intent = None
        for intent, keywords in self.intent_keywords.items():
            for kw in keywords:
                kw_pos = text_lower.find(kw)
                if kw_pos == -1:
                    continue
                prefix_ctx = text_lower[max(0, kw_pos - 2) : kw_pos]
                if any(prefix_ctx.endswith(neg) for neg in _NEG_PREFIXES):
                    continue  # 否定前缀 → 不命中该意图
                rule_based_intent = intent
                break
            if rule_based_intent:
                break
        if rule_based_intent and rule_based_intent != "unknown":
            return rule_based_intent

        # 关键词意图（基于行为分析）
        keywords = behavior_result["keywords"]
        keyword_intent = None
        if keywords:
            for kw in keywords:
                if kw[2] == "deduct":
                    keyword_intent = "deduct"
                    break
                if kw[2] == "add":
                    keyword_intent = "add"
                    break
        if keyword_intent:
            return keyword_intent

        # 情感意图
        positive_count = behavior_result["positive_count"]
        negative_count = behavior_result["negative_count"]
        if negative_count > positive_count:
            return "deduct"
        elif positive_count > negative_count:
            return "add"

        # 如果没有任何线索，直接返回unknown，避免机器学习调用开销
        return "unknown"

    def semantic_match(self, text, intent):
        if self.vectorizer is None:
            return []

        rules = NLPScoringRule.query.filter(
            NLPScoringRule.score_type == intent, NLPScoringRule.is_active
        ).all()

        if not rules:
            return []

        rule_texts = []
        rule_ids = []

        for rule in rules:
            texts = []
            if rule.behavior_keyword:
                texts.append(rule.behavior_keyword)
            if rule.behavior_description:
                texts.append(rule.behavior_description)
            if rule.match_pattern:
                texts.append(rule.match_pattern)
            if rule.behavior_tags:
                texts.extend(rule.behavior_tags)
            rule_texts.append(" ".join(texts))
            rule_ids.append(rule.id)

        X_rules = self.vectorizer.transform(rule_texts)

        expanded_texts = self._expand_synonyms(text)
        best_similarities = []

        for expanded_text in expanded_texts:
            X_text = self.vectorizer.transform([expanded_text])
            similarities = cosine_similarity(X_text, X_rules)[0]
            best_similarities.append(similarities)

        if best_similarities:
            final_similarities = np.max(best_similarities, axis=0)
        else:
            X_text = self.vectorizer.transform([text])
            final_similarities = cosine_similarity(X_text, X_rules)[0]

        matched_rules = []
        for i, similarity in enumerate(final_similarities):
            if similarity > 0.15:
                rule = get_by_id(NLPScoringRule, rule_ids[i])
                if rule:
                    if not self._has_antonym_conflict(text, rule):
                        matched_rules.append((rule, similarity))

        matched_rules.sort(key=lambda x: x[1], reverse=True)

        return matched_rules[:5]

    def deep_semantic_match(self, text, intent, top_n=5):
        rules = self._get_rules_by_intent(intent)

        if not rules:
            return []

        rule_texts = []

        for rule in rules:
            texts = []
            if rule.behavior_keyword:
                texts.append(rule.behavior_keyword)
            if rule.behavior_description:
                texts.append(rule.behavior_description)
            if rule.match_pattern:
                texts.append(rule.match_pattern)
            if rule.behavior_tags:
                texts.extend(rule.behavior_tags)
            rule_texts.append(" ".join(texts))

        bm25_index = self._build_bm25_index(rule_texts)

        tfidf_similarities = []
        if self.vectorizer is not None:
            X_rules = self.vectorizer.transform(rule_texts)
            expanded_texts = self._expand_synonyms(text)[:3]

            for expanded_text in expanded_texts:
                X_text = self.vectorizer.transform([expanded_text])
                similarities = cosine_similarity(X_text, X_rules)[0]
                tfidf_similarities.append(similarities)

            if tfidf_similarities:
                tfidf_final = np.max(tfidf_similarities, axis=0)
            else:
                X_text = self.vectorizer.transform([text])
                tfidf_final = cosine_similarity(X_text, X_rules)[0]
        else:
            tfidf_final = np.zeros(len(rules))

        bm25_scores = []
        for i in range(len(rule_texts)):
            score = self._bm25_score(text, i, bm25_index)
            bm25_scores.append(score)

        max_bm25 = max(bm25_scores) if bm25_scores else 1.0
        if max_bm25 > 0:
            bm25_normalized = [s / max_bm25 for s in bm25_scores]
        else:
            bm25_normalized = bm25_scores

        bert_similarities = np.zeros(len(rules))

        keyword_matches = []
        for i, rule in enumerate(rules):
            match_score = 0.0
            if rule.behavior_keyword:
                keywords = rule.behavior_keyword.split("|")
                for kw in keywords:
                    kw = kw.strip()
                    if kw in text:
                        match_score += 0.5
                    elif any(kw in t for t in self._expand_synonyms(text)):
                        match_score += 0.3
            if rule.behavior_tags:
                for tag in rule.behavior_tags:
                    if tag in text:
                        match_score += 0.1
            keyword_matches.append(min(match_score, 1.0))

        combined_scores = []
        for i in range(len(rules)):
            combined = (
                0.2 * tfidf_final[i]
                + 0.2 * bm25_normalized[i]
                + 0.3 * bert_similarities[i]
                + 0.3 * keyword_matches[i]
            )
            combined_scores.append(combined)

        matched_rules = []
        for i, score in enumerate(combined_scores):
            if score > 0.15:
                rule = rules[i]
                if not self._has_antonym_conflict(text, rule):
                    matched_rules.append((rule, score))

        matched_rules.sort(key=lambda x: x[1], reverse=True)

        return matched_rules[:top_n]

    def context_aware_match(self, text, intent, context_history=None):
        semantic_matches = self.deep_semantic_match(text, intent)

        if context_history:
            recent_intents = context_history.get("recent_intents", [])[-5:]
            recent_rules = context_history.get("recent_rules", [])[-5:]

            for i, (rule, similarity) in enumerate(semantic_matches):
                if rule.id in recent_rules:
                    semantic_matches[i] = (rule, similarity * 1.15)
                if rule.score_type in recent_intents:
                    semantic_matches[i] = (rule, similarity * 1.1)

            semantic_matches.sort(key=lambda x: x[1], reverse=True)

        return semantic_matches[:5]

    def multi_intent_detection(self, text, behavior_result):
        text_lower = text.lower()

        detected_intents = set()
        for intent, keywords in self.intent_keywords.items():
            for kw in keywords:
                if kw in text_lower:
                    detected_intents.add(intent)

        positive_count = behavior_result["positive_count"]
        negative_count = behavior_result["negative_count"]

        if positive_count > 0 and negative_count == 0:
            detected_intents.add("add")
        elif negative_count > 0 and positive_count == 0:
            detected_intents.add("deduct")
        elif positive_count > 0 and negative_count > 0:
            detected_intents.add("add")
            detected_intents.add("deduct")

        keywords = behavior_result["keywords"]
        for kw in keywords:
            detected_intents.add(kw[2])

        if "unknown" in detected_intents and len(detected_intents) > 1:
            detected_intents.remove("unknown")

        if not detected_intents:
            detected_intents.add("unknown")

        intent_confidences = {}
        for intent in detected_intents:
            if intent == "add":
                confidence = min(1.0, positive_count * 0.3 + 0.4)
            elif intent == "deduct":
                confidence = min(1.0, negative_count * 0.3 + 0.4)
            else:
                confidence = 0.7

            intent_confidences[intent] = confidence

        sorted_intents = sorted(intent_confidences.items(), key=lambda x: x[1], reverse=True)

        return [
            {
                "intent": intent,
                "confidence": round(confidence, 4),
            }
            for intent, confidence in sorted_intents
        ]

    def ml_predict(self, text):
        prediction = self.ml_service.predict(text)
        if prediction:
            rule = get_by_id(NLPScoringRule, prediction.get("rule_id"))
            if rule and rule.is_active:
                return rule, prediction["confidence"]
        return None, 0.0

    def ensemble_predict(self, text):
        prediction = self.ml_service.ensemble_predict(text)
        if prediction:
            rule = get_by_id(NLPScoringRule, prediction.get("rule_id"))
            if rule and rule.is_active:
                return (
                    rule,
                    prediction["confidence"],
                    prediction.get("ensemble_details", []),
                )
        return None, 0.0, []

    def soft_vote_confidence(self, predictions):
        if not predictions:
            return None, 0.0

        method_weights = {
            "keyword": 0.35,
            "semantic": 0.25,
            "ml": 0.2,
            "ensemble": 0.15,
            "dynamic_weighted": 0.15,
            "context": 0.1,
            "fallback": 0.05,
        }

        rule_scores = {}

        for rule, method, confidence in predictions:
            rule_id = rule.id if hasattr(rule, "id") else id(rule)

            if rule_id not in rule_scores:
                rule_scores[rule_id] = {
                    "rule": rule,
                    "total_score": 0.0,
                    "weight_sum": 0.0,
                    "methods": [],
                }

            weight = method_weights.get(method, 0.1)
            rule_scores[rule_id]["total_score"] += confidence * weight
            rule_scores[rule_id]["weight_sum"] += weight
            rule_scores[rule_id]["methods"].append(method)

        best_rule = None
        best_score = 0.0

        for rule_id, data in rule_scores.items():
            if data["weight_sum"] > 0:
                normalized_score = data["total_score"] / data["weight_sum"]
                normalized_score *= 1 + len(data["methods"]) * 0.05

                if normalized_score > best_score:
                    best_score = normalized_score
                    best_rule = data["rule"]

        return best_rule, min(best_score, 1.0)

    def match_rule(self, text, intent, name=None):
        behavior_result = self.extract_behavior(text, name)
        matched_rules = []

        for kw, kw_type, kw_score_type, default_score in behavior_result["keywords"]:
            rules = (
                NLPScoringRule.query.filter(
                    NLPScoringRule.behavior_keyword.like(f"%{kw}%"),
                    NLPScoringRule.score_type == intent,
                    NLPScoringRule.is_active,
                )
                .order_by(
                    NLPScoringRule.priority.desc(),
                    NLPScoringRule.usage_count.desc(),
                )
                .all()
            )

            for rule in rules:
                if rule not in matched_rules:
                    keyword_score = 0.7 + len(kw) * 0.1
                    if kw_type == "strong":
                        keyword_score += 0.15
                    matched_rules.append((rule, "keyword", min(keyword_score, 0.95)))

        semantic_matches = self.semantic_match(text, intent)
        for rule, similarity in semantic_matches:
            if rule not in [r[0] for r in matched_rules]:
                matched_rules.append((rule, "semantic", similarity))

        ml_rule, ml_confidence = self.ml_predict(text)
        if ml_rule and ml_rule not in [r[0] for r in matched_rules]:
            matched_rules.append((ml_rule, "ml", ml_confidence))

        ensemble_rule, ensemble_confidence, ensemble_details = self.ensemble_predict(text)
        if ensemble_rule and ensemble_rule not in [r[0] for r in matched_rules]:
            matched_rules.append((ensemble_rule, "ensemble", ensemble_confidence))

        matched_rules.sort(key=lambda x: x[2], reverse=True)

        if not matched_rules and intent != "unknown":
            keywords = behavior_result["keywords"]
            if keywords:
                for kw, kw_type, kw_score_type, default_score in keywords:
                    if kw_score_type == intent:
                        rule = NLPScoringRule(
                            behavior_keyword=kw,
                            behavior_description=f"{kw}行为",
                            score_value=default_score or (5 if intent == "add" else -5),
                            score_type=intent,
                            behavior_tags=[kw_type],
                            match_pattern=kw,
                            priority=0,
                        )
                        matched_rules.append((rule, "fallback", 0.5))

        return [(rule, score) for rule, method, score in matched_rules[:5]]

    def _check_corrections(self, text):
        from models import NLPCorrection

        text_lower = text.lower().strip()

        corrections = []
        try:
            corrections = (
                NLPCorrection.query.filter(
                    NLPCorrection.original_text == text,
                    NLPCorrection.status == "approved",
                )
                .order_by(NLPCorrection.learn_count.desc())
                .all()
            )

            if not corrections:
                corrections = (
                    NLPCorrection.query.filter(
                        NLPCorrection.original_text == text_lower,
                        NLPCorrection.status == "approved",
                    )
                    .order_by(NLPCorrection.learn_count.desc())
                    .all()
                )
        except Exception:
            pass

        if not corrections:
            return None

        # 提取所有需要的属性，避免 DetachedInstanceError
        correction_data = []
        for corr in corrections:
            correction_data.append(
                {
                    "field_type": corr.field_type,
                    "original_value": corr.original_value,
                    "corrected_value": corr.corrected_value,
                    "learn_count": corr.learn_count or 0,
                    "id": corr.id,
                    "obj": corr,
                }
            )

        correction_map = {}
        for corr_data in correction_data:
            if corr_data["field_type"] not in correction_map:
                correction_map[corr_data["field_type"]] = corr_data

        if not correction_map:
            return None

        base_result = self.parse_without_correction(text)

        if "name" in correction_map:
            corr_data = correction_map["name"]
            name_to_id = self._get_name_to_id()
            base_result["extracted_name"] = corr_data["corrected_value"]
            base_result["user_id"] = name_to_id.get(corr_data["corrected_value"])
            corr_data["obj"].learn_count = corr_data["learn_count"] + 1
            corr_data["obj"].last_learned_at = datetime.now()

        if "intent" in correction_map:
            corr_data = correction_map["intent"]
            base_result["intent"] = corr_data["corrected_value"]
            corr_data["obj"].learn_count = corr_data["learn_count"] + 1
            corr_data["obj"].last_learned_at = datetime.now()

        if "score" in correction_map:
            corr_data = correction_map["score"]
            base_result["score"] = float(corr_data["corrected_value"])
            corr_data["obj"].learn_count = corr_data["learn_count"] + 1
            corr_data["obj"].last_learned_at = datetime.now()

        with db_session_scope():
            pass

        self._trigger_inductive_learning([c["obj"] for c in correction_data])

        cache_key = text.lower().strip()
        if len(self._parse_cache) >= self._parse_cache_max_size:
            oldest_key = next(iter(self._parse_cache))
            del self._parse_cache[oldest_key]
        self._parse_cache[cache_key] = base_result

        return base_result

    def parse_without_correction(self, text):
        name, user_id = self.extract_name(text)

        behavior_result = self.extract_behavior(text, name)
        entities = self.extract_entities(text, name)
        primary_intent = self.determine_intent(text, behavior_result)
        all_intents = self.multi_intent_detection(text, behavior_result)

        matched_rules = []
        behavior_text = behavior_result["text"]

        for intent_info in all_intents[:2]:
            intent = intent_info["intent"]
            if intent == "unknown":
                continue

            keyword_rules = []
            rules_cache = self._get_rules_by_intent(intent)
            rules_cache = self._sort_rules_by_dynamic_priority(rules_cache)

            for kw, kw_type, kw_score_type, default_score in behavior_result["keywords"]:
                if kw_score_type != intent:
                    continue

                for rule in rules_cache:
                    if rule in [r[0] for r in keyword_rules]:
                        continue

                    exact_match = False
                    position_weight = self._get_position_weight(behavior_text, kw)
                    importance_weight = self._get_keyword_importance(kw_type)

                    if kw == rule.behavior_keyword:
                        exact_match = True
                    elif rule.behavior_description and kw in rule.behavior_description:
                        exact_match = True
                    elif rule.behavior_keyword in behavior_text:
                        exact_match = True

                    if exact_match:
                        keyword_score = 0.85 + len(kw) * 0.03
                        keyword_score *= position_weight
                        keyword_score *= importance_weight
                        if kw_type == "strong":
                            keyword_score += 0.05
                        keyword_rules.append((rule, "keyword", min(keyword_score, 0.98)))
                    elif kw in rule.behavior_keyword:
                        keyword_score = 0.65 + len(kw) * 0.05
                        keyword_score *= position_weight
                        keyword_score *= importance_weight
                        if kw_type == "strong":
                            keyword_score += 0.05
                        keyword_rules.append((rule, "keyword", min(keyword_score, 0.9)))

            if not keyword_rules:
                for (
                    kw,
                    kw_type,
                    kw_score_type,
                    default_score,
                ) in behavior_result["keywords"]:
                    if kw_score_type != intent:
                        continue
                    for rule in rules_cache:
                        if rule in [r[0] for r in keyword_rules]:
                            continue
                        if kw in rule.behavior_keyword or rule.behavior_keyword in behavior_text:
                            position_weight = self._get_position_weight(behavior_text, kw)
                            importance_weight = self._get_keyword_importance(kw_type)
                            keyword_score = 0.55 + len(kw) * 0.05
                            keyword_score *= position_weight
                            keyword_score *= importance_weight
                            keyword_rules.append((rule, "keyword", min(keyword_score, 0.85)))

            matched_rules.extend(keyword_rules)

        matched_rules.sort(key=lambda x: x[2], reverse=True)

        best_rule, best_confidence = self.soft_vote_confidence(matched_rules)

        if not matched_rules and primary_intent != "unknown":
            keywords = behavior_result["keywords"]
            if keywords:
                for kw, kw_type, kw_score_type, default_score in keywords:
                    if kw_score_type == primary_intent:
                        rule = NLPScoringRule(
                            behavior_keyword=kw,
                            behavior_description=f"{kw}行为",
                            score_value=default_score or (5 if primary_intent == "add" else -5),
                            score_type=primary_intent,
                            behavior_tags=[kw_type],
                            match_pattern=kw,
                            priority=0,
                        )
                        matched_rules.append((rule, "fallback", 0.5))

        if best_rule and best_rule not in [r[0] for r in matched_rules]:
            matched_rules.insert(0, (best_rule, "soft_vote", best_confidence))

        result = {  # noqa: F841
            "success": True,
            "input_text": text,
            "extracted_name": name,
            "user_id": user_id,
            "behavior": behavior_result["text"],
            "intent": primary_intent,
            "all_intents": all_intents,
            "confidence": self._calculate_confidence(
                behavior_result, primary_intent, matched_rules
            ),
            "matched_rules": [],
            "suggestions": [],
            "matched_patterns": behavior_result["patterns"],
            "positive_count": behavior_result["positive_count"],
            "negative_count": behavior_result["negative_count"],
            "expanded_texts_count": len(behavior_result.get("expanded_texts", [])),
            "context_used": False,
            "entities": entities,
        }

        extracted_scores = entities.get("scores", [])
        if extracted_scores:
            add_scores = [
                s["value"] for s in extracted_scores if s["type"] in ("add_value", "deduct_value")
            ]
            if add_scores:
                result["score"] = add_scores[0] if primary_intent == "add" else -add_scores[0]
            else:
                first_score = extracted_scores[0]["value"]
                result["score"] = first_score if primary_intent == "add" else -first_score
        else:
            if matched_rules:
                result["score"] = matched_rules[0][0].score_value or 0
            else:
                result["score"] = 0

        for rule, method, confidence in matched_rules[:5]:
            result["matched_rules"].append(
                {
                    "rule_id": rule.id if hasattr(rule, "id") else None,
                    "behavior_keyword": rule.behavior_keyword,
                    "behavior_description": rule.behavior_description,
                    "score_value": rule.score_value,
                    "score_type": rule.score_type,
                    "behavior_tags": rule.behavior_tags,
                    "match_pattern": rule.match_pattern,
                    "priority": rule.priority,
                    "usage_count": (rule.usage_count if hasattr(rule, "usage_count") else 0),
                    "accuracy_rate": (
                        rule.accuracy_rate if hasattr(rule, "accuracy_rate") else 0.0
                    ),
                    "match_confidence": round(confidence, 2),
                    "match_method": method,
                }
            )

        if primary_intent == "unknown" or not matched_rules:
            result["success"] = False
            result["suggestions"] = self._generate_suggestions(text, behavior_result)

        return result

    def _trigger_inductive_learning(self, corrections):
        LEARN_THRESHOLD = 3

        for corr in corrections:
            if corr.learn_count >= LEARN_THRESHOLD and corr.status == "approved":
                if corr.field_type == "name":
                    if corr.original_value and corr.original_value not in self.invalid_names:
                        self.invalid_names.add(corr.original_value)

                    text = corr.original_text
                    corrected_name = corr.corrected_value
                    original_name = corr.original_value
                    if corrected_name and original_name:
                        original_pos = text.find(original_name)

                        if original_pos != -1 and corrected_pos != -1:
                            if original_pos < corrected_pos:
                                prefix = text[:original_pos]
                                if len(prefix) >= 2:
                                    prefix_pattern = re.escape(prefix) + r"[\u4e00-\u9fa5]{2}"
                                    found_existing = False
                                    for pattern in self.name_patterns:
                                        if prefix_pattern in pattern.pattern:
                                            found_existing = True
                                            break
                                    if not found_existing and len(prefix) <= 8:
                                        new_pattern = re.compile(prefix_pattern + r"(?:的)?")
                                        self.name_patterns.insert(1, new_pattern)

                elif corr.field_type == "intent":
                    if corr.corrected_value in self.intent_keywords:
                        text = corr.original_text
                        verbs = re.findall(r"([\u4e00-\u9fa5]{2})的", text)
                        for verb in verbs:
                            if verb not in self.intent_keywords[corr.corrected_value]:
                                self.intent_keywords[corr.corrected_value].append(verb)

                elif corr.field_type == "score":
                    pass

                corr.status = "learned"
                corr.verified_at = datetime.now()

        with db_session_scope():
            pass

    def parse(self, text, context_history=None):
        cache_key = text.strip().lower()
        if cache_key in self._parse_cache:
            cached_result = self._parse_cache[cache_key]
            if context_history and cached_result.get("context_used"):
                return cached_result
            print(f"[NLP缓存命中] key={cache_key[:30]}")
            return cached_result

        print(f"[NLP缓存未命中] key={cache_key[:30]}")

        correction_result = self._check_corrections(text)
        if correction_result:
            return correction_result

        name, user_id = self.extract_name(text)

        if not name and context_history:
            recent_users = context_history.get("recent_users", [])
            if recent_users:
                for referral_word in [
                    "他",
                    "她",
                    "该同学",
                    "这位同学",
                    "那位同学",
                    "同学",
                ]:
                    if referral_word in text:
                        name = recent_users[-1]
                        name_to_id = self._get_name_to_id()
                        user_id = name_to_id.get(name)
                        break

        behavior_result = self.extract_behavior(text, name)
        entities = self.extract_entities(text, name)
        primary_intent = self.determine_intent(text, behavior_result)
        all_intents = self.multi_intent_detection(text, behavior_result)

        matched_rules = []
        behavior_text = behavior_result["text"]

        for intent_info in all_intents[:2]:
            intent = intent_info["intent"]
            if intent == "unknown":
                continue

            keyword_rules = []
            rules_cache = self._get_rules_by_intent(intent)
            rules_cache = self._sort_rules_by_dynamic_priority(rules_cache)

            for kw, kw_type, kw_score_type, default_score in behavior_result["keywords"]:
                if kw_score_type != intent:
                    continue

                for rule in rules_cache:
                    if rule in [r[0] for r in keyword_rules]:
                        continue

                    exact_match = False
                    position_weight = self._get_position_weight(behavior_text, kw)
                    importance_weight = self._get_keyword_importance(kw_type)

                    if kw == rule.behavior_keyword:
                        exact_match = True
                    elif rule.behavior_description and kw in rule.behavior_description:
                        exact_match = True
                    elif rule.behavior_keyword in behavior_text:
                        exact_match = True

                    if exact_match:
                        keyword_score = 0.85 + len(kw) * 0.03
                        keyword_score *= position_weight
                        keyword_score *= importance_weight
                        if kw_type == "strong":
                            keyword_score += 0.05
                        keyword_rules.append((rule, "keyword", min(keyword_score, 0.98)))
                    elif kw in rule.behavior_keyword:
                        keyword_score = 0.65 + len(kw) * 0.05
                        keyword_score *= position_weight
                        keyword_score *= importance_weight
                        if kw_type == "strong":
                            keyword_score += 0.05
                        keyword_rules.append((rule, "keyword", min(keyword_score, 0.9)))

            if not keyword_rules:
                for (
                    kw,
                    kw_type,
                    kw_score_type,
                    default_score,
                ) in behavior_result["keywords"]:
                    if kw_score_type != intent:
                        continue
                    for rule in rules_cache:
                        if rule in [r[0] for r in keyword_rules]:
                            continue
                        if kw in rule.behavior_keyword or rule.behavior_keyword in behavior_text:
                            position_weight = self._get_position_weight(behavior_text, kw)
                            importance_weight = self._get_keyword_importance(kw_type)
                            keyword_score = 0.55 + len(kw) * 0.05
                            keyword_score *= position_weight
                            keyword_score *= importance_weight
                            keyword_rules.append((rule, "keyword", min(keyword_score, 0.85)))

            matched_rules.extend(keyword_rules)

        matched_rules.sort(key=lambda x: x[2], reverse=True)

        best_rule, best_confidence = self.soft_vote_confidence(matched_rules)

        if not matched_rules and primary_intent != "unknown":
            keywords = behavior_result["keywords"]
            if keywords:
                for kw, kw_type, kw_score_type, default_score in keywords:
                    if kw_score_type == primary_intent:
                        rule = NLPScoringRule(
                            behavior_keyword=kw,
                            behavior_description=f"{kw}行为",
                            score_value=default_score or (5 if primary_intent == "add" else -5),
                            score_type=primary_intent,
                            behavior_tags=[kw_type],
                            match_pattern=kw,
                            priority=0,
                        )
                        matched_rules.append((rule, "fallback", 0.5))

        if best_rule and best_rule not in [r[0] for r in matched_rules]:
            matched_rules.insert(0, (best_rule, "soft_vote", best_confidence))

        result = {  # noqa: F841
            "success": True,
            "input_text": text,
            "extracted_name": name,
            "user_id": user_id,
            "behavior": behavior_result["text"],
            "intent": primary_intent,
            "all_intents": all_intents,
            "confidence": self._calculate_confidence(
                behavior_result, primary_intent, matched_rules
            ),
            "matched_rules": [],
            "suggestions": [],
            "matched_patterns": behavior_result["patterns"],
            "positive_count": behavior_result["positive_count"],
            "negative_count": behavior_result["negative_count"],
            "expanded_texts_count": len(behavior_result.get("expanded_texts", [])),
            "context_used": context_history is not None
            and len(context_history.get("recent_users", [])) > 0,
            "entities": entities,
        }

        # 从entities.scores中提取分数值
        extracted_scores = entities.get("scores", [])
        if extracted_scores:
            # 优先使用add_value或deduct_value类型（明确的加/扣分数）
            add_scores = [
                s["value"] for s in extracted_scores if s["type"] in ("add_value", "deduct_value")
            ]
            if add_scores:
                result["score"] = add_scores[0] if primary_intent == "add" else -add_scores[0]
            else:
                # 使用第一个找到的分数
                first_score = extracted_scores[0]["value"]
                result["score"] = first_score if primary_intent == "add" else -first_score
        else:
            # 如果没有提取到分数，使用规则中的默认分数
            if matched_rules:
                result["score"] = matched_rules[0][0].score_value or 0
            else:
                result["score"] = 0

        for rule, method, confidence in matched_rules[:5]:
            result["matched_rules"].append(
                {
                    "rule_id": rule.id if hasattr(rule, "id") else None,
                    "behavior_keyword": rule.behavior_keyword,
                    "behavior_description": rule.behavior_description,
                    "score_value": rule.score_value,
                    "score_type": rule.score_type,
                    "behavior_tags": rule.behavior_tags,
                    "match_pattern": rule.match_pattern,
                    "priority": rule.priority,
                    "usage_count": (rule.usage_count if hasattr(rule, "usage_count") else 0),
                    "accuracy_rate": (
                        rule.accuracy_rate if hasattr(rule, "accuracy_rate") else 0.0
                    ),
                    "match_confidence": round(confidence, 2),
                    "match_method": method,
                }
            )

        if primary_intent == "unknown" or not matched_rules:
            result["success"] = False
            result["suggestions"] = self._generate_suggestions(text, behavior_result)

        if len(self._parse_cache) >= self._parse_cache_max_size:
            oldest_key = next(iter(self._parse_cache))
            del self._parse_cache[oldest_key]

        self._parse_cache[cache_key] = result

        return result

    def _calculate_confidence(self, behavior_result, intent, matched_rules):
        score = 0.0

        if intent != "unknown":
            score += 0.25

        total_keywords = behavior_result["positive_count"] + behavior_result["negative_count"]
        if total_keywords > 0:
            score += min(0.3, total_keywords * 0.08)

        if behavior_result["patterns"]:
            score += 0.15

        expanded_count = behavior_result.get("expanded_texts_count", 0)
        if expanded_count > 1:
            score += min(0.1, expanded_count * 0.02)

        if matched_rules:
            avg_confidence = sum(confidence for _, _, confidence in matched_rules) / len(
                matched_rules
            )
            score += min(0.4, avg_confidence * 0.4)

        return round(min(1.0, score), 2)

    def _generate_suggestions(self, text, behavior_result):
        suggestions = []

        if behavior_result["positive_count"] > behavior_result["negative_count"]:
            suggestions.append(
                {
                    "intent": "add",
                    "score_value": 5,
                    "description": "根据行为描述，建议加分",
                }
            )
        elif behavior_result["negative_count"] > behavior_result["positive_count"]:
            suggestions.append(
                {
                    "intent": "deduct",
                    "score_value": -5,
                    "description": "根据行为描述，建议扣分",
                }
            )

        rules = NLPScoringRule.query.filter(NLPScoringRule.is_active).all()
        if rules and self.vectorizer:
            rule_texts = [f"{r.behavior_keyword} {r.behavior_description}" for r in rules]
            X_rules = self.vectorizer.transform(rule_texts)

            expanded_texts = self._expand_synonyms(behavior_result["text"])
            best_similarities = []

            for expanded_text in expanded_texts:
                X_text = self.vectorizer.transform([expanded_text])
                similarities = cosine_similarity(X_text, X_rules)[0]
                best_similarities.append(similarities)

            if best_similarities:
                final_similarities = np.max(best_similarities, axis=0)
            else:
                X_text = self.vectorizer.transform([behavior_result["text"]])
                final_similarities = cosine_similarity(X_text, X_rules)[0]

            top_indices = final_similarities.argsort()[-5:][::-1]
            for idx in top_indices:
                if final_similarities[idx] > 0.2:
                    rule = rules[idx]
                    suggestions.append(
                        {
                            "intent": rule.score_type,
                            "score_value": rule.score_value,
                            "description": (f"相似规则: {rule.behavior_description}"),
                            "rule_id": rule.id,
                            "similarity": round(final_similarities[idx], 2),
                        }
                    )

        return suggestions

    def execute_scoring(self, text, manual_correction=None, context_history=None):
        parse_result = self.parse(text, context_history=context_history)

        # S6-B-P0-2 修复: 复合句（"张三加分，李四扣分"）原静默只执行第一人/第一条规则 → 漏记。
        # 不支持多目标执行，改为明确提示逐条确认（诚实拒绝而非静默丢）。
        valid_intents = [
            i
            for i in parse_result.get("all_intents", [])
            if isinstance(i, dict) and i.get("intent") not in ("unknown", "query")
        ]
        if len(valid_intents) > 1:
            return {
                "success": False,
                "message": "检测到多条评分指令，请逐条确认执行（当前仅支持单条指令）",
                "parse_result": parse_result,
            }

        if not parse_result["success"] and not manual_correction:
            # S6-B-P0-6 修复: 空行为词库/无匹配规则时如实说明（原统一"无法识别意图"误导）
            intent_hint = parse_result.get("intent")
            if intent_hint in ("add", "deduct"):
                message = (
                    "已识别为%s指令但无匹配的行为规则（行为词库可能为空或未配置），请手动确认"
                    % ("加分" if intent_hint == "add" else "扣分")
                )
            else:
                message = "无法识别意图，请手动确认"
            return {
                "success": False,
                "message": message,
                "parse_result": parse_result,
            }

        if manual_correction:
            intent = manual_correction.get("intent", parse_result["intent"])
            score_value = manual_correction.get("score_value", 0)
            # S6-B-P0-3 修复: 分数符号按意图归一化（deduct 误存正数 → 扣分变加分）
            if intent == "deduct" and score_value is not None and score_value > 0:
                score_value = -score_value
            elif intent == "add" and score_value is not None and score_value < 0:
                score_value = -score_value
            behavior_tags = manual_correction.get("behavior_tags", [])
            behavior_description = manual_correction.get(
                "behavior_description", parse_result["behavior"]
            )

            rule = NLPScoringRule.query.filter(
                NLPScoringRule.behavior_keyword == behavior_description[:100],
                NLPScoringRule.score_type == intent,
            ).first()

            # 注意：构造 rule 后不要用 db_session_scope()——其 finally 会 session.remove()
            # 导致 rule 脱离会话，后续访问 rule.id/behavior_keyword 会抛 "not bound to a Session"。
            # 这里直接 add+flush 获取 rule.id 并保持附着。
            if not rule:
                rule = NLPScoringRule(
                    behavior_keyword=behavior_description[:100],
                    behavior_description=behavior_description,
                    score_value=score_value,
                    score_type=intent,
                    behavior_tags=behavior_tags,
                    created_by=manual_correction.get("created_by"),
                )
                db.session.add(rule)
                db.session.flush()

            parse_result["matched_rules"] = [
                {
                    "rule_id": rule.id,
                    "behavior_keyword": rule.behavior_keyword,
                    "behavior_description": rule.behavior_description,
                    "score_value": rule.score_value,
                    "score_type": rule.score_type,
                    "behavior_tags": rule.behavior_tags,
                }
            ]
        else:
            if not parse_result["matched_rules"]:
                return {
                    "success": False,
                    "message": "未找到匹配规则",
                    "parse_result": parse_result,
                }

            rule = get_by_id(NLPScoringRule, parse_result["matched_rules"][0]["rule_id"])
            if rule:
                # usage_count 列无默认值，新规则为 None，直接 += 1 会 TypeError 500
                rule.usage_count = (rule.usage_count or 0) + 1
                rule.last_used_at = datetime.now()
                score_value = rule.score_value
                # S6-B-P0-3 修复: 分数符号按规则 score_type 归一化（deduct 规则误存正数 → 扣分变加分）
                if rule.score_type == "deduct" and score_value is not None and score_value > 0:
                    score_value = -score_value
                elif rule.score_type == "add" and score_value is not None and score_value < 0:
                    score_value = -score_value
            else:
                score_value = parse_result["matched_rules"][0]["score_value"]
                behavior_desc = parse_result["matched_rules"][0]["behavior_description"]
                rule = NLPScoringRule(
                    behavior_keyword=behavior_desc[:100],
                    behavior_description=behavior_desc,
                    score_value=score_value,
                    score_type=parse_result["intent"],
                    behavior_tags=parse_result["matched_rules"][0].get("behavior_tags", []),
                    created_by=1,
                )
                db.session.add(rule)
                db.session.flush()

        user = get_by_id(User, parse_result.get("user_id"))
        if not user:
            # 规则已匹配但学生不存在（如文本中的姓名不在用户表）：
            # 不能静默"评分成功"，否则前端误报而分数实际未应用。
            name_hint = parse_result.get("extracted_name") or parse_result.get("name") or ""
            if name_hint:
                message = f"未找到学生「{name_hint}」，无法应用评分，请先在学生管理中创建该学生"
            else:
                message = "未能从文本中识别到学生姓名，无法应用评分"
            return {
                "success": False,
                "message": message,
                "parse_result": parse_result,
            }

        if user:
            old_score = user.current_score or 0
            # S2 修复: 走标准积分链路——原直接 max(0,min(100,current+delta))：
            # 不写流水/不原子（并发丢更新）/限额写死 0-100（非 SystemConfig）/不触发综合分重算。
            from models import ScoreRecord, SystemConfig as _SysCfg
            from utils.score_utils import atomic_score_update

            _cfg = _SysCfg.query.first()
            _min_s = _cfg.min_score if _cfg else 0
            _max_s = _cfg.max_score if _cfg else 100
            _ok, final_score = atomic_score_update(
                user.id, score_value, min_score=_min_s, max_score=_max_s
            )
            if not _ok:
                final_score = max(_min_s, min(_max_s, old_score + score_value))
            user.current_score = final_score
            user.updated_at = datetime.now()

            from utils.logger import log_operation

            action = "加分" if final_score - old_score >= 0 else "减分"
            description = (
                f"智能评分{action}: {user.name} {action}{abs(final_score - old_score)}分，"
                f"原因: {getattr(rule, 'behavior_description', '') or ''}"
            )

            log_operation(
                operation_type="score_update",
                target_type="user",
                target_id=user.id,
                description=description,
                before_data={"score": old_score},
                after_data={"score": final_score},
            )

            # S2 修复: 补积分流水（与手动录入一致），规则为 NLP 规则（非 ScoreRule）→ rule_id 置空，
            # 规则信息进描述，避免外键语义错位。
            db.session.add(
                ScoreRecord(
                    student_id=user.id,
                    rule_id=None,
                    score_change=final_score - old_score,
                    description=description,
                    operator="NLP System",
                )
            )

            # S2 修复: 触发综合评分重算（与手动/批量/审批/MQTT 路径一致）
            try:
                from services.composite_score_service import CompositeScoreService

                CompositeScoreService.recalculate_user_score(user.id)
            except Exception:
                pass

            usage_record = NLPRuleUsage(
                rule_id=rule.id,
                student_id=user.id,
                input_text=text,
                matched_keyword=rule.behavior_keyword,
                score_change=final_score - old_score,
                is_manual_correction=manual_correction is not None,
            )

            match_result = NLPMatchResult(
                input_text=text,
                matched_rule_id=rule.id if rule else None,
                matched_keyword=rule.behavior_keyword if rule else parse_result["behavior"],
                intent=parse_result["intent"],
                confidence=parse_result["confidence"],
                student_id=parse_result["user_id"],
                behavior_description=parse_result["behavior"],
                score_change=score_value,
                is_manual_correction=manual_correction is not None,
            )

            with db_session_scope():

                db.session.add(usage_record)
                db.session.add(match_result)

            self._update_context_memory(
                user_name=user.name,
                rule_id=rule.id,
                intent=parse_result["intent"],
            )

        return {
            "success": True,
            "message": "评分成功",
            "parse_result": parse_result,
            "user_id": parse_result["user_id"],
            "score_change": score_value,
            "new_score": user.current_score if user else None,
        }

    def batch_parse(self, texts, parallel: bool = True, max_workers: int = 4):
        """
        批量解析文本

        :param texts: 文本列表
        :param parallel: 是否使用并行处理
        :param max_workers: 最大工作线程数
        :return: 解析结果列表
        """
        if not texts:
            return []

        # 小批量直接处理
        if len(texts) <= 5 or not parallel:
            return [self.parse(text) for text in texts]

        # 大批量并行处理
        try:
            from concurrent.futures import ThreadPoolExecutor

            results = [None] * len(texts)
            lock = threading.Lock()

            def parse_with_index(idx_text):
                idx, text = idx_text
                try:
                    result = self.parse(text)  # noqa: F841
                    with lock:
                        results[idx] = result
                    return result
                except Exception as e:
                    print(f"[ERROR] batch_parse failed for text {text[:20]}...: {e}")
                    with lock:
                        results[idx] = {
                            "success": False,
                            "input_text": text,
                            "error": str(e),
                        }
                    return None

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = executor.map(parse_with_index, enumerate(texts))
                list(futures)  # 等待所有任务完成

            return results
        except ImportError:
            # 回退到串行处理
            return [self.parse(text) for text in texts]
        except Exception as e:
            print(f"[ERROR] batch_parse parallel failed: {e}")
            return [self.parse(text) for text in texts]

    def analyze_sentiment(self, text):
        if self.jieba_initialized:
            words = jieba.lcut(text)
        else:
            words = [text]

        positive_count = sum(1 for word in words if word in self.positive_keywords)
        negative_count = sum(1 for word in words if word in self.negative_keywords)

        total = positive_count + negative_count
        if total == 0:
            return {
                "sentiment": "neutral",
                "score": 0.0,
                "positive_count": 0,
                "negative_count": 0,
            }

        sentiment_score = (positive_count - negative_count) / total

        if sentiment_score > 0.2:
            sentiment = "positive"
        elif sentiment_score < -0.2:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        return {
            "sentiment": sentiment,
            "score": round(sentiment_score, 4),
            "positive_count": positive_count,
            "negative_count": negative_count,
        }


_nlp_parser_instance = None


def get_nlp_parser():
    global _nlp_parser_instance
    if _nlp_parser_instance is None:
        _nlp_parser_instance = EnhancedNLPParserService()  # noqa: F841
    return _nlp_parser_instance
