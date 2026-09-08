"""
NLP 智能评分 execute_scoring 正确性测试

覆盖回归：规则已匹配但文本中的学生不在用户表（user_id=None）时，
execute_scoring 必须返回失败并明确提示"未找到学生"，且不得：
- 返回 success=True 让前端误报"评分成功"
- 写入任何 NLPMatchResult / NLPRuleUsage 记录
- 修改任何用户分数

测试构造用 __new__ 跳过重型 __init__（torch/sklearn/jieba），
仅 patch parse 方法，隔离出 execute_scoring 自身的判定逻辑。
"""

import pytest
from models import User, NLPScoringRule, NLPMatchResult, NLPRuleUsage, db
from services.nlp_enhanced_service import EnhancedNLPParserService


def _make_parser(parse_result):
    """构造一个轻量 parser 实例：跳过 __init__，仅 stub parse。"""
    svc = EnhancedNLPParserService.__new__(EnhancedNLPParserService)
    svc.parse = lambda text, context_history=None: parse_result
    svc.context_memory = {
        "recent_users": [],
        "recent_rules": [],
        "recent_intents": [],
        "max_memory_size": 10,
    }
    return svc


def _base_parse_result(rule_id, user_id, name):
    return {
        "success": True,
        "intent": "add",
        "behavior": "上课认真",
        "confidence": 0.95,
        "extracted_name": name,
        "user_id": user_id,
        "matched_rules": [
            {
                "rule_id": rule_id,
                "score_value": 5,
                "behavior_description": "上课认真",
                "intent": "add",
                "behavior_tags": [],
            }
        ],
    }


def test_execute_scoring_rejects_user_not_in_db(app, db_session):
    """规则匹配成功但学生不在库中 → 拒绝应用，不写任何记录。"""
    user = User(name="王五", card_id="W001", current_score=0)
    db_session.add(user)
    rule = NLPScoringRule(
        behavior_keyword="上课认真",
        behavior_description="上课认真",
        score_value=5,
        score_type="add",
        behavior_tags=[],
    )
    db_session.add(rule)
    db_session.commit()

    parse_result = _base_parse_result(rule.id, None, "张三")
    svc = _make_parser(parse_result)
    result = svc.execute_scoring("张三 上课认真 加5分")

    assert result["success"] is False
    assert "张三" in result["message"]
    assert "未找到学生" in result["message"]

    # 用户分数未被修改
    db_session.refresh(user)
    assert user.current_score == 0

    # 未写入任何匹配/使用记录
    assert db_session.query(NLPMatchResult).count() == 0
    assert db_session.query(NLPRuleUsage).count() == 0


def test_execute_scoring_rejects_unknown_name(app, db_session):
    """姓名完全未识别（extracted_name 为空）但规则已匹配 → 明确提示无法应用。"""
    rule = NLPScoringRule(
        behavior_keyword="上课认真",
        behavior_description="上课认真",
        score_value=5,
        score_type="add",
        behavior_tags=[],
    )
    db_session.add(rule)
    db_session.commit()

    parse_result = _base_parse_result(rule.id, None, "")
    svc = _make_parser(parse_result)
    result = svc.execute_scoring("今天上课认真 加5分")

    assert result["success"] is False
    assert "未能从文本中识别到学生姓名" in result["message"]
    assert db_session.query(NLPMatchResult).count() == 0


def test_execute_scoring_applies_when_user_exists(app, db_session):
    """学生存在时评分正常应用（回归守卫，防止误伤正常路径）。"""
    user = User(name="王五", card_id="W001", current_score=10)
    db_session.add(user)
    rule = NLPScoringRule(
        behavior_keyword="上课认真",
        behavior_description="上课认真",
        score_value=5,
        score_type="add",
        behavior_tags=[],
    )
    db_session.add(rule)
    db_session.commit()

    parse_result = _base_parse_result(rule.id, user.id, "王五")
    svc = _make_parser(parse_result)
    result = svc.execute_scoring("王五 上课认真 加5分")

    assert result["success"] is True
    assert result["new_score"] == 15
    db_session.refresh(user)
    assert user.current_score == 15


