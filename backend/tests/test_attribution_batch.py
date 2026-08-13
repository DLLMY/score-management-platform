from datetime import date, timedelta
from unittest.mock import patch

from models import db, User, ClassInfo
from services.attribution_service import AttributionService


class TestAttributionBatch:
    """批量成绩波动归因服务测试"""

    @staticmethod
    def _seed_class_and_students(app, cid=1, sids=(1, 2)):
        with app.app_context():
            ci = ClassInfo(id=cid, name="测试班%d" % cid)
            db.session.add(ci)
            for sid in sids:
                u = User(
                    id=sid,
                    name="测试生%d" % sid,
                    card_id="CARD_BATCH_%d" % sid,
                    class_info_id=cid,
                    class_name="测试班%d" % cid,
                )
                db.session.add(u)
            db.session.commit()
        return cid

    def test_batch_analyze_structure_and_serializable(self, app):
        """同班多学生：返回结构合法、计数正确、全为 JSON 原生类型。"""
        import json

        self._seed_class_and_students(app, cid=1, sids=(1, 2))
        with app.app_context():
            result = AttributionService.batch_analyze("测试班1", 30)

        assert result["class_name"] == "测试班1"
        assert result["days"] == 30
        assert result["total"] == 2
        assert result["analyzed"] == 2
        assert result["failed"] == 0
        assert len(result["students"]) == 2
        # 无考试数据时应判缺数据，但结构完整
        for s in result["students"]:
            assert "name" in s
            assert "has_data" in s
            assert isinstance(s["has_data"], bool)
            assert "factors" in s and isinstance(s["factors"], list)
        # 原生类型可序列化（防 numpy 序列化回归）
        serialized = json.dumps(result)
        assert isinstance(serialized, str)

    def test_batch_analyze_empty_class(self, app):
        """不存在的班级直接返回空结果，不抛异常。"""
        with app.app_context():
            result = AttributionService.batch_analyze("根本不存在的班", 30)
        assert result["total"] == 0
        assert result["analyzed"] == 0
        assert result["failed"] == 0
        assert result["students"] == []
        assert result["failed_students"] == []

    def test_batch_analyze_partial_failure_isolated(self, app):
        """单名学生分析异常被隔离进 failed_students，其余学生结果不受影响。"""
        self._seed_class_and_students(app, cid=1, sids=(1, 2))
        orig = AttributionService.analyze_score_attribution

        def fake(uid, days):
            if uid == 1:
                raise RuntimeError("DB boom for student 1")
            return orig(uid, days)

        with patch(
            "services.attribution_service.AttributionService.analyze_score_attribution",
            side_effect=fake,
        ):
            with app.app_context():
                result = AttributionService.batch_analyze("测试班1", 30)

        # 总数 2，1 个失败被隔离，1 个正常返回
        assert result["total"] == 2
        assert result["failed"] == 1
        assert result["analyzed"] == 1
        assert len(result["students"]) == 1
        failed_names = [f["name"] for f in result["failed_students"]]
        assert "测试生1" in failed_names
        # 隔离项携带错误信息且为本原生类型
        f0 = result["failed_students"][0]
        assert f0["error"] == "DB boom for student 1"
        assert isinstance(f0["user_id"], int)

    def test_batch_route_registered(self, client):
        """路由已注册（匿名访问应 401 而非 404）。"""
        resp = client.get("/api/algorithm/attribution/batch?class_name=测试班1&days=30")
        assert resp.status_code in (200, 401)
