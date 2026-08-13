"""成绩波动归因服务测试。

覆盖：
- 纯函数核心（无 DB）：正常归因 / 缺成绩数据 / 影响相互抵消 / 空因子
- DB 包装层集成：构造学生+考试+积分+出勤+作业后调用
- 边界：学生不存在
- 路由：GET /api/algorithm/attribution/<id> 返回 200 与 data
"""
from datetime import datetime, timedelta

from services.attribution_service import AttributionService


# ----------------------------------------------------------------------
# 纯函数核心（无 DB 依赖）
# ----------------------------------------------------------------------
def test_attribute_normal():
    factor_values = {
        "behavior": (1.0, 3.0),
        "attendance": (0.9, 0.95),
        "homework": (0.8, 0.9),
    }
    r = AttributionService.attribute_score_change(70, 80, factor_values)
    assert r["has_data"] is True
    assert r["total_change"] == 10.0
    assert len(r["factors"]) == 3
    contrib_sum = sum(f["contribution"] for f in r["factors"])
    assert abs(contrib_sum - 10.0) < 0.5
    # 行为积分影响最大（delta 2 * 1.5 = 3 > 作业 0.1*25=2.5 > 出勤 0.05*30=1.5）
    assert r["factors"][0]["key"] == "behavior"
    # 贡献度方向应反映影响方向（行为为正）
    assert r["factors"][0]["direction"] == "positive"


def test_attribute_no_score_data():
    r = AttributionService.attribute_score_change(None, 80, {"behavior": (1.0, 2.0)})
    assert r["has_data"] is False
    assert r["confidence"] == 0.0
    assert "无法对比" in r["summary"]
    assert r["factors"] == []


def test_attribute_both_scores_missing():
    r = AttributionService.attribute_score_change(None, None, {"behavior": (1.0, 2.0)})
    assert r["has_data"] is False


def test_attribute_zero_signed_impact():
    # 行为影响 +3，出勤影响 -3 → 相互抵消，应等分到净变化
    factor_values = {"behavior": (0.0, 2.0), "attendance": (0.5, 0.4)}
    r = AttributionService.attribute_score_change(70, 80, factor_values)
    assert r["has_data"] is True
    contrib_sum = sum(f["contribution"] for f in r["factors"])
    assert abs(contrib_sum - 10.0) < 0.5
    for f in r["factors"]:
        assert "相互抵消" in f["detail"]


def test_attribute_empty_factors():
    r = AttributionService.attribute_score_change(70, 80, {})
    assert r["has_data"] is True
    assert r["factors"] == []
    assert "无明显变化" in r["summary"]


def test_attribute_single_factor_negative():
    factor_values = {"behavior": (3.0, 1.0)}  # 下降
    r = AttributionService.attribute_score_change(80, 70, factor_values)
    assert r["total_change"] == -10.0
    assert r["factors"][0]["direction"] == "negative"
    assert r["factors"][0]["contribution"] == -10.0


# ----------------------------------------------------------------------
# DB 包装层集成
# ----------------------------------------------------------------------
def test_analyze_integration(db_session):
    from models import Attendance, ClassInfo, Exam, HomeworkAssignment, HomeworkSubmission, Score, ScoreRecord, User

    now = datetime.now()
    # 父表：班级、作业（Attendance.class_id / HomeworkSubmission.assignment_id 为 NOT NULL 外键）
    cls = ClassInfo(name="TC", grade="高一", description="测试班级")
    db_session.add(cls)
    db_session.commit()
    cid = cls.id
    hw = HomeworkAssignment(
        class_id=cid,
        title="测试作业",
        assigned_date=now - timedelta(days=10),
        due_date=now - timedelta(days=1),
    )
    db_session.add(hw)
    db_session.commit()
    aid = hw.id

    u = User(name="归因测试", card_id="ATTR_TEST_1", class_name="TC", current_score=75)
    db_session.add(u)
    db_session.commit()
    uid = u.id

    # 前期考试(now-40d)=70，近期考试(now-10d)=80（落入 days=30 的 prior/recent 窗口）
    ea = Exam(name="前测", date=now - timedelta(days=40))
    eb = Exam(name="后测", date=now - timedelta(days=10))
    db_session.add_all([ea, eb])
    db_session.commit()
    db_session.add(Score(student_id=uid, exam_id=ea.id, subject="数学", score=70.0))
    db_session.add(Score(student_id=uid, exam_id=eb.id, subject="数学", score=80.0))

    # 行为积分：前期日均约 +1（days 35-39 各 +1 → 5/5=1.0），近期日均约 +2（days 1-9 各 +2）
    for d in range(35, 40):
        db_session.add(ScoreRecord(user_id=uid, score_change=1, created_at=now - timedelta(days=d)))
    for d in range(1, 10):
        db_session.add(ScoreRecord(user_id=uid, score_change=2, created_at=now - timedelta(days=d)))

    # 出勤：前期 5 天全勤；近期 7 天全勤 + 1 天缺勤
    for d in range(35, 40):
        db_session.add(Attendance(student_id=uid, class_id=cid, date=(now - timedelta(days=d)).date(), status="present"))
    for d in range(1, 8):
        db_session.add(Attendance(student_id=uid, class_id=cid, date=(now - timedelta(days=d)).date(), status="present"))
    db_session.add(Attendance(student_id=uid, class_id=cid, date=(now - timedelta(days=2)).date(), status="absent"))

    # 作业：近期 5 天提交（前期无提交记录 → hw_before=None）
    for d in range(1, 6):
        db_session.add(HomeworkSubmission(student_id=uid, assignment_id=aid, is_submitted=True, submitted_at=now - timedelta(days=d)))
    db_session.commit()

    r = AttributionService.analyze_score_attribution(uid, 30)
    assert r["has_data"] is True
    assert r["user_id"] == uid
    assert r["name"] == "归因测试"
    assert r["score_before"] == 70.0
    assert r["score_after"] == 80.0
    assert len(r["factors"]) == 3
    contrib_sum = sum(f["contribution"] for f in r["factors"])
    assert abs(contrib_sum - r["total_change"]) < 0.5
    assert 0.0 < r["confidence"] <= 0.95


def test_analyze_user_missing(db_session):
    r = AttributionService.analyze_score_attribution(999999)
    assert "error" in r


def test_analyze_no_exam_data(db_session):
    from models import User

    u = User(name="无考试", card_id="ATTR_TEST_2", class_name="TC", current_score=60)
    db_session.add(u)
    db_session.commit()
    r = AttributionService.analyze_score_attribution(u.id, 30)
    # 无考试记录 → 无法对比
    assert r["has_data"] is False
    assert "无法对比" in r["summary"]


# ----------------------------------------------------------------------
# 路由
# ----------------------------------------------------------------------
def test_attribution_route(client, auth_headers, db_session):
    from models import User

    u = User(name="路由测试", card_id="ATTR_TEST_3", class_name="TC", current_score=80)
    db_session.add(u)
    db_session.commit()
    uid = u.id

    resp = client.get(f"/api/algorithm/attribution/{uid}?days=30", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert "data" in body
    assert body["data"]["user_id"] == uid
