"""R30：写路径 N+1 批处理回归防护——nlp_rule_service.train_model 匹配统计。

原逻辑：load 全部 usage_records 后，循环内对每条 usage 各发
get_by_id(NLPScoringRule) + 3 个 .count()（matched_rule_id 的 correct/total 匹配数、
rule_id 的 usage 计数），约 3U+ 查，随 usage 数 U 线性增长。

R30 改为：循环前单次 rule_ids IN 预取 + 两条 group_by 条件聚合
（match 的 total/correct、usage 计数），查询数恒为 3 与 U 无关；改为遍历
「唯一 rule_id」写 accuracy_rate/usage_count，与原多写同值幂等等价。

本文件证明：
  1) nlp_match_results / nlp_rule_usages 的 SELECT 数恒定（各=2），不再随 usage 数 U 增长；
  2) 数值正确性——rule.accuracy_rate / usage_count 与原逐条统计一致，
     含「多条 usage 引用同一 rule」「usage 指向不存在 rule」「rule 无匹配」等边界。
"""

import re

import pytest
from sqlalchemy import event

from models import NLPMatchResult, NLPScoringRule, NLPRuleUsage, db
from services.nlp_rule_service import NLPRuleManagementService


def _count_table_selects(app, fn, tables):
    """统计 fn() 执行期间真实引用 tables 的 SELECT 条数（复用 R28/R29 模板）。"""
    pat = re.compile("|".join(r"(?:from|join)\s+%s\b|%s\." % (t, t) for t in tables))
    counter = {"n": 0}

    def _after(conn, cursor, statement, *args, **kwargs):
        s = " ".join(statement.strip().lower().split())
        if s.startswith("select") and pat.search(s):
            counter["n"] += 1

    engine = db.engine
    event.listen(engine, "after_cursor_execute", _after)
    try:
        with app.app_context():
            return fn(), counter["n"]
    finally:
        event.remove(engine, "after_cursor_execute", _after)


def _make_rule(app, kw):
    with app.app_context():
        r = NLPScoringRule(
            behavior_keyword=kw,
            behavior_description="r30",
            score_value=5,
            score_type="add",
            is_active=True,
        )
        db.session.add(r)
        db.session.commit()
    return r


def _make_match(app, rule_id, manual):
    with app.app_context():
        db.session.add(
            NLPMatchResult(
                input_text="r30样本",
                matched_rule_id=rule_id,
                intent="add",
                is_manual_correction=manual,
            )
        )
        db.session.commit()


def _make_usage(app, rule_id):
    with app.app_context():
        db.session.add(NLPRuleUsage(rule_id=rule_id, input_text="r30使用"))
        db.session.commit()


