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
