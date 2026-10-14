"""R24 回归：6 处纯只读 COUNT/聚合合并为单条条件聚合（同 R23 C3/C4 模式，零契约变更）。

注：原第 7 处 composite_score 取分+排名合并因破坏既有 mock 单测（test_composite_score_service）已回退，保留其余 6 处。

每个测试类做两件事：
1. SQL 计数 harness 验证目标表的 SELECT 数 == 合并后的最小条数（证明 N+1/多查询已收口）；
2. 契约（返回 dict 的 key 集合）保持不变；
3. 对最易出错的 score_statistics 子查询汇总补充数值正确性。
"""

import re

from sqlalchemy import event

from models import ScoreRecord, User, db
from services.alert_service import AlertService
from services.analysis_service import analysis_service
from services.dashboard_service import dashboard_service
from services.nlp_rule_service import NLPRuleManagementService
from services.score_record_service import get_score_statistics
from services.security_service import get_audit_stats


def _count_table_selects(app, fn, tables, warmup=None):
    """统计 fn() 执行期间真实引用 tables 的 SELECT 条数（R22/R23 同款 harness）。"""
    pat = re.compile(
        "|".join(r"(?:from|join)\s+%s\b|%s\." % (t, t) for t in tables)
    )
    counter = {"n": 0}

    def _after(conn, cursor, statement, *args, **kwargs):
        s = " ".join(statement.strip().lower().split())
        if s.startswith("select") and pat.search(s):
            counter["n"] += 1

    engine = db.engine
    event.listen(engine, "after_cursor_execute", _after)
    try:
        with app.app_context():
            if warmup is not None:
                warmup()
                counter["n"] = 0  # 预热（含懒加载 DB 初始化）查询不计入
            return fn(), counter["n"]
    finally:
        event.remove(engine, "after_cursor_execute", _after)


def _flush_dashboard_cache():
    try:
        from services.redis_cache_service import get_cache_service

        get_cache_service().delete("dashboard_data")
    except Exception:
        pass


class TestR24AnalysisAggregation:
    """R24-1：analysis_service.get_dashboard_summary 月/周/日嵌套窗 + 双 User 计数合并。"""

    def test_score_record_merged_to_one(self, app):
        (_, cnt) = _count_table_selects(app, analysis_service.get_dashboard_summary, {"score_record"})
        assert cnt == 1, cnt  # 原 today/week/month 3 条 -> 1 条

    def test_user_queries_two(self, app):
        (_, cnt) = _count_table_selects(app, analysis_service.get_dashboard_summary, {"user"})
        assert cnt == 2, cnt  # total_users 计数 + class_list 分组（students 已并入分组）

    def test_contract_keys(self, app):
        (res, _) = _count_table_selects(app, analysis_service.get_dashboard_summary, set())
        assert set(res.keys()) == {"today", "week", "month", "totals", "top_classes"}
        assert set(res["today"].keys()) == {"active_users", "unlock_count", "new_records"}
        assert set(res["week"].keys()) == {"unlock_count", "avg_daily"}
        assert set(res["month"].keys()) == {"unlock_count", "total_cost", "avg_daily"}
        assert set(res["totals"].keys()) == {"users", "students", "classes"}

    def test_numeric(self, app, db_session):
        u1 = User(name="R24A", card_id="R24C1", class_name="RC1", is_active=True, current_score=100)
        u2 = User(name="R24B", card_id="R24C2", class_name="RC1", is_active=True)
        u3 = User(name="R24C", card_id="R24C3", class_name=None, is_active=True)
        u4 = User(name="R24D", card_id="R24C4", class_name="RC2", is_active=False)
        db_session.add_all([u1, u2, u3, u4])
        db_session.commit()
        for sc, desc in [(5, "开锁 X"), (-3, "开锁 Y"), (2, "普通")]:
            db_session.add(ScoreRecord(student_id=u1.id, score_change=sc, description=desc))
        db_session.commit()

        res = analysis_service.get_dashboard_summary()
        assert res["today"]["unlock_count"] == 2
        assert res["today"]["new_records"] == 3
        assert res["today"]["active_users"] == 1
        assert res["month"]["total_cost"] == 3  # abs(sum 负数)
        assert res["totals"]["users"] == 3  # 活跃 3（u4 停用）
        assert res["totals"]["students"] == 2  # 有班级名的活跃 2（u1,u2）
        assert res["totals"]["classes"] == 1  # 仅 RC1 有活跃学生
        assert res["top_classes"][0]["name"] == "RC1"


