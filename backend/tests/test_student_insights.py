"""学生自助端：算法洞察聚合接口 /api/student/insights

覆盖：结构完整性、JSON 可序列化、积分趋势长度、鉴权隔离、
单维异常隔离（参与度挂掉不影响风险/趋势返回）。
"""

import json
from datetime import datetime, timedelta, date
from unittest import mock

from models import (
    db,
    User,
    ClassInfo,
    Attendance,
    HomeworkAssignment,
    HomeworkSubmission,
    ScoreRecord,
)
from utils.security import generate_student_token


def _student_headers(user) -> dict:
    """生成学生 JWT 并封装请求头。"""
    token = generate_student_token(user.id, user.name, user.card_id)["token"]
    return {"Authorization": "Bearer %s" % token}


class TestStudentInsights:
    @staticmethod
    def _seed_student(app, sid=1, name="A", cid=1, current_score=100):
        with app.app_context():
            db.session.add(ClassInfo(id=cid, name="测试班%d" % cid))
            u = User(
                id=sid,
                name=name,
                card_id="CARD_%d" % sid,
                class_info_id=cid,
                class_name="测试班%d" % cid,
                current_score=current_score,
            )
            db.session.add(u)
            db.session.commit()
            return u

    @staticmethod
    def _seed_engagement_data(app, sid, cid, base=None):
        base = base or date.today()
        with app.app_context():
            for k in range(10):
                db.session.add(
                    Attendance(
                        student_id=sid,
                        class_id=cid,
                        date=base - timedelta(days=k),
                        status="present",
                    )
                )
            ha = HomeworkAssignment(
                id=1000 + sid,
                class_id=cid,
                title="hw",
                assigned_date=base - timedelta(days=5),
                due_date=base,
            )
            db.session.add(ha)
            db.session.add(
                HomeworkSubmission(
                    assignment_id=1000 + sid,
                    student_id=sid,
                    is_submitted=True,
                    is_late=False,
                )
            )
            for k in range(5):
                db.session.add(
                    ScoreRecord(
                        student_id=sid,
                        score_change=2,
                        created_at=datetime.combine(base, datetime.min.time()) - timedelta(days=k),
                    )
                )
            db.session.commit()

    def test_insights_structure_and_serializable(self, app, client):
        u = self._seed_student(app)
        self._seed_engagement_data(app, u.id, 1)
        resp = client.get("/api/student/insights", headers=_student_headers(u))
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        # 结构完整性
        assert "student" in data and data["student"]["id"] == u.id
        assert "engagement" in data
        assert data["engagement"]["has_data"] is True
        assert data["engagement"]["engagement_score"] > 0
        assert data["engagement"]["level"] in ("low", "medium", "high")
        assert "risk" in data
        assert data["risk"]["overall_risk_level"] in ("low", "medium", "high")
        assert isinstance(data["risk"].get("overall_risk_score"), (int, float))
        assert "score_trend" in data and len(data["score_trend"]) == 8
        assert "days" in data and "weeks" in data
        # JSON 可序列化（无 numpy / 关系对象泄漏）
        json.dumps(data)

    def test_insights_score_trend_length(self, app, client):
        u = self._seed_student(app)
        self._seed_engagement_data(app, u.id, 1)
        resp = client.get("/api/student/insights?weeks=4", headers=_student_headers(u))
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert len(data["score_trend"]) == 4
        # 每点均为原生类型
        for pt in data["score_trend"]:
            assert isinstance(pt["week_index"], int)
            assert isinstance(pt["score_change"], (int, float))

    def test_insights_requires_student_auth(self, client):
        # 无 token → 401（鉴权拦截），而非 404（路由存在）
        resp = client.get("/api/student/insights")
        assert resp.status_code in (401, 403)

    def test_insights_isolates_engagement_failure(self, app, client):
        u = self._seed_student(app)
        with mock.patch(
            "services.engagement_service.calculate_engagement",
            side_effect=RuntimeError("boom"),
        ):
            resp = client.get("/api/student/insights", headers=_student_headers(u))
        # 参与度维度失败不影响整体返回
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["engagement"]["has_data"] is False
        assert data["engagement"]["engagement_score"] == 0
        assert "risk" in data and "score_trend" in data

    def test_insights_risk_suggestions_present(self, app, client):
        u = self._seed_student(app)
        self._seed_engagement_data(app, u.id, 1)
        resp = client.get("/api/student/insights", headers=_student_headers(u))
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        # 风险接口复用 predict_risk 的建议/行动字段（前端展示依赖）
        assert isinstance(data["risk"].get("intervention_suggestions"), list)
        assert isinstance(data["risk"].get("recommended_actions"), list)

    def test_insights_participation_trend(self, app, client):
        u = self._seed_student(app)
        self._seed_engagement_data(app, u.id, 1)
        resp = client.get("/api/student/insights?weeks=4", headers=_student_headers(u))
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        pt = data.get("participation_trend")
        assert pt is not None
        assert pt["weeks"] == 4
        assert len(pt["series"]) == 4
        assert pt["trend"] in ("up", "down", "stable")
        for p in pt["series"]:
            assert isinstance(p["week_index"], int)
            assert isinstance(p["engagement_score"], (int, float))
