"""F1: score_predict_service 批量入口二级 N+1 批处理防护。

predict_batch / get_score_distribution / train_score_model / evaluate_score_model
均为「取全部学生 → 循环 predict_exam_score/get_student_features」模式：
原实现每生 3 查（get_by_id(User) + ScoreRecord + 班级排名 User.query），
N 生 = 3N+1；重构后循环前预取（ScoreRecord IN + user 复用 + 班级 per-class），
查询数恒定与 N 无关，且预测结果与逐生完全一致。
"""

from datetime import datetime, timedelta

from sqlalchemy import event

from models import db
from models.score_models import ScoreRecord
from models.user_models import User
from services.score_predict_service import ScorePredictService

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
        name="f1s_%d_%s" % (idx, class_name),
        card_id="F1C%d%s" % (idx, class_name),
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
        u = _add_student(session, i, class_name, current_score=75.0 + i)
        _add_score(session, u, days_ago=1 + (i % 5), change=2.0 if i % 2 == 0 else -3.0)
        _add_score(session, u, days_ago=10 + (i % 5), change=1.0)
        users.append(u)
    session.commit()
    return users


def test_sql_count_constant_vs_n(app):
    """predict_batch 对目标表 SELECT 数应与 N 无关（消除每生 3 查）。"""
    with app.app_context():
        _seed_class(db.session, "F1A", 2)
        _seed_class(db.session, "F1B", 8)

    with app.app_context():
        counter_a, handler_a = _make_counter(db.engine)
        try:
            ScorePredictService.predict_batch("F1A", days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_a)
        counter_b, handler_b = _make_counter(db.engine)
        try:
            ScorePredictService.predict_batch("F1B", days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_b)

    # 与 N 无关：两次批量各表 SELECT 数必须相等（证明消除了逐生 N+1）
    for t in TARGET_TABLES:
        assert counter_a[t] == counter_b[t], (t, counter_a, counter_b)

    # 核心 IN 预取恒定：ScoreRecord 恒 1 条（原逐生 N 条）
    assert counter_a["score_record"] == 1, counter_a
    # user 表：取生列表 1 + ScoreRecord.student selectin 预取 1 + 班级名单 1，
    # 均单条 IN/等值查询，与 N 无关（原逐生 get_by_id + 班级排名各 N 条）
    assert counter_a["user"] == 3, counter_a


def test_batch_equals_single_user(app):
    """批量 predict_batch 与逐生 predict_exam_score 数值完全等价。"""
    with app.app_context():
        users = _seed_class(db.session, "F1C", 3)

    with app.app_context():
        batch = ScorePredictService.predict_batch("F1C", days=30)
        batch_by_user = {p["user_id"]: p for p in batch["predictions"]}

        assert len(batch["predictions"]) == len(users)
        for u in users:
            single = ScorePredictService.predict_exam_score(u.id, days=30)
            b = batch_by_user.get(u.id)
            assert b is not None, u.id
            # 预测结果逐字段一致（含 features 内的班级排名等聚合值）
            assert b == single, u.id


def test_prefetch_helpers_direct_equivalence(app):
    """直接校验两个预取辅助与单生查询一致。"""
    with app.app_context():
        users = _seed_class(db.session, "F1D", 4)

        bulk_records = ScorePredictService._prefetch_score_records(users, days=30)
        bulk_class = ScorePredictService._prefetch_class_users(users)
        for u in users:
            single = ScorePredictService._get_score_records(u.id, days=30)
            assert [r.id for r in bulk_records[u.id]] == [r.id for r in single], u.id
            assert u.class_name in bulk_class
            assert len(bulk_class[u.class_name]) == 4


def test_bulk_cache_cleared_after_call(app):
    """批量入口返回后瞬态三缓存必须清空（避免污染后续单生调用）。"""
    with app.app_context():
        _seed_class(db.session, "F1E", 3)
        assert ScorePredictService._bulk_users is None
        assert ScorePredictService._bulk_records is None
        assert ScorePredictService._bulk_class_users is None
        ScorePredictService.predict_batch("F1E", days=30)
        assert ScorePredictService._bulk_users is None
        assert ScorePredictService._bulk_records is None
        assert ScorePredictService._bulk_class_users is None
        ScorePredictService.get_score_distribution("F1E")
        assert ScorePredictService._bulk_records is None
        ScorePredictService.train_score_model(days=30)
        assert ScorePredictService._bulk_records is None
        ScorePredictService.evaluate_score_model(days=30)
        assert ScorePredictService._bulk_records is None
