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
from services.engagement_service import (
    EngagementService,
    calculate_engagement,
    weekly_trend,
    batch_rank,
)
import services.engagement_service as engagement_service


class TestEngagementBatchTrend:
    """参与度：批量排名 + 周趋势 + end_date 历史窗口"""

    @staticmethod
    def _seed_class(app, cid=1, students=((1, "A"), (2, "B"))):
        with app.app_context():
            db.session.add(ClassInfo(id=cid, name="测试班%d" % cid))
            for sid, name in students:
                db.session.add(
                    User(
                        id=sid,
                        name=name,
                        card_id="CARD_%d" % sid,
                        class_info_id=cid,
                        class_name="测试班%d" % cid,
                    )
                )
            db.session.commit()

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

    def test_batch_rank_structure_and_serializable(self, app):
        self._seed_class(app, cid=1, students=((1, "A"), (2, "B")))
        self._seed_engagement_data(app, 1, 1)
        self._seed_engagement_data(app, 2, 1)
        with app.app_context():
            res = EngagementService.batch_rank("测试班1", 30)
        assert res["total"] == 2
        assert res["with_data"] == 2
        assert res["failed"] == 0
        assert len(res["students"]) == 2
        assert all(s["rank"] in (1, 2) for s in res["students"])
        ranks = [s["rank"] for s in res["students"] if s["has_data"]]
        assert sorted(ranks) == ranks
        serialized = json.dumps(res)
        assert isinstance(serialized, str)

    def test_batch_rank_empty_class(self, app):
        with app.app_context():
            res = EngagementService.batch_rank("不存在的班级", 30)
        assert res["total"] == 0
        assert res["with_data"] == 0
        assert res["failed"] == 0
        assert res["students"] == []

    def test_batch_rank_partial_failure_isolated(self, app):
        self._seed_class(app, cid=1, students=((1, "A"), (2, "B")))
        self._seed_engagement_data(app, 2, 1)
        real = engagement_service.calculate_engagement

        def fake(uid, days, end_date=None):
            if int(uid) == 1:
                raise RuntimeError("DB boom")
            return real(uid, days, end_date)

        with mock.patch.object(engagement_service, "calculate_engagement", side_effect=fake):
            with app.app_context():
                res = EngagementService.batch_rank("测试班1", 30)
        assert res["failed"] == 1
        assert res["with_data"] == 1
        assert any(f["user_id"] == 1 for f in res["failed_students"])
        assert any(s["user_id"] == 2 and s["has_data"] for s in res["students"])

    def test_weekly_trend_length_and_native(self, app):
        self._seed_class(app, cid=1, students=((1, "A"),))
        self._seed_engagement_data(app, 1, 1)
        with app.app_context():
            res = EngagementService.weekly_trend(1, 8)
        assert res["weeks"] == 8
        assert len(res["series"]) == 8
        assert res["trend"] in ("up", "down", "stable")
        assert res["series"][-1]["has_data"] is True
        assert isinstance(res["series"][-1]["engagement_score"], float)
        serialized = json.dumps(res)
        assert isinstance(serialized, str)

    def test_weekly_trend_no_data(self, app):
        self._seed_class(app, cid=1, students=((9, "NODATA"),))
        with app.app_context():
            res = EngagementService.weekly_trend(9, 6)
        assert len(res["series"]) == 6
        assert all(not p["has_data"] for p in res["series"])
        assert res["trend"] == "stable"

    def test_calculate_engagement_end_date_window(self, app):
        """end_date 指定历史锚点后，仅该窗口内数据参与计算（历史数据不被计入）。"""
        self._seed_class(app, cid=1, students=((1, "A"),))
        today = date.today()
        # 仅 60 天前的出勤，落在 end_date=今 的 30 天窗口外 → 无数据
        self._seed_engagement_data(app, 1, 1, base=(today - timedelta(days=60)))
        with app.app_context():
            recent = calculate_engagement(1, 30, end_date=today)
            # 窗口 end_date=50天前: 覆盖 [80天前, 50天前]，60天前数据在内 → 有数据
            hist = calculate_engagement(1, 30, end_date=today - timedelta(days=50))
        assert recent["has_data"] is False
        assert hist["has_data"] is True
