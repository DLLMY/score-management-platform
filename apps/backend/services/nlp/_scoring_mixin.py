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
from utils.logger import log_debug, log_warning


class _ScoringMixin:
    """NLP 解析服务按领域拆分出的 mixin（组合进 EnhancedNLPParserService，行为不变）。"""
    def parse(self, text, context_history=None):
        cache_key = text.strip().lower()
        if cache_key in self._parse_cache:
            cached_result = self._parse_cache[cache_key]
            if context_history and cached_result.get("context_used"):
                return cached_result
            log_debug(f"[NLP缓存命中] key={cache_key[:30]}")
            return cached_result

        log_debug(f"[NLP缓存未命中] key={cache_key[:30]}")

        correction_result = self._check_corrections(text)
        if correction_result:
            return correction_result

        name, user_id = self.extract_name(text)
        if not name and context_history:
            ctx_name, ctx_id = self._resolve_context_user(text, context_history)
            if ctx_name is not None:
                name, user_id = ctx_name, ctx_id

        behavior_result = self.extract_behavior(text, name)
        entities = self.extract_entities(text, name)
        primary_intent = self.determine_intent(text, behavior_result)
        all_intents = self.multi_intent_detection(text, behavior_result)

        matched_rules = self._assemble_matched_rules(behavior_result, primary_intent, all_intents)

        result = {
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

        result["score"] = self._extract_parse_score(entities, primary_intent, matched_rules)
        self._populate_matched_rules(result, matched_rules)

        if primary_intent == "unknown" or not matched_rules:
            result["success"] = False
            result["suggestions"] = self._generate_suggestions(text, behavior_result)

        if len(self._parse_cache) >= self._parse_cache_max_size:
            oldest_key = next(iter(self._parse_cache))
            del self._parse_cache[oldest_key]

        self._parse_cache[cache_key] = result

        return result


    def _resolve_context_user(self, text, context_history):
        recent_users = context_history.get("recent_users", [])
        if not recent_users:
            return None, None
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
                return name, name_to_id.get(name)
        return None, None



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


    def _split_compound_text(self, text):
        """按中英文标点拆分复合句为子句，过滤空串与纯空白。

        #991 复合句逐子句贯通评分：'张三加5分，李四扣3分' -> ['张三加5分', '李四扣3分']。
        仅按标点拆分（不含空格），避免破坏单意图短语中的空格。
        """
        import re

        if not text:
            return []
        parts = re.split(r"[，,；;。.、！!？?\n\r]+", text)
        return [p.strip() for p in parts if p and p.strip()]


    def execute_scoring(self, text, manual_correction=None, context_history=None, sub_clause=False):
        parse_result = self.parse(text, context_history=context_history)

        compound = self._try_compound_scoring(text, context_history, parse_result, sub_clause)
        if compound is not None:
            return compound

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
            rule, score_value = self._resolve_manual_rule(manual_correction, parse_result)
        else:
            rule, score_value = self._resolve_auto_rule(parse_result)
            if rule is None:
                return {
                    "success": False,
                    "message": "未找到匹配规则",
                    "parse_result": parse_result,
                }

        user = self._resolve_scoring_user(manual_correction, parse_result)
        if not user:
            return self._user_not_found_result(parse_result)

        final_score, old_score, action, description = self._compute_final_score(
            user, score_value, rule
        )
        self._persist_score_records(
            user, rule, score_value, final_score, old_score, description, text, parse_result, manual_correction
        )

        return {
            "success": True,
            "message": "评分成功",
            "parse_result": parse_result,
            "user_id": parse_result["user_id"],
            "score_change": score_value,
            "new_score": user.current_score if user else None,
        }


    def _try_compound_scoring(self, text, context_history, parse_result, sub_clause):
        # #991 修复: 复合句（"张三加5分，李四扣3分"）原"逐条确认"诚实拒绝 → 改为逐子句贯通评分，
        # 每条指令独立落库一条 ScoreRecord，端点返回 results 列表（全量贯通，不再静默漏记首条之外）。
        valid_intents = [
            i
            for i in parse_result.get("all_intents", [])
            if isinstance(i, dict) and i.get("intent") not in ("unknown", "query")
        ]
        if len(valid_intents) <= 1 or sub_clause:
            return None
        subclauses = self._split_compound_text(text)
        if len(subclauses) > 1:
            results = []
            any_failed = False
            for sub in subclauses:
                sub_result = self.execute_scoring(sub, None, context_history, sub_clause=True)
                results.append(sub_result)
                if not sub_result.get("success"):
                    any_failed = True
            return {
                "success": not any_failed,
                "message": (
                    f"已对 {len(subclauses)} 条指令逐条评分"
                    + ("（部分未成功）" if any_failed else "，全部成功")
                ),
                "results": results,
                "count": len(results),
            }
        # 无法按句拆分的多意图（极罕见，如单句含多意图且无分隔）→ 保留诚实拒绝，避免静默漏记
        return {
            "success": False,
            "message": "检测到多条评分指令且无法按句拆分，请逐条确认执行",
            "parse_result": parse_result,
        }


    def _normalize_score_sign(self, intent, score_value):
        # S6-B-P0-3 修复: 分数符号按意图归一化（deduct 误存正数 → 扣分变加分）
        if score_value is None:
            return score_value
        if intent == "deduct" and score_value > 0 or intent == "add" and score_value < 0:
            return -score_value
        return score_value


    def _resolve_manual_rule(self, manual_correction, parse_result):
        intent = manual_correction.get("intent", parse_result["intent"])
        score_value = manual_correction.get("score_value", 0)
        score_value = self._normalize_score_sign(intent, score_value)
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
                # #912 手动修正创建的规则必须立即可见/可匹配：
                # 之前未设 is_active(None) → 列表/自动匹配 filter(is_active) 都不命中，
                # 且每次手动修正都因匹配不到而重复新建规则（56/58 双份"上课玩手机"根因）
                is_active=True,
                created_at=datetime.now(),
            )
            db.session.add(rule)
            db.session.flush()
        elif rule.is_active is not True:
            # #912 复用旧规则（行为关键词+意图匹配未过滤 is_active）时强制启用——
            # 历史手动修正创建的规则 is_active=None 导致"后台没添加"的观感
            rule.is_active = True

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
        return rule, score_value


    def _resolve_auto_rule(self, parse_result):
        if not parse_result["matched_rules"]:
            return None, None
        rule = get_by_id(NLPScoringRule, parse_result["matched_rules"][0]["rule_id"])
        if rule:
            # usage_count 列无默认值，新规则为 None，直接 += 1 会 TypeError 500
            rule.usage_count = (rule.usage_count or 0) + 1
            rule.last_used_at = datetime.now()
            score_value = rule.score_value
            score_value = self._normalize_score_sign(rule.score_type, score_value)
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
                is_active=True,
                created_at=datetime.now(),
            )
            db.session.add(rule)
            db.session.flush()
        return rule, score_value


    def _resolve_scoring_user(self, manual_correction, parse_result):
        # #912 手动修正接管学生：manual_correction 显式指定 user_id 或 corrected_name 时
        # 覆盖 parse_result 的错误识别（如 NLP 把"上课玩手机"当学生名），让手动修正真正生效
        _mc_user_id = (manual_correction or {}).get("user_id") if manual_correction else None
        _mc_user_name = (
            (manual_correction or {}).get("corrected_name") if manual_correction else None
        )
        if _mc_user_id:
            return get_by_id(User, _mc_user_id)
        if _mc_user_name:
            return User.query.filter(User.name == _mc_user_name, User.is_active).first()
        return get_by_id(User, parse_result.get("user_id"))


    def _user_not_found_result(self, parse_result):
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


    def _compute_final_score(self, user, score_value, rule):
        old_score = user.current_score or 0
        # S2 修复: 走标准积分链路——原直接 max(0,min(100,current+delta))：
        # 不写流水/不原子（并发丢更新）/限额写死 0-100（非 SystemConfig）/不触发综合分重算。
        from models import SystemConfig as _SysCfg
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
        return final_score, old_score, action, description


    def _persist_score_records(
        self, user, rule, score_value, final_score, old_score, description, text, parse_result, manual_correction
    ):
        # S2 修复: 补积分流水（与手动录入一致），规则为 NLP 规则（非 ScoreRule）→ rule_id 置空，
        # 规则信息进描述，避免外键语义错位。
        from models import ScoreRecord

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
            from services.score_recalc import enqueue_or_recalc_user_score

            enqueue_or_recalc_user_score(user.id)
        except Exception as e:
            logging.getLogger(__name__).error(
                "[CompositeScore] NLP 评分重算综合分失败 user_id=%s: %s", user.id, e,
                exc_info=True,
            )

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

        # 注意：不得用 db_session_scope()——其 finally 会 session.remove() 销毁请求级
        # session（同 2974 行注释警告），导致后续访问 user.name 抛 DetachedInstanceError 500，
        # 且 add 的 usage_record/match_result 随 remove 被丢弃不落库。直接 add+commit 即可
        # （顺带 flush 未提交的 ScoreRecord 流水）。
        db.session.add(usage_record)
        db.session.add(match_result)
        db.session.commit()

        self._update_context_memory(
            user_name=user.name,
            rule_id=rule.id,
            intent=parse_result["intent"],
        )



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
                    result = self.parse(text)
                    with lock:
                        results[idx] = result
                    return result
                except Exception as e:
                    log_warning(
                        f"[ERROR] batch_parse failed for text {text[:20]}...: {e}", exception=e
                    )
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
            log_warning(f"[ERROR] batch_parse parallel failed: {e}", exception=e)
            return [self.parse(text) for text in texts]