def test_execute_scoring_manual_correction_overrides_user(app, db_session):
    """#912 手动修正接管学生：parse_result.user_id 错（NLP 误识）但 manual_correction
    指定 user_id → 应按指定学生评分成功，前端手动修正真正生效。"""
    user_real = User(name="何伟", card_id="H001", current_score=50)
    db_session.add(user_real)
    rule = NLPScoringRule(
        behavior_keyword="上课玩手机",
        behavior_description="上课玩手机",
        score_value=5,
        score_type="deduct",
        behavior_tags=[],
    )
    db_session.add(rule)
    db_session.commit()

    # parse_result 模拟 NLP 误识：user_id=None（解析失败）+ extracted_name="上课玩手机"
    parse_result = _base_parse_result(rule.id, None, "上课玩手机")
    svc = _make_parser(parse_result)

    manual_correction = {
        "user_id": user_real.id,
        "intent": "deduct",
        "score_value": 5,
        "behavior_description": "上课玩手机",
        "behavior_tags": [],
    }
    result = svc.execute_scoring("何伟 上课玩手机", manual_correction=manual_correction)

    assert result["success"] is True
    assert result["new_score"] == 45  # 50 - 5
    db_session.refresh(user_real)
    assert user_real.current_score == 45

    # #912 手动修正路径的规则必须 is_active=True（新建或复用旧规则都强制启用，
    # 否则列表/自动匹配不可见，出现"后台没添加"观感）
    created_rule = (
        NLPScoringRule.query.filter_by(behavior_keyword="上课玩手机", score_type="deduct")
        .order_by(NLPScoringRule.id.desc())
        .first()
    )
    assert created_rule is not None
    assert created_rule.is_active is True

    # 第二次手动修正同一行为 → 复用已有规则，不再重复创建
    before_count = NLPScoringRule.query.filter_by(behavior_keyword="上课玩手机").count()
    result2 = svc.execute_scoring("何伟 上课玩手机", manual_correction=manual_correction)
    assert result2["success"] is True
    after_count = NLPScoringRule.query.filter_by(behavior_keyword="上课玩手机").count()
    assert after_count == before_count


def test_execute_scoring_manual_correction_corrected_name(app, db_session):
    """manual_correction 只给 corrected_name（无 user_id）→ 按名查学生。"""
    user_real = User(name="张三", card_id="Z001", current_score=20)
    db_session.add(user_real)
    rule = NLPScoringRule(
        behavior_keyword="迟到",
        behavior_description="迟到",
        score_value=3,
        score_type="deduct",
        behavior_tags=[],
    )
    db_session.add(rule)
    db_session.commit()

    parse_result = _base_parse_result(rule.id, None, "迟到")  # 误识
    svc = _make_parser(parse_result)

    manual_correction = {
        "corrected_name": "张三",
        "intent": "deduct",
        "score_value": 3,
        "behavior_description": "迟到",
        "behavior_tags": [],
    }
    result = svc.execute_scoring("张三 迟到", manual_correction=manual_correction)

    assert result["success"] is True
    assert result["new_score"] == 17
    db_session.refresh(user_real)
    assert user_real.current_score == 17


