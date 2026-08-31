"""多维风险分（risk_details）健壮性 + 单元测试。

- 纯 service：predict_risk 返回 risk_details（academic/behavior/attendance 三维）
- 边界：无记录用户不崩、用户不存在优雅返回、各子维度 level 合法、score 非负
- 路由：GET /api/algorithm/risk-predict/<id> 返回 200 且 data.risk_details 含三维
"""

from datetime import datetime, timedelta

from services.risk_predict_service import RiskPredictService

VALID_LEVELS = {"high", "medium", "low"}
SUB_KEYS = ["academic", "behavior", "attendance"]


def _add_records(db_session, uid, changes, base_days=0):
    from models import ScoreRecord

    now = datetime.now()
    for i, c in enumerate(changes):
        db_session.add(
            ScoreRecord(
                student_id=uid,
                score_change=c,
                created_at=now - timedelta(days=base_days + i),
            )
        )
    db_session.commit()


def test_risk_details_structure(db_session):
    from models import User

    u = User(name="多维风险测试", card_id="RISK_TEST_1", class_name="RC", current_score=75)
    db_session.add(u)
    db_session.commit()
    uid = u.id
    # 近期积分下降，触发部分风险维度
    _add_records(db_session, uid, [-2, -1, -3, -2, -1, -2, -3], base_days=1)

    result = RiskPredictService.predict_risk(uid, 30)
    assert "overall_risk_score" in result
    details = result["risk_details"]
    assert isinstance(details, dict)

    for k in SUB_KEYS:
        assert k in details, f"缺少子维度 {k}"
        sub = details[k]
        assert sub["risk_level"] in VALID_LEVELS, f"子维度 {k} level 非法: {sub['risk_level']}"
        assert isinstance(sub["risk_score"], (int, float)), f"子维度 {k} score 非数值"
        assert sub["risk_score"] >= 0, f"子维度 {k} score 应为非负"
        assert sub["type"] == k
        # factors 应为列表（可能为空）
        assert isinstance(sub.get("factors", []), list)


def test_risk_details_no_records(db_session):
    """无任何记录的用户：risk_details 仍完整返回、各子维度 level 合法、不崩溃。

    注意：完全无活动属于真实风险信号（行为/出勤维度会因 inactivity 升高），
    因此这里只断言结构完整与 level 合法，不强制 low。
    """
    from models import User

    u = User(name="无记录风险", card_id="RISK_TEST_2", class_name="RC", current_score=80)
    db_session.add(u)
    db_session.commit()
    uid = u.id

    result = RiskPredictService.predict_risk(uid, 30)
    assert "risk_details" in result
    details = result["risk_details"]
    for k in SUB_KEYS:
        assert k in details
        assert details[k]["risk_level"] in VALID_LEVELS
        assert isinstance(details[k]["risk_score"], (int, float))


def _add_attendance(db_session, uid, days, status="present"):
    from models import Attendance, ClassInfo

    # attendance.class_id 为 NOT NULL 外键，需先有 class_info 行
    cls = ClassInfo(name="RC")
    db_session.add(cls)
    db_session.commit()
    class_id = cls.id

    now = datetime.now().date()
    for d in range(1, days + 1):
        db_session.add(
            Attendance(
                student_id=uid,
                class_id=class_id,
                date=now - timedelta(days=d),
                status=status,
            )
        )
    db_session.commit()


def test_risk_details_healthy_low(db_session):
    """健康活跃用户（持续正向积分 + 全勤）：三维风险均为 low，验证正常路径下限。"""
    from models import User

    u = User(name="健康风险", card_id="RISK_TEST_4", class_name="RC", current_score=90)
    db_session.add(u)
    db_session.commit()
    uid = u.id

    # 20 条正向积分（日均 > 0.5，无连续无正向）→ 行为维度安全
    _add_records(db_session, uid, [2] * 20, base_days=1)
    # 20 天全勤 → 出勤率 1.0
    _add_attendance(db_session, uid, 20, status="present")

    result = RiskPredictService.predict_risk(uid, 30)
    details = result["risk_details"]
    for k in SUB_KEYS:
        assert (
            details[k]["risk_level"] == "low"
        ), f"健康用户子维度 {k} 应为 low，实际 {details[k]['risk_level']}"


def test_risk_predict_user_not_found(db_session):
    """用户不存在：优雅返回 {user_id, error}，不含 risk_details。"""
    result = RiskPredictService.predict_risk(999999, 30)
    assert result.get("error") is not None
    assert "risk_details" not in result


def test_risk_details_route(client, auth_headers, db_session):
    from models import User

    u = User(name="路由多维风险", card_id="RISK_TEST_3", class_name="RC", current_score=70)
    db_session.add(u)
    db_session.commit()
    uid = u.id

    resp = client.get(f"/api/algorithm/risk-predict/{uid}?days=30", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert "data" in body
    details = body["data"]["risk_details"]
    for k in SUB_KEYS:
        assert k in details, f"路由返回缺少子维度 {k}"
