"""users 域 子批2 行为测试（F17 防腐层渐进重构）。

锁定 /import(JSON) / batch-delete / batch-score / import-file(CSV) / toggle-active
四个写入路径的契约，先于重构编写，作为零漂移基线。

fixture：client / app / auth_headers 来自 tests/conftest.py（function 级隔离内存库 + admin id=1）。
"""

import io
import csv

from models import db, User, ScoreRecord
from services.user_service import user_service


class TestUserImportRoutes:

    # ------------------------------------------------------------------
    # 辅助
    # ------------------------------------------------------------------
    def _seed_user(self, app, card_id, name="种子生", current_score=10, class_name=""):
        with app.app_context():
            u = User(
                name=name,
                card_id=card_id,
                current_score=current_score,
                class_name=class_name,
            )
            db.session.add(u)
            db.session.commit()
            return u.id

    # ------------------------------------------------------------------
    # POST /api/users/import  (JSON)
    # ------------------------------------------------------------------
    def test_import_json_success(self, client, app, auth_headers):
        """批量导入 2 个合法学生 → 200，imported=2，且落库。"""
        with app.app_context():
            payload = {
                "users": [
                    {"name": "新生一", "card_id": "IMP001"},
                    {"name": "新生二", "card_id": "IMP002"},
                ]
            }
            resp = client.post("/api/users/import", json=payload, headers=auth_headers)
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["success"] is True
            assert body["data"]["imported"] == 2
            assert User.query.filter_by(card_id="IMP001").first() is not None
            assert User.query.filter_by(card_id="IMP002").first() is not None

    def test_import_json_duplicate_in_db(self, client, app, auth_headers):
        """库中已存在 DUP001，再导入 [DUP001, DUP002] → 200，imported=1，errors=1。"""
        self._seed_user(app, "DUP001", "已存在")
        with app.app_context():
            payload = {
                "users": [
                    {"name": "重复生", "card_id": "DUP001"},
                    {"name": "新生态", "card_id": "DUP002"},
                ]
            }
            resp = client.post("/api/users/import", json=payload, headers=auth_headers)
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["imported"] == 1
            assert len(body["data"]["errors"]) == 1
            assert User.query.filter_by(card_id="DUP002").first() is not None

    def test_import_json_empty(self, client, app, auth_headers):
        """空 users → 400，提示『没有导入数据』。"""
        resp = client.post("/api/users/import", json={"users": []}, headers=auth_headers)
        assert resp.status_code == 400
        assert "没有导入数据" in resp.get_json()["message"]

    # ------------------------------------------------------------------
    # POST /api/users/batch-delete
    # ------------------------------------------------------------------
    def test_batch_delete(self, client, app, auth_headers):
        """批量删除两个已存在学生 → 200，且库中已移除。"""
        uid1 = self._seed_user(app, "DEL001")
        uid2 = self._seed_user(app, "DEL002")
        with app.app_context():
            resp = client.post(
                "/api/users/batch-delete", json={"ids": [uid1, uid2]}, headers=auth_headers
            )
            assert resp.status_code == 200
            assert db.session.get(User, uid1) is None
            assert db.session.get(User, uid2) is None

    def test_batch_delete_empty(self, client, app, auth_headers):
        """空 ids → 400。"""
        resp = client.post("/api/users/batch-delete", json={"ids": []}, headers=auth_headers)
        assert resp.status_code == 400

    # ------------------------------------------------------------------
    # POST /api/users/batch-score
    # ------------------------------------------------------------------
    def test_batch_score(self, client, app, auth_headers):
        """批量加分：current_score 10 + 5 = 15，并写入 ScoreRecord。"""
        uid = self._seed_user(app, "SCO001", current_score=10)
        with app.app_context():
            resp = client.post(
                "/api/users/batch-score",
                json={"ids": [uid], "score_change": 5, "description": "测试批量"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            u = db.session.get(User, uid)
            assert u.current_score == 15
            assert ScoreRecord.query.filter_by(student_id=uid).count() == 1

    def test_batch_score_empty_ids(self, client, app, auth_headers):
        """空 ids → 400。"""
        resp = client.post(
            "/api/users/batch-score", json={"ids": [], "score_change": 5}, headers=auth_headers
        )
        assert resp.status_code == 400

    # ------------------------------------------------------------------
    # POST /api/users/import-file  (CSV)
    # ------------------------------------------------------------------
    def test_import_file_csv(self, client, app, auth_headers):
        """上传合法 CSV → 200，imported>=1，且落库。"""
        header = "姓名,性别,班级,联系电话,卡片ID,父亲姓名,父亲电话,母亲姓名,母亲电话,监护人姓名,监护人电话,监护关系,初始积分"
        row = "CSV生,男,,13800138000,CSV001,父,13900139000,母,13700137000,,, ,60"
        content = (header + "\n" + row).encode("utf-8-sig")
        data = {"file": (io.BytesIO(content), "t.csv")}
        resp = client.post(
            "/api/users/import-file",
            data=data,
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["imported"] >= 1
        with app.app_context():
            assert User.query.filter_by(card_id="CSV001").first() is not None

    def test_import_file_no_file(self, client, app, auth_headers):
        """缺少 file → 400。"""
        resp = client.post(
            "/api/users/import-file", data={}, headers=auth_headers, content_type="multipart/form-data"
        )
        assert resp.status_code == 400

    # ------------------------------------------------------------------
    # POST /api/user-management/user/<id>/toggle-active
    # ------------------------------------------------------------------
    def test_toggle_active(self, client, app, auth_headers):
        """切换启用状态 → 200，is_active 翻转且落库。"""
        uid = self._seed_user(app, "TOG001")
        with app.app_context():
            before = db.session.get(User, uid).is_active
            resp = client.post(
                f"/api/user-management/user/{uid}/toggle-active", headers=auth_headers
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["is_active"] == (not before)
            assert db.session.get(User, uid).is_active == (not before)

    def test_toggle_active_not_found(self, client, app, auth_headers):
        """不存在用户 → 404。"""
        resp = client.post(
            "/api/user-management/user/999999/toggle-active", headers=auth_headers
        )
        assert resp.status_code == 404