def test_execute_scoring_compound_splits_and_scores_each(app, db_session):
    """#991: 复合句（多意图）须逐子句贯通评分并落库多条记录，而非静默只执行首条/诚实拒绝。"""
    from models import ScoreRecord

    user_z = User(name="张三", card_id="Z001", current_score=10)
    user_l = User(name="李四", card_id="L001", current_score=20)
    db_session.add_all([user_z, user_l])
    rule_add = NLPScoringRule(
        behavior_keyword="加5分",
        behavior_description="加5分",
        score_value=5,
        score_type="add",
        behavior_tags=[],
    )
    rule_ded = NLPScoringRule(
        behavior_keyword="扣3分",
        behavior_description="扣3分",
        score_value=3,
        score_type="deduct",
        behavior_tags=[],
    )
    db_session.add_all([rule_add, rule_ded])
    db_session.commit()

    def _compound_parse(text, context_history=None):
        if text == "张三加5分，李四扣3分":
            return {
                "success": True,
                "intent": "add",
                "behavior": "复合",
                "confidence": 0.9,
                "extracted_name": None,
                "user_id": None,
                "matched_rules": [],
                "all_intents": [{"intent": "add"}, {"intent": "deduct"}],
            }
        if text == "张三加5分":
            return {
                "success": True,
                "intent": "add",
                "behavior": "加5分",
                "confidence": 0.95,
                "extracted_name": "张三",
                "user_id": user_z.id,
                "matched_rules": [
                    {
                        "rule_id": rule_add.id,
                        "score_value": 5,
                        "behavior_description": "加5分",
                        "intent": "add",
                        "behavior_tags": [],
                    }
                ],
            }
        if text == "李四扣3分":
            return {
                "success": True,
                "intent": "deduct",
                "behavior": "扣3分",
                "confidence": 0.95,
                "extracted_name": "李四",
                "user_id": user_l.id,
                "matched_rules": [
                    {
                        "rule_id": rule_ded.id,
                        "score_value": 3,
                        "behavior_description": "扣3分",
                        "intent": "deduct",
                        "behavior_tags": [],
                    }
                ],
            }
        return {
            "success": False,
            "intent": "unknown",
            "behavior": "",
            "confidence": 0.0,
            "extracted_name": None,
            "user_id": None,
            "matched_rules": [],
            "all_intents": [],
        }

    svc = EnhancedNLPParserService.__new__(EnhancedNLPParserService)
    svc.parse = _compound_parse
    svc.context_memory = {
        "recent_users": [],
        "recent_rules": [],
        "recent_intents": [],
        "max_memory_size": 10,
    }

    result = svc.execute_scoring("张三加5分，李四扣3分")
    assert result["success"] is True, result
    assert "results" in result
    assert result["count"] == 2
    assert all(r.get("success") for r in result["results"])

    db_session.refresh(user_z)
    db_session.refresh(user_l)
    assert user_z.current_score == 15  # 10 + 5
    assert user_l.current_score == 17  # 20 - 3

    # 复合句须落库两条积分流水（每条指令一条），而非仅首条
    assert db_session.query(ScoreRecord).count() == 2
    assert db_session.query(NLPMatchResult).count() == 2
    assert db_session.query(NLPRuleUsage).count() == 2


def test_execute_scoring_compound_partial_failure_reported(app, db_session):
    """#991: 复合句中某子句失败时，整体 success=False 且 results 如实标注失败项（不静默丢）。"""
    from models import ScoreRecord

    user_z = User(name="张三", card_id="Z002", current_score=10)
    db_session.add(user_z)
    rule_add = NLPScoringRule(
        behavior_keyword="加5分",
        behavior_description="加5分",
        score_value=5,
        score_type="add",
        behavior_tags=[],
    )
    db_session.add(rule_add)
    db_session.commit()

    def _compound_parse(text, context_history=None):
        if text == "张三加5分，王五扣3分":
            return {
                "success": True,
                "intent": "add",
                "behavior": "复合",
                "confidence": 0.9,
                "extracted_name": None,
                "user_id": None,
                "matched_rules": [],
                "all_intents": [{"intent": "add"}, {"intent": "deduct"}],
            }
        if text == "张三加5分":
            return {
                "success": True,
                "intent": "add",
                "behavior": "加5分",
                "confidence": 0.95,
                "extracted_name": "张三",
                "user_id": user_z.id,
                "matched_rules": [
                    {
                        "rule_id": rule_add.id,
                        "score_value": 5,
                        "behavior_description": "加5分",
                        "intent": "add",
                        "behavior_tags": [],
                    }
                ],
            }
        # "王五扣3分"：王五不存在 → execute_scoring 返回失败
        return {
            "success": True,
            "intent": "deduct",
            "behavior": "扣3分",
            "confidence": 0.9,
            "extracted_name": "王五",
            "user_id": None,
            "matched_rules": [],
            "all_intents": [{"intent": "deduct"}],
        }

    svc = EnhancedNLPParserService.__new__(EnhancedNLPParserService)
    svc.parse = _compound_parse
    svc.context_memory = {
        "recent_users": [],
        "recent_rules": [],
        "recent_intents": [],
        "max_memory_size": 10,
    }

    result = svc.execute_scoring("张三加5分，王五扣3分")
    assert result["success"] is False
    assert result["count"] == 2
    assert any(not r.get("success") for r in result["results"])

    db_session.refresh(user_z)
    assert user_z.current_score == 15  # 张三成功加分
    # 仅张三那条落库，王五未找到学生不落库
    assert db_session.query(ScoreRecord).count() == 1