class TestR24NlpRuleStatistics:
    """R24-2：规则/用量/匹配三类计数各自合并为单条条件聚合。"""

    def test_query_count(self, app):
        svc = NLPRuleManagementService()
        (_, cnt) = _count_table_selects(
            app, svc.get_rule_statistics, {"nlp_scoring_rules", "nlp_rule_usages", "nlp_match_results"}
        )
        assert cnt == 4, cnt  # 规则合并(1)+high_usage(1)+usage(1)+match(1)；原 7

    def test_contract_keys(self, app):
        svc = NLPRuleManagementService()
        (res, _) = _count_table_selects(app, svc.get_rule_statistics, set())
        assert set(res.keys()) == {
            "total_rules",
            "add_rules",
            "deduct_rules",
            "total_usage",
            "manual_corrections",
            "accuracy_rate",
            "high_usage_rules",
        }


class TestR24AlertStats:
    """R24-3：告警 total/unread/today 三类计数合并为单条条件聚合。"""

    def test_query_count(self, app):
        svc = AlertService()
        (_, cnt) = _count_table_selects(app, svc.get_alert_stats, {"alert"})
        assert cnt == 2, cnt  # 合并(1)+severity group_by(1)；原 4

    def test_contract_keys(self, app):
        svc = AlertService()
        (res, _) = _count_table_selects(app, svc.get_alert_stats, set())
        assert res is not None
        assert set(res.keys()) == {"total", "unread", "by_severity", "today_count"}


class TestR24SecurityAuditStats:
    """R24-4：安全审计 total/last_24h/last_7d 三类重叠窗计数合并为单条条件聚合。"""

    def test_query_count(self, app):
        (_, cnt) = _count_table_selects(app, get_audit_stats, {"security_audits"})
        assert cnt == 4, cnt  # 合并(1)+severity(1)+type(1)+top_ips(1)；原 6

    def test_contract_keys(self, app):
        (res, _) = _count_table_selects(app, get_audit_stats, set())
        assert set(res.keys()) == {
            "total",
            "last_24h",
            "last_7d",
            "by_severity",
            "by_type",
            "top_ips",
        }


class TestR24DashboardData:
    """R24-5：dashboard 今日/近7日/近7日正向 三类重叠窗计数合并为单条条件聚合。"""

    def test_score_record_merged_to_two(self, app):
        (_, cnt) = _count_table_selects(
            app,
            dashboard_service.get_dashboard_data,
            {"score_record"},
            warmup=lambda: (_flush_dashboard_cache(), dashboard_service.get_dashboard_data(), _flush_dashboard_cache()),
        )
        assert cnt == 2, cnt  # 合并(1)+category_stats group_by(1)；原 4

    def test_contract_keys(self, app):
        (res, _) = _count_table_selects(
            app,
            dashboard_service.get_dashboard_data,
            set(),
            warmup=lambda: _flush_dashboard_cache(),
        )
        assert set(res.keys()) == {
            "total_users",
            "total_admins",
            "total_rules",
            "total_devices",
            "online_devices",
            "today_records",
            "weekly_records",
            "positive_ratio",
            "avg_score",
            "top_users",
            "category_stats",
        }


class TestR24ScoreStatistics:
    """R24-6：积分统计总数 + 加分/减分汇总合并为单条查询（消除原 IN 子查询，省 1 查）。"""

    def test_query_count(self, app):
        (_, cnt) = _count_table_selects(
            app, lambda: get_score_statistics(user_id=1), {"score_record"}
        )
        assert cnt == 2, cnt  # 子查询汇总(1)+today_count(1)；原 3

    def test_contract_keys(self, app):
        (res, _) = _count_table_selects(app, lambda: get_score_statistics(), set())
        assert set(res.keys()) == {
            "total_records",
            "total_add",
            "total_subtract",
            "net_change",
            "today_count",
        }

    def test_numeric(self, app, db_session):
        for sc in (10.0, 5.0, -3.0):
            db_session.add(ScoreRecord(student_id=1, score_change=sc))
        db_session.commit()

        res = get_score_statistics(user_id=1)
        assert res["total_records"] == 3
        assert res["total_add"] == 15.0
        assert res["total_subtract"] == 3.0
        assert res["net_change"] == 12.0
        assert res["today_count"] == 3

