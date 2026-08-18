import re
import jieba
from datetime import datetime
from models import NLPScoringRule, NLPBehaviorKeyword, NLPMatchResult, NLPRuleUsage, User, get_by_id, db
from utils.db_session import db_session_scope


class NLPParserService:
    """自然语言解析服务"""

    def __init__(self):
        self.jieba_initialized = False
        self._init_jieba()
        self.positive_keywords = {
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
        }
        self.negative_keywords = {
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
        }
        self.name_patterns = [
            re.compile(r"([\u4e00-\u9fa5]{2,4})(?:同学|的|在|上课|今天|昨天|刚才)"),
            re.compile(r"(?:是|为|给|对|让)([\u4e00-\u9fa5]{2,4})"),
            re.compile(r"^([\u4e00-\u9fa5]{2,4})"),
        ]

    def _init_jieba(self):
        if not self.jieba_initialized:
            try:
                jieba.initialize()
                self.jieba_initialized = True
            except Exception:
                self.jieba_initialized = False

    def extract_name(self, text):
        """从文本中提取学生姓名"""
        text = text.strip()

        all_users = User.query.filter(User.is_active).all()
        user_names = {u.name for u in all_users}
        name_to_id = {u.name: u.id for u in all_users}

        for name in user_names:
            if name in text:
                return name, name_to_id[name]

        for pattern in self.name_patterns:
            match = pattern.search(text)
            if match:
                name = match.group(1)
                if 2 <= len(name) <= 4 and not any(char in "同学上课昨天今天刚才为给对让是" for char in name):
                    existing_user = User.query.filter_by(name=name).first()
                    if existing_user:
                        return name, existing_user.id
                    return name, None

        return None, None

    def extract_behavior(self, text, name=None):
        """提取行为描述"""
        text = text.strip()

        if name:
            text_no_name = text.replace(name, "").replace(name + "同学", "")
        else:
            text_no_name = text

        behavior_keywords = NLPBehaviorKeyword.query.all()
        matched_keywords = []
        for kw in behavior_keywords:
            if kw.keyword in text_no_name:
                matched_keywords.append(
                    (
                        kw.keyword,
                        kw.keyword_type,
                        kw.score_type,
                        kw.default_score,
                    )
                )
                for synonym in kw.synonyms:
                    if synonym in text_no_name and synonym not in [k[0] for k in matched_keywords]:
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
                    kw = NLPBehaviorKeyword.query.filter_by(keyword=word).first()
                    if kw and word not in [k[0] for k in matched_keywords]:
                        matched_keywords.append(
                            (
                                word,
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
            "positive_count": positive_count,
            "negative_count": negative_count,
            "text": text_no_name.strip(),
        }

    def determine_intent(self, text, behavior_result):
        """确定评分意图（加分/扣分）"""
        positive_count = behavior_result["positive_count"]
        negative_count = behavior_result["negative_count"]

        if "扣分" in text:
            return "deduct"
        if "加分" in text:
            return "add"
        # 单字「扣/加」仅在后接数字（如「扣5分」「加3分」）时判定，
        # 避免「加强管理」「扣工资」等含单字但非加减分意图的文本误判
        import re

        if re.search(r"扣\s*\d", text):
            return "deduct"
        if re.search(r"加\s*\d", text):
            return "add"

        if negative_count > positive_count:
            return "deduct"
        elif positive_count > negative_count:
            return "add"
        else:
            keywords = behavior_result["keywords"]
            if keywords:
                for kw in keywords:
                    if kw[2] == "deduct":
                        return "deduct"
                    if kw[2] == "add":
                        return "add"

        return "unknown"

    def match_rule(self, text, intent, name=None):
        """匹配评分规则"""
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
                    matched_rules.append(rule)

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
                        matched_rules.append(rule)

        return matched_rules[:3]

    def parse(self, text, context_history=None):
        """完整解析自然语言文本"""
        name, user_id = self.extract_name(text)
        behavior_result = self.extract_behavior(text, name)
        intent = self.determine_intent(text, behavior_result)
        matched_rules = self.match_rule(text, intent, name)

        result = {  # noqa: F841
            "success": True,
            "input_text": text,
            "extracted_name": name,
            "user_id": user_id,
            "behavior": behavior_result["text"],
            "intent": intent,
            "confidence": self._calculate_confidence(behavior_result, intent, matched_rules),
            "matched_rules": [],
            "suggestions": [],
        }

        for rule in matched_rules:
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
                    "accuracy_rate": (rule.accuracy_rate if hasattr(rule, "accuracy_rate") else 0.0),
                }
            )

        if intent == "unknown" or not matched_rules:
            result["success"] = False
            result["suggestions"] = self._generate_suggestions(text, behavior_result)

        return result

    def _calculate_confidence(self, behavior_result, intent, matched_rules):
        """计算匹配置信度"""
        score = 0.0

        if intent != "unknown":
            score += 0.3

        if behavior_result["positive_count"] + behavior_result["negative_count"] > 0:
            score += 0.2

        if matched_rules:
            score += min(0.5, len(matched_rules) * 0.2)

        return round(score, 2)

    def _generate_suggestions(self, text, behavior_result):
        """生成建议"""
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

        return suggestions

    def execute_scoring(self, text, manual_correction=None, context_history=None):
        """执行评分"""
        parse_result = self.parse(text)

        if not parse_result["success"] and not manual_correction:
            return {
                "success": False,
                "message": "无法识别意图，请手动确认",
                "parse_result": parse_result,
            }

        if manual_correction:
            intent = manual_correction.get("intent", parse_result["intent"])
            score_value = manual_correction.get("score_value", 0)
            behavior_tags = manual_correction.get("behavior_tags", [])
            behavior_description = manual_correction.get("behavior_description", parse_result["behavior"])

            rule = NLPScoringRule.query.filter(
                NLPScoringRule.behavior_keyword == behavior_description[:100],
                NLPScoringRule.score_type == intent,
            ).first()

            # 注意：不要在构造 rule 后使用 db_session_scope()——其 finally 会
            # session.remove() 导致 rule 脱离会话，后续访问 rule.id/behavior_keyword
            # 会抛 "not bound to a Session"。这里直接 flush() 获取 rule.id 并保持附着。
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
                rule.usage_count += 1
                score_value = rule.score_value
            else:
                score_value = parse_result["matched_rules"][0]["score_value"]

        user = get_by_id(User, parse_result["user_id"])
        if user:
            user.current_score = max(0, min(100, user.current_score + score_value))
            user.updated_at = datetime.now()

            usage_record = NLPRuleUsage(
                rule_id=rule.id,
                student_id=user.id,
                input_text=text,
                matched_keyword=rule.behavior_keyword,
                score_change=score_value,
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
                from models import db

                db.session.add(usage_record)
                db.session.add(match_result)
        else:
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

                db.session.add(match_result)

        return {
            "success": True,
            "message": "评分成功",
            "parse_result": parse_result,
            "user_id": parse_result["user_id"],
            "score_change": score_value,
            "new_score": user.current_score if user else None,
        }

    def batch_parse(self, texts):
        """批量解析"""
        results = []
        for text in texts:
            results.append(self.parse(text))
        return results