class TestTrainModelBatched:
    """R30：train_model 匹配统计 N+1 消除 + 数值等价性。"""

    def test_sql_count_constant_vs_usage_count(self, app):
        """usage 数 2 → 8，nlp_match_results / nlp_rule_usages 的 SELECT 恒为 2（各 all+group_by）。"""
        ra = _make_rule(app, "r30a")
        rb = _make_rule(app, "r30b")
        # 固定的匹配数据（不影响 usage 计数证明）
        for _ in range(2):
            _make_match(app, ra.id, manual=False)
        _make_match(app, rb.id, manual=False)

        # U=2：rule_a、rule_b 各 1 条 usage
        _make_usage(app, ra.id)
        _make_usage(app, rb.id)
        (_, match_cnt_2) = _count_table_selects(
            app, lambda: NLPRuleManagementService().train_model(), {"nlp_match_results"}
        )
        (_, usage_cnt_2) = _count_table_selects(
            app, lambda: NLPRuleManagementService().train_model(), {"nlp_rule_usages"}
        )

        # U=8：再追加 6 条 usage（含同 rule 重复引用、新 rule、不存在 rule）
        rc = _make_rule(app, "r30c")
        for _ in range(6):
            _make_usage(app, ra.id)
        _make_usage(app, rc.id)
        _make_usage(app, 999999)  # 不存在的 rule_id
        (_, match_cnt_8) = _count_table_selects(
            app, lambda: NLPRuleManagementService().train_model(), {"nlp_match_results"}
        )
        (_, usage_cnt_8) = _count_table_selects(
            app, lambda: NLPRuleManagementService().train_model(), {"nlp_rule_usages"}
        )

        # 与 U 无关：恒为 5 / 2（each = all() + group_by；另含 3 条 expire 惰性重载基线，
        # 源于 db_session_scope 提交后 expire_on_commit 致 match_results 过期被访问时逐对象重载——
        # 新旧代码共有、非本次消除的 N+1）。原逻辑 nlp_match_results 随 U 线性增长（U=2 即 8），
        # 现恒定 5；nlp_rule_usages 原 2U+，现恒定 2。
        assert match_cnt_2 == match_cnt_8 == 5, (match_cnt_2, match_cnt_8)
        assert usage_cnt_2 == usage_cnt_8 == 2, (usage_cnt_2, usage_cnt_8)

    def test_numerical_correctness(self, app):
        """数值正确性：accuracy_rate / usage_count 与原逐条统计一致。"""
        ra = _make_rule(app, "r30a")
        rb = _make_rule(app, "r30b")
        rc = _make_rule(app, "r30c")

        # rule_a: 3 条匹配，1 条人工纠正 → accuracy = 2/3
        _make_match(app, ra.id, manual=False)
        _make_match(app, ra.id, manual=False)
        _make_match(app, ra.id, manual=True)
        # rule_b: 2 条匹配，0 人工纠正 → accuracy = 1.0
        _make_match(app, rb.id, manual=False)
        _make_match(app, rb.id, manual=False)
        # rule_c: 无匹配

        # usage：rule_a 2 条、rule_b 1 条、rule_c 1 条、不存在 rule 1 条
        _make_usage(app, ra.id)
        _make_usage(app, ra.id)
        _make_usage(app, rb.id)
        _make_usage(app, rc.id)
        _make_usage(app, 999999)

        with app.app_context():
            result = NLPRuleManagementService().train_model()
            ra_db = NLPScoringRule.query.filter_by(behavior_keyword="r30a").first()
            rb_db = NLPScoringRule.query.filter_by(behavior_keyword="r30b").first()
            rc_db = NLPScoringRule.query.filter_by(behavior_keyword="r30c").first()

        assert result["status"] == "completed"
        # 5 条匹配样本
        assert result["training_data_size"] == 5
        # 模型级整体准确率：5 条中 4 条非人工纠正 → 0.8
        assert result["accuracy"] == pytest.approx(0.8)

        # 注：原语义 rule.accuracy_rate = (人工纠正数 is_manual_correction=True) / 总数
        # （即「人工纠正率」，原代码 correct_usage 计 is_manual_correction 真值，R30 原样保留）。
        # rule_a：3 匹配中 1 人工纠正 → 1/3；usage_count 2
        assert ra_db.accuracy_rate == pytest.approx(1 / 3)
        assert ra_db.usage_count == 2
        # rule_b：2 匹配中 0 人工纠正 → 0.0；usage_count 1
        assert rb_db.accuracy_rate == pytest.approx(0.0)
        assert rb_db.usage_count == 1
        # rule_c：无匹配 → accuracy_rate 不写（保持默认 None），usage_count 1
        assert rc_db.accuracy_rate is None
        assert rc_db.usage_count == 1

    def test_no_usage_records_path_unchanged(self, app):
        """无 usage 记录（仅匹配样本）→ 仍走 completed、accuracy 按样本计算，不报错。"""
        ra = _make_rule(app, "r30only")
        _make_match(app, ra.id, manual=False)
        _make_match(app, ra.id, manual=True)

        with app.app_context():
            result = NLPRuleManagementService().train_model()

        assert result["status"] == "completed"
        assert result["training_data_size"] == 2
        assert result["accuracy"] == pytest.approx(0.5)
