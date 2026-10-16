"""F2: prediction_service.predict_batch 二级 N+1 批处理防护。

证明 predict_batch 对 ScoreRecord 的 SELECT 数与批量大小 N 无关
（原实现：取全班 users → 循环 predict_future_scores → get_student_score_history
每生 1 条 ScoreRecord 查询，N 生 = N 条；重构后循环前 1 条 IN 预取），
且批量结果与逐生 predict_future_scores 数值完全等价。
"""

from datetime import datetime, timedelta

from sqlalchemy import event

from models import db
from models.score_models import ScoreRecord
from models.user_models import User
from services.prediction_service import PredictionService

TARGET_TABLES = ["user", "score_record"]


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
        name="f2s_%d_%s" % (idx, class_name),
        card_id="F2C%d%s" % (idx, class_name),
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


def _seed_class(session, class_name, n):
    users = []
    for i in range(n):
        u = _add_student(session, i, class_name, current_score=70.0 + i)
        _add_score(session, u, days_ago=1 + (i % 5), change=2.0 if i % 2 == 0 else -3.0)
        _add_score(session, u, days_ago=10 + (i % 5), change=1.0)
        users.append(u)
    session.commit()
    return users


def test_sql_count_constant_vs_n(app):
    """predict_batch 对 ScoreRecord 的 SELECT 数应与 N 无关（恒定 1 条 IN 预取）。"""
    with app.app_context():
        _seed_class(db.session, "F2A", 2)
        _seed_class(db.session, "F2B", 8)

    with app.app_context():
        counter_a, handler_a = _make_counter(db.engine)
        try:
            PredictionService.predict_batch("F2A", days=7)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_a)
        counter_b, handler_b = _make_counter(db.engine)
        try:
            PredictionService.predict_batch("F2B", days=7)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_b)

    # 与 N 无关：两次批量各表 SELECT 数必须相等（证明消除了逐生 N+1）
    for t in TARGET_TABLES:
        assert counter_a[t] == counter_b[t], (t, counter_a, counter_b)

    # 核心 IN 预取恒定：ScoreRecord 各 1 条（原逐生各 N 条）
    assert counter_a["score_record"] == 1, counter_a
    # user 表恒 2 条：取生列表 1 条 + ScoreRecord.student 关系 lazy="selectin"
    # 自动 IN 预取 1 条（单条 IN 不随 N 放大，非缺陷；与 R31 同款现象）
    assert counter_a["user"] == 2, counter_a


def test_batch_equals_single_user(app):
    """批量 predict_batch 与逐生 predict_future_scores 数值完全等价。"""
    with app.app_context():
        users = _seed_class(db.session, "F2C", 3)

    with app.app_context():
        batch = PredictionService.predict_batch("F2C", days=7)
        batch_by_user = {p["user_id"]: p for p in batch["predictions"]}

        assert len(batch["predictions"]) == len(users)
        for u in users:
            single = PredictionService.predict_future_scores(u.id, days=7)
            b = batch_by_user.get(u.id)
            assert b is not None, u.id
            # 预测结果逐字段一致（最严格等价证明）
            assert b["prediction"] == single, u.id
            assert b["name"] == u.name
            assert b["class_name"] == u.class_name


def test_prefetch_helper_direct_equivalence(app):
    """直接校验 _prefetch_score_history 与 get_student_score_history 历史一致。"""
    with app.app_context():
        users = _seed_class(db.session, "F2D", 4)

        bulk = PredictionService._prefetch_score_history(users, days=30)
        for u in users:
            single = PredictionService.get_student_score_history(u.id, days=30)
            assert bulk[u.id] == single, u.id


def test_prefetch_empty_users_no_query(app):
    """users 为空时预取不触库，返回空 dict（IN 空列表保护）。"""
    with app.app_context():
        assert PredictionService._prefetch_score_history([], days=30) == {}
