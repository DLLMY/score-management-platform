from datetime import datetime, timedelta, date

from models import db, User, ClassInfo, Attendance, LeaveApplication, HomeworkAssignment, HomeworkSubmission, ScoreRecord
from services.engagement_service import calculate_engagement


class TestEngagementService:
    """学生参与度指数服务测试"""

    @staticmethod
    def _seed_class_and_student(app, sid=1, cid=1):
        with app.app_context():
            ci = ClassInfo(id=cid, name="测试班%d" % cid)
            db.session.add(ci)
            u = User(
                id=sid,
                name="测试生%d" % sid,
                card_id="CARD_TEST_%d" % sid,
                class_info_id=cid,
                class_name="测试班%d" % cid,
            )
            db.session.add(u)
            db.session.commit()
        return sid, cid

    def test_calculate_engagement_structure_and_serializable(self, app):
        """有数据时返回结构合法且全为 JSON 原生类型（防 numpy 序列化回归）。"""
        import json

        sid, cid = self._seed_class_and_student(app)
        today = date.today()
        with app.app_context():
            for k in range(10):
                db.session.add(Attendance(
                    student_id=sid, class_id=cid,
                    date=today - timedelta(days=k), status="present",
                ))
            ha = HomeworkAssignment(
                id=1, class_id=cid, title="作业1",
                assigned_date=today - timedelta(days=5), due_date=today,
            )
            db.session.add(ha)
            db.session.add(HomeworkSubmission(
                assignment_id=1, student_id=sid, is_submitted=True, is_late=False,
            ))
            for k in range(5):
                db.session.add(ScoreRecord(
                    user_id=sid, score_change=2,
                    created_at=datetime.now() - timedelta(days=k),
                ))
            db.session.commit()

        with app.app_context():
            result = calculate_engagement(sid, 30)

        assert result["has_data"] is True
        assert isinstance(result["engagement_score"], float)
        assert 0 <= result["engagement_score"] <= 100
        assert result["level"] in ("high", "medium", "low")
        assert set(result["components"].keys()) == {
            "attendance_rate", "homework_rate", "activity_rate", "leave_days",
        }
        assert result["components"]["attendance_rate"] == 1.0
        assert result["components"]["homework_rate"] == 1.0
        assert isinstance(result["components"]["leave_days"], int)
        assert result["components"]["homework_rate"] is not None
        serialized = json.dumps(result)
        assert isinstance(serialized, str)

    def test_calculate_engagement_no_data(self, app):
        """全新学生（无任何行为记录）返回 has_data=False、score=0、level=low。"""
        sid, _ = self._seed_class_and_student(app, sid=2, cid=2)
        with app.app_context():
            result = calculate_engagement(sid, 30)
        assert result["has_data"] is False
        assert result["engagement_score"] == 0.0
        assert result["level"] == "low"
        assert result["components"]["attendance_rate"] is None
        assert result["components"]["homework_rate"] is None

    def test_calculate_engagement_renormalize_on_missing_dimension(self, app):
        """仅有出勤数据时，缺失维度权重被重归一化，出勤满分应得 100。"""
        sid, cid = self._seed_class_and_student(app, sid=3, cid=3)
        today = date.today()
        with app.app_context():
            for k in range(8):
                db.session.add(Attendance(
                    student_id=sid, class_id=cid,
                    date=today - timedelta(days=k), status="present",
                ))
            db.session.commit()

        with app.app_context():
            result = calculate_engagement(sid, 30)

        assert result["components"]["homework_rate"] is None
        assert result["components"]["activity_rate"] is None
        assert result["engagement_score"] == 100.0
        assert result["level"] == "high"

    def test_calculate_engagement_leave_penalty(self, app):
        """已批准请假应计天数并按上限扣分，factor 含负贡献项。"""
        sid, cid = self._seed_class_and_student(app, sid=4, cid=4)
        today = date.today()
        with app.app_context():
            for k in range(8):
                db.session.add(Attendance(
                    student_id=sid, class_id=cid,
                    date=today - timedelta(days=k), status="present",
                ))
            for k in range(8, 10):
                db.session.add(Attendance(
                    student_id=sid, class_id=cid,
                    date=today - timedelta(days=k), status="absent",
                ))
            db.session.add(LeaveApplication(
                student_id=sid, leave_type="病假",
                start_date=today - timedelta(days=9), end_date=today,
                status="approved",
            ))
            db.session.commit()

        with app.app_context():
            result = calculate_engagement(sid, 30)

        assert result["components"]["leave_days"] >= 10
        leave_factor = next((f for f in result["factors"] if f["name"] == "leave"), None)
        assert leave_factor is not None
        assert leave_factor["contribution"] < 0
        assert result["engagement_score"] <= 80.0

    def test_engagement_route_registered(self, client):
        """路由已注册（匿名访问应 401 而非 404）。"""
        resp = client.get("/api/algorithm/engagement/1?days=30")
        assert resp.status_code in (200, 401)
