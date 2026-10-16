"""F5: engagement_service.batch_rank 二级 N+1 批处理防护。

batch_rank 循环 calculate_engagement 原实现每生 5 查（Attendance +
HomeworkAssignment + ScoreRecord + Approval + HomeworkSubmission），
N 生 = 5N+1；重构后循环前 4 条 IN 预取（按 student_id 分组）+
HomeworkAssignment 全局 1 条，查询数恒定与 N 无关，
且排名结果与逐生 calculate_engagement 数值完全一致。
"""

from datetime import date, datetime, timedelta

from sqlalchemy import event

from models import (
    Approval,
    Attendance,
    ClassInfo,
    HomeworkAssignment,
    HomeworkSubmission,
    ScoreRecord,
    User,
    db,
)
from services import engagement_service
from services.engagement_service import (
    EngagementService,
    batch_rank,
    calculate_engagement,
)

TARGET_TABLES = [
    "user",
    "attendance",
    "homework_assignment",
    "score_record",
    "approval",
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


def _seed_class_with_data(session, class_name, cid, n):
    """建班级 + n 个学生，每人带出勤/作业/积分/请假四维数据。"""
    session.add(ClassInfo(id=cid, name=class_name))
    today = date.today()
    users = []
    for i in range(n):
        u = User(
            name="f5s_%d_%s" % (i, class_name),
            card_id="F5C%d%s" % (i, class_name),
            class_info_id=cid,
            class_name=class_name,
        )
        session.add(u)
        session.flush()
        for k in range(10):
            session.add(
                Attendance(
                    student_id=u.id,
                    class_id=cid,
                    date=today - timedelta(days=k),
                    status="present" if k % 4 else "absent",
                )
            )
        ha = HomeworkAssignment(
            id=5000 + cid * 100 + i,
            class_id=cid,
            title="hw%d" % i,
            assigned_date=today - timedelta(days=5),
            due_date=today,
        )
        session.add(ha)
        session.add(
            HomeworkSubmission(
                assignment_id=ha.id,
                student_id=u.id,
                is_submitted=True,
                is_late=i % 3 == 0,
            )
        )
        for k in range(5):
            session.add(
                ScoreRecord(
                    student_id=u.id,
                    score_change=2 if k % 2 else -1,
                    created_at=datetime.now() - timedelta(days=k),
                )
            )
        if i % 2 == 0:
            session.add(
                Approval(
                    student_id=u.id,
                    type="leave",
                    status="approved",
                    start_date=today - timedelta(days=9),
                    end_date=today,
                )
            )
        users.append(u)
    session.commit()
    return users


def test_sql_count_constant_vs_n(app):
    """batch_rank 对各目标表 SELECT 数应与 N 无关（消除每生 5 查）。"""
    with app.app_context():
        _seed_class_with_data(db.session, "F5A", 11, 2)
        _seed_class_with_data(db.session, "F5B", 12, 8)

    with app.app_context():
        counter_a, handler_a = _make_counter(db.engine)
        try:
            batch_rank("F5A", days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_a)
        counter_b, handler_b = _make_counter(db.engine)
        try:
            batch_rank("F5B", days=30)
        finally:
            event.remove(db.engine, "after_cursor_execute", handler_b)

    # 与 N 无关：两次批量各表 SELECT 数必须相等（证明消除了逐生 N+1）
    for t in TARGET_TABLES:
        assert counter_a[t] == counter_b[t], (t, counter_a, counter_b)

    # 核心 IN 预取恒定：四张按学生表各 1 条 + 作业全局 1 条（原逐生 5N 条）
    for t in ("attendance", "score_record", "approval", "homework_submission"):
        assert counter_a[t] == 1, (t, counter_a)
    assert counter_a["homework_assignment"] == 1, counter_a
    # user 表：取生列表 1 + ScoreRecord.student / Attendance.student 关系
    # lazy="selectin" 自动 IN 预取各 1 条（单条 IN 不随 N 放大，非缺陷）
    assert counter_a["user"] == 3, counter_a


def test_batch_equals_single_user(app):
    """批量 batch_rank 与逐生 calculate_engagement 数值完全等价。"""
    with app.app_context():
        users = _seed_class_with_data(db.session, "F5C", 13, 3)

    with app.app_context():
        res = batch_rank("F5C", days=30)
        assert res["total"] == 3
        assert res["failed"] == 0
        by_user = {s["user_id"]: s for s in res["students"]}

        for u in users:
            single = calculate_engagement(u.id, days=30)
            b = by_user.get(u.id)
            assert b is not None, u.id
            # 参与度分值与等级一致
            assert b["engagement_score"] == single["engagement_score"], u.id
            assert b["level"] == single["level"], u.id
            assert b["has_data"] == single["has_data"], u.id
            # components 逐字段一致（出勤/作业/活跃/请假）
            for key in ("attendance_rate", "homework_rate", "activity_rate", "leave_days"):
                assert b["components"][key] == single["components"][key], (u.id, key)


def test_prefetch_helper_direct_equivalence(app):
    """直接校验 _prefetch_engagement 分组与单生查询行一致。"""
    with app.app_context():
        users = _seed_class_with_data(db.session, "F5D", 14, 4)

        bulk = engagement_service._prefetch_engagement(users, 30)
        assert set(bulk["attendance"].keys()) == {u.id for u in users}
        assert len(bulk["assignments"]) == 4
        for u in users:
            att = Attendance.query.filter(
                Attendance.student_id == u.id,
                Attendance.date >= date.today() - timedelta(days=30),
            ).all()
            assert len(bulk["attendance"][u.id]) == len(att), u.id
            rec = ScoreRecord.query.filter(
                ScoreRecord.student_id == u.id,
                ScoreRecord.created_at
                >= datetime.combine(date.today() - timedelta(days=30), datetime.min.time()),
            ).all()
            assert len(bulk["records"][u.id]) == len(rec), u.id


def test_bulk_cache_cleared_after_call(app):
    """batch_rank 返回后瞬态缓存必须清空（避免污染后续单生/异窗调用）。"""
    with app.app_context():
        _seed_class_with_data(db.session, "F5E", 15, 3)
        assert engagement_service._BULK is None
        EngagementService.batch_rank("F5E", days=30)
        assert engagement_service._BULK is None
        # 清空后 weekly_trend 的异质 end_date 窗口仍走单生查询
        weekly = engagement_service.weekly_trend(users_id(app, "F5E"), weeks=2)
        assert len(weekly["series"]) == 2
        assert engagement_service._BULK is None


def users_id(app, class_name):
    with app.app_context():
        u = User.query.filter(User.class_name == class_name).first()
        return u.id
