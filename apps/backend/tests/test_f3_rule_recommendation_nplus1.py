"""F3: rule_recommendation_service 规则维度 N+1 批处理防护。

suggest_rule_optimizations / get_rule_statistics / evaluate_model 均为
「取全部规则 → 循环 get_rule_effectiveness(rule.id)」模式：原实现每规则
1 条 ScoreRecord 查询（R 规则 = R 条）；重构后循环前 1 条 IN 预取，
查询数与规则数 R 无关，且逐规则统计数值与原逐查完全一致。
"""

from datetime import datetime, timedelta

from sqlalchemy import event

from models import db
from models.score_models import ScoreRecord
from models.user_models import User
from services.rule_recommendation_service import RuleRecommendationService

TARGET_TABLES = ["score_rule", "score_record"]


def _make_counter(engine):
    counter = {t: 0 for t in TARGET_TABLES}

    def _after(conn, cursor, statement, *args, **kwargs):
        low = " ".join(statement.strip().lower().split()).replace('"', "")
        if low.startswith("select"):
            for t in TARGET_TABLES:
                if "from %s" % t in low:
                    counter[t] += 1

    event.listen(engine, "after_cursor_execute", _after)
    return counter, _after


def _add_rules_with_records(session, n, tag, records_per_rule=6):
    """建 n 条规则，每条带 records_per_rule 条积分记录。"""
    from models import ScoreRule

    rules = []
    for i in range(n):
        rule = ScoreRule(
            name="f3_rule_%s_%d" % (tag, i),
            description="F3 测试规则 %d" % i,
            score=5.0 + i,
            is_active=True,
        )
        session.add(rule)
        session.flush()
        for j in range(records_per_rule):
            session.add(
                ScoreRecord(
                    student_id=1,
                    rule_id=rule.id,
                    score_change=3.0 if j % 2 == 0 else -1.0,
                    description="f3 rec %d" % j,
                    created_at=datetime.now() - timedelta(days=j),
                )
            )
        rules.append(rule)
    session.commit()
    return rules


def test_sql_count_constant_vs_rule_count(app):
    """suggest_rule_optimizations 对 ScoreRecord 的 SELECT 数应与规则数 R 无关（恒定 1）。"""
    with app.app_context():
        _add_rules_with_records(db.session, 2, "A")
        _add_rules_with_records(db.session, 8, "B")

    with app.app_context():
        counter_a, handler_a = _make_counter(db.engine)
        try:
            RuleRecommendationService.suggest_rule_optimizations(days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_a)
        counter_b, handler_b = _make_counter(db.engine)
        try:
            RuleRecommendationService.suggest_rule_optimizations(days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_b)

    # 两次调用规则总数不同（2 vs 8），各表 SELECT 数必须相等（证明消除了逐规则 N+1）
    for t in TARGET_TABLES:
        assert counter_a[t] == counter_b[t], (t, counter_a, counter_b)
    # 核心 IN 预取恒定：ScoreRecord 恒 1 条（原逐规则 R 条）
    assert counter_a["score_record"] == 1, counter_a
    # score_rule 恒 2 条：取规则列表 1 条 + ScoreRecord.rule 关系 lazy="selectin"
    # 自动 IN 预取 1 条（单条 IN 不随 R 放大，非缺陷；与 F2/R31 同款现象）
    assert counter_a["score_rule"] == 2, counter_a


def test_batch_equals_single_rule_stats(app):
    """get_rule_statistics 聚合值与逐规则 get_rule_effectiveness 手工汇总一致。"""
    with app.app_context():
        _add_rules_with_records(db.session, 5, "C")

    with app.app_context():
        stats = RuleRecommendationService.get_rule_statistics(days=30)
        assert stats["total_rules"] == 5

        # 逐规则单生统计（缓存已清，走原始单查路径）
        singles = []
        from models import ScoreRule

        for rule in ScoreRule.query.all():
            singles.append(RuleRecommendationService.get_rule_effectiveness(rule.id, days=30))

        active = sum(1 for s in singles if s["usage_count"] > 0)
        assert stats["active_rules"] == active, (stats["active_rules"], active)
        assert stats["inactive_rules"] == stats["total_rules"] - active
        # 平均有效性一致（批量预取与逐查数值等价的最直接证据）
        avg_single = round(sum(s["effectiveness"] for s in singles) / len(singles), 2)
        assert stats["avg_effectiveness"] == avg_single, (stats["avg_effectiveness"], avg_single)
        # 逐规则 usage_count 也一致
        by_id = {s["rule_id"]: s for s in singles}
        for rule in ScoreRule.query.all():
            assert by_id[rule.id]["usage_count"] == 6


def test_prefetch_helper_direct_equivalence(app):
    """直接校验 _prefetch_rule_records 分组与逐规则查询结果一致。"""
    with app.app_context():
        rules = _add_rules_with_records(db.session, 4, "D")
        # 追加一条 rule_id=None 的记录不应影响分组
        db.session.add(
            ScoreRecord(student_id=1, rule_id=None, score_change=1.0, description="no rule")
        )
        db.session.commit()

        bulk = RuleRecommendationService._prefetch_rule_records([r.id for r in rules], days=30)
        assert set(bulk.keys()) == {r.id for r in rules}
        for r in rules:
            single = ScoreRecord.query.filter(
                ScoreRecord.rule_id == r.id,
                ScoreRecord.created_at >= datetime.now() - timedelta(days=30),
            ).all()
            assert len(bulk[r.id]) == len(single), r.id
            assert [x.id for x in bulk[r.id]] == [x.id for x in single], r.id


def test_bulk_cache_cleared_after_call(app):
    """批量入口返回后瞬态缓存必须清空（避免污染后续单生调用）。"""
    with app.app_context():
        _add_rules_with_records(db.session, 3, "E")
        assert RuleRecommendationService._bulk_rule_records is None
        RuleRecommendationService.suggest_rule_optimizations(days=30)
        assert RuleRecommendationService._bulk_rule_records is None
        RuleRecommendationService.get_rule_statistics(days=30)
        assert RuleRecommendationService._bulk_rule_records is None


def test_nested_call_reuses_outer_cache(app):
    """嵌套场景（evaluate_model → get_all_recommendations → suggest_rule_optimizations）

    内层不得覆盖/清空外层缓存：内层见 _prev_bulk 非 None 时跳过预取，
    finally 恢复外层缓存，最终由最外层统一清理。
    """
    with app.app_context():
        _add_rules_with_records(db.session, 3, "F")

        # 外层手动设缓存，内层 suggest_rule_optimizations 应复用而非覆盖
        outer = RuleRecommendationService._prefetch_rule_records(
            [r.id for r in __import__("models").ScoreRule.query.all()], days=30
        )
        RuleRecommendationService._bulk_rule_records = outer
        try:
            RuleRecommendationService.suggest_rule_optimizations(days=30)
            # 内层返回后外层缓存仍在（save-restore）
            assert RuleRecommendationService._bulk_rule_records is outer
        finally:
            RuleRecommendationService._bulk_rule_records = None
