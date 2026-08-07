"""积分排行榜端点测试

覆盖：
- 班主任/老师（score.view，admin 持有）可查看班级榜 / 学生榜
- 学生 token(type=student) 调 /api/rank/* 必须被 403 拒绝（与 Admin 体系隔离）
- 无 token 401

依赖 conftest 的 app/client/auth_headers/app_context fixture。
"""
import uuid

import pytest

from models import User, db
from utils.security import generate_student_token


@pytest.fixture
def rank_student(app_context):
    card = "STU" + uuid.uuid4().hex[:12]
    u = User(name="榜学生", card_id=card, current_score=120)
    db.session.add(u)
    db.session.commit()
    yield u


class TestRankBoard:
    def test_class_ranking_requires_auth(self, client):
        resp = client.get("/api/rank/class")
        assert resp.status_code == 401

    def test_class_ranking_admin_ok(self, client, auth_headers):
        resp = client.get("/api/rank/class", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "ranking" in body["data"]
        assert "total_classes" in body["data"]

    def test_student_ranking_admin_ok(self, client, auth_headers):
        resp = client.get("/api/rank/student", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "ranking" in body["data"]
        assert "total_students" in body["data"]

    def test_student_ranking_by_class(self, client, auth_headers):
        resp = client.get(
            "/api/rank/student?class_name=高三1班&limit=10", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["class_name"] == "高三1班"

    def test_rank_rejects_student_token(self, client, rank_student):
        # 学生 token(type=student) 调 Admin 权限端点（score.view）必须被拒。
        # requires_permission 用 validate_token(token,"access") 校验，type 不匹配返回 None
        # → 端点按“无效令牌”返回 401（与 student 端拒绝 admin token 对称）。
        token = generate_student_token(rank_student.id, rank_student.name, rank_student.card_id)["token"]
        headers = {"Authorization": "Bearer " + token}
        for path in ("/api/rank/class", "/api/rank/student"):
            resp = client.get(path, headers=headers)
            assert resp.status_code in (401, 403), path
