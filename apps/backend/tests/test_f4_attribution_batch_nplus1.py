"""F4: attribution_service.batch_analyze 二级 N+1 批处理防护。

batch_analyze 循环 analyze_score_attribution 原实现每生 9 查
（get_by_id(User) + Score join Exam×2 + ScoreRecord×2 + Attendance×2 +
HomeworkSubmission×2），N 生 = 9N+1；重构后循环前 5 条预取（2 条 Score join
+ ScoreRecord/Attendance/HomeworkSubmission 各 1 条 IN）+ 复用已加载 users，
查询数恒定与 N 无关，且归因结果与逐生 analyze_score_attribution 数值一致。
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import event

from models import (
    Attendance,
    ClassInfo,
    Exam,
    HomeworkAssignment,
    HomeworkSubmission,
    Score,
    ScoreRecord,
    Subject,
    User,
    db,
)
from services.attribution_service import AttributionService

TARGET_TABLES = [
    "user",
    "scores",
    "score_record",
    "attendance",
    "homework_submission",
]


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


def _seed_student_with_data(session, idx, class_name, cid):
    """建学生 + 四维数据（考试/积分/出勤/作业），覆盖 prior/recent 两窗口。

    班级只建一次（class_info.name 有唯一约束），由调用方保证 cid/class_name 一致。
    """
    u = User(
        name="f4s_%d_%s" % (idx, class_name),
        card_id="F4C%d%s" % (idx, class_name),
        class_info_id=cid,
        class_name=class_name,
        current_score=75.0 + idx,
    )
    session.add(u)
    session.flush()
    now = datetime.now()

    hw = HomeworkAssignment(
        class_id=cid,
        title="hw%d" % idx,
        assigned_date=now - timedelta(days=40),
        due_date=now - timedelta(days=1),
    )
    session.add(hw)
    session.flush()
    math = Subject(name="数学_%s_%d" % (class_name, idx), code="SX_%s_%d" % (class_name, idx))
    session.add(math)
    session.flush()

    # 前期考试 70，近期考试 80（days=30 的 prior/recent 窗口）
    ea = Exam(name="前测%d" % idx, date=now - timedelta(days=40))
    eb = Exam(name="后测%d" % idx, date=now - timedelta(days=10))
    session.add_all([ea, eb])
    session.flush()
    session.add(Score(student_id=u.id, exam_id=ea.id, subject_id=math.id, score=70.0 + idx))
    session.add(Score(student_id=u.id, exam_id=eb.id, subject_id=math.id, score=80.0 + idx))

    for d in range(35, 40):
        session.add(
            ScoreRecord(student_id=u.id, score_change=1, created_at=now - timedelta(days=d))
        )
    for d in range(1, 10):
        session.add(
            ScoreRecord(student_id=u.id, score_change=2, created_at=now - timedelta(days=d))
        )
    for d in range(35, 40):
        session.add(
            Attendance(
                student_id=u.id, class_id=cid, date=(now - timedelta(days=d)).date(), status="present"
            )
        )
    for d in range(1, 8):
        session.add(
            Attendance(
                student_id=u.id, class_id=cid, date=(now - timedelta(days=d)).date(), status="present"
            )
        )
    session.add(
        Attendance(
            student_id=u.id, class_id=cid, date=(now - timedelta(days=2)).date(), status="absent"
        )
    )
    for d in range(1, 6):
        session.add(
            HomeworkSubmission(
                student_id=u.id,
                assignment_id=hw.id,
                is_submitted=True,
                submitted_at=now - timedelta(days=d),
            )
        )
    session.commit()
    return u


def _seed_class(session, class_name, cid, n):
    session.add(ClassInfo(id=cid, name=class_name))
    session.flush()
    users = []
    for i in range(n):
        users.append(_seed_student_with_data(session, i, class_name, cid))
    return users


def test_sql_count_constant_vs_n(app):
    """batch_analyze 对目标表 SELECT 数应与 N 无关（消除每生 9 查）。"""
    with app.app_context():
        _seed_class(db.session, "F4A", 21, 2)
        _seed_class(db.session, "F4B", 31, 8)

    with app.app_context():
        counter_a, handler_a = _make_counter(db.engine)
        try:
            AttributionService.batch_analyze("F4A", 30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_a)
        counter_b, handler_b = _make_counter(db.engine)
        try:
            AttributionService.batch_analyze("F4B", 30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_b)

    # 与 N 无关：两次批量各表 SELECT 数必须相等（证明消除了逐生 N+1）
    for t in TARGET_TABLES:
        assert counter_a[t] == counter_b[t], (t, counter_a, counter_b)

    # 核心预取恒定：Score join Exam 2 条 + ScoreRecord/Attendance/HomeworkSubmission 各 1 条
    assert counter_a["scores"] == 2, counter_a
    assert counter_a["score_record"] == 1, counter_a
    assert counter_a["attendance"] == 1, counter_a
    assert counter_a["homework_submission"] == 1, counter_a
    # user 表：取生列表 1 + Score.student/ScoreRecord.student 等关系 selectin 预取，
    # 均单条 IN 不随 N 放大（原逐生 get_by_id 每生 1 条）
    assert counter_a["user"] == counter_b["user"], (counter_a, counter_b)


def test_batch_equals_single_user(app):
    """批量 batch_analyze 与逐生 analyze_score_attribution 数值一致。"""
    with app.app_context():
        users = _seed_class(db.session, "F4C", 41, 3)

    with app.app_context():
        batch = AttributionService.batch_analyze("F4C", 30)
        assert batch["analyzed"] == 3
        assert batch["with_data"] == 3
        by_user = {s["user_id"]: s for s in batch["students"]}

        for u in users:
            single = AttributionService.analyze_score_attribution(u.id, 30)
            b = by_user.get(u.id)
            assert b is not None, u.id
            assert b["has_data"] == single["has_data"], u.id
            assert b["score_before"] == pytest.approx(single["score_before"]), u.id
            assert b["score_after"] == pytest.approx(single["score_after"]), u.id
            assert b["total_change"] == pytest.approx(single["total_change"]), u.id
            assert b["confidence"] == pytest.approx(single["confidence"]), u.id
            # factors 结构一致（key/name/direction 逐条相等，contribution 近似）
            assert [f["key"] for f in b["factors"]] == [f["key"] for f in single["factors"]], u.id
            for fb, fs in zip(b["factors"], single["factors"]):
                assert fb["name"] == fs["name"], u.id
                assert fb["direction"] == fs["direction"], u.id
                assert fb["contribution"] == pytest.approx(fs["contribution"]), u.id


def test_prefetch_helper_direct_equivalence(app):
    """直接校验 _prefetch_attribution 的 score_windows 与单生 _score_windows 一致。"""
    with app.app_context():
        users = _seed_class(db.session, "F4D", 51, 4)

        bulk = AttributionService._prefetch_attribution(users, 30)
        ref = bulk["ref"]
        for u in users:
            single = AttributionService._score_windows(
                u.id, ref["prior_start"], ref["prior_end"], ref["recent_start"], ref["now"]
            )
            assert bulk["score_windows"][u.id] == single, u.id
            # behavior/attendance/homework 四个窗口键全覆盖
            for start, end in (
                (ref["prior_start"], ref["prior_end"]),
                (ref["recent_start"], ref["now"]),
            ):
                assert (u.id, start, end) in bulk["behavior"], u.id
                assert (u.id, start, end) in bulk["attendance"], u.id
                assert (u.id, start, end) in bulk["homework"], u.id


def test_bulk_cache_cleared_after_call(app):
    """batch_analyze 返回后瞬态缓存必须清空（避免污染后续单生调用）。"""
    with app.app_context():
        _seed_class(db.session, "F4E", 61, 3)
        assert AttributionService._bulk is None
        AttributionService.batch_analyze("F4E", 30)
        assert AttributionService._bulk is None
        # 清空后单生走原始查询路径
        r = AttributionService.analyze_score_attribution(
            User.query.filter(User.class_name == "F4E").first().id, 30
        )
        assert r["has_data"] is True
        assert AttributionService._bulk is None
