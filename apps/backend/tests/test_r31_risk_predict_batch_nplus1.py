import re
from datetime import datetime, timedelta

import pytest
from sqlalchemy import event

from models import db
from models.attendance import Attendance
from models.notify_models import Approval
from models.score_models import ScoreRecord
from models.user_models import User
from services.risk_predict_service import RiskPredictService

TARGET_TABLES = ["user", "score_record", "attendance", "approval"]


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


def _add_student(session, idx, class_name, current_score):
    u = User(
        name="r31s_%d_%s" % (idx, class_name),
        card_id="R31C%d%s" % (idx, class_name),
        class_name=class_name,
        current_score=current_score,
        role="student",
    )
    session.add(u)
    session.flush()
    return u


def _add_score(session, user, days_ago, change):
    session.add(
        ScoreRecord(
            student_id=user.id,
            score_change=change,
            created_at=datetime.now() - timedelta(days=days_ago),
        )
    )


def _add_attendance(session, user, days_ago, status):
    session.add(
        Attendance(
            student_id=user.id,
            class_id=1,
            date=(datetime.now() - timedelta(days=days_ago)).date(),
            status=status,
        )
    )


def _add_leave(session, user, start_days_ago, end_days_ago):
    session.add(
        Approval(
            student_id=user.id,
            type="leave",
            status="approved",
            start_date=(datetime.now() - timedelta(days=start_days_ago)).date(),
            end_date=(datetime.now() - timedelta(days=end_days_ago)).date(),
        )
    )


def _seed_class(session, class_name, n):
    users = []
    for i in range(n):
        u = _add_student(session, i, class_name, current_score=80.0 + i)
        _add_score(session, u, days_ago=1 + (i % 5), change=2.0 if i % 2 == 0 else -3.0)
        _add_score(session, u, days_ago=10 + (i % 5), change=1.0)
        _add_attendance(session, u, days_ago=2, status="present")
        _add_attendance(session, u, days_ago=5, status="absent" if i % 3 == 0 else "late")
        if i % 2 == 0:
            _add_leave(session, u, start_days_ago=6, end_days_ago=4)
        users.append(u)
    session.commit()
    return users


def test_sql_count_constant_vs_n(app):
    """predict_batch 对目标表 SELECT 数应与批量大小 N 无关（恒定）。"""
    with app.app_context():
        _seed_class(db.session, "R31A", 2)
        _seed_class(db.session, "R31B", 8)

    with app.app_context():
        counter_a, handler_a = _make_counter(db.engine)
        try:
            RiskPredictService.predict_batch("R31A", days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_a)
        counter_b, handler_b = _make_counter(db.engine)
        try:
            RiskPredictService.predict_batch("R31B", days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_b)

    # 与 N 无关：两次批量各表 SELECT 数必须相等（证明消除了逐生 N+1）
    for t in TARGET_TABLES:
        assert counter_a[t] == counter_b[t], (t, counter_a, counter_b)

    # 核心 IN 预取恒定：ScoreRecord/Attendance/Approval 各 1 条 IN（原逐生各 N 条）
    assert counter_a["score_record"] == 1, counter_a
    assert counter_a["attendance"] == 1, counter_a
    assert counter_a["approval"] == 1, counter_a
    # user 表查询数（取生列表 + 关系 selectin 预取 + 班级聚合）与 N 无关（原逐生 get_by_id + selectin 随 N 放大）
    assert counter_a["user"] == counter_b["user"], (counter_a, counter_b)


def test_batch_equals_single_user(app):
    """批量 predict_batch 与逐生 predict_risk 数值等价（共用 _build_risk_features）。"""
    with app.app_context():
        users = _seed_class(db.session, "R31C", 3)

    with app.app_context():
        batch = RiskPredictService.predict_batch("R31C", days=30)
        batch_by_user = {r["user_id"]: r for r in batch["results"]}

        for u in users:
            single = RiskPredictService.predict_risk(u.id, days=30)
            b = batch_by_user.get(u.id)
            assert b is not None, u.id
            # 标量结果一致
            assert b["overall_risk_level"] == single["overall_risk_level"]
            assert b["overall_risk_score"] == single["overall_risk_score"]
            # 特征逐字段一致（最严格等价证明）
            assert b["features"] == single["features"]


def test_bulk_helper_direct_equivalence(app):
    """直接校验 get_risk_features_bulk 与 get_risk_features 特征一致。"""
    with app.app_context():
        users = _seed_class(db.session, "R31D", 4)

        bulk = RiskPredictService.get_risk_features_bulk(users, days=30)
        for u in users:
            single = RiskPredictService.get_risk_features(u.id, days=30)
            assert bulk[u.id] == single, u.id
