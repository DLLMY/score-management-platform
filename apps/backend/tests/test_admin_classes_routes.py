"""admin_classes 路由行为测试（F17 academics-1：admin_classes + exam_import）。

验证管理员-班级关联写入路径收口到 services.academics_service 后行为零漂移：
- 分配班级（新建/更新 is_primary、主班同步 head_teacher_id、原班主任 is_primary 清理）
- 移除班级（成功清空 head_teacher_id、未找到回 404）
- GET 列表
"""

import re

import pytest
from sqlalchemy import event

from models import Admin, AdminClass, ClassInfo, db


@pytest.fixture
def seeded_academics(app):
    with app.app_context():
        admin2 = Admin(id=2, username="admin2", password="x", role="admin", real_name="管理二")
        db.session.add(admin2)
        cls = ClassInfo(name="高一(1)班", grade="高一")
        db.session.add(cls)
        db.session.commit()
        cls_id = cls.id
    return {"cls_id": cls_id}


class TestAdminClassesRoutes:
    def test_assign_new_primary(self, client, app, auth_headers, seeded_academics):
        cls_id = seeded_academics["cls_id"]
        with app.app_context():
            resp = client.post(
                "/api/admin-classes/1/assign-class",
                json={"class_id": cls_id, "is_primary": True},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["success"] is True
            link = AdminClass.query.filter_by(admin_id=1, class_info_id=cls_id).first()
            assert link is not None
            assert link.is_primary is True
            assert ClassInfo.query.get(cls_id).head_teacher_id == 1

    def test_assign_existing_updates_flag(self, client, app, auth_headers, seeded_academics):
        cls_id = seeded_academics["cls_id"]
        with app.app_context():
            client.post(
                "/api/admin-classes/1/assign-class",
                json={"class_id": cls_id, "is_primary": True},
                headers=auth_headers,
            )
            resp = client.post(
                "/api/admin-classes/1/assign-class",
                json={"class_id": cls_id, "is_primary": False},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            link = AdminClass.query.filter_by(admin_id=1, class_info_id=cls_id).first()
            assert link.is_primary is False
            # 原实现仅在 is_primary=True 分支同步 head_teacher_id；is_primary=False 重分配不清除，保持零漂移
            assert ClassInfo.query.get(cls_id).head_teacher_id == 1

    def test_assign_primary_reassigns_prev_teacher(
        self, client, app, auth_headers, seeded_academics
    ):
        cls_id = seeded_academics["cls_id"]
        with app.app_context():
            client.post(
                "/api/admin-classes/1/assign-class",
                json={"class_id": cls_id, "is_primary": True},
                headers=auth_headers,
            )
            client.post(
                "/api/admin-classes/2/assign-class",
                json={"class_id": cls_id, "is_primary": True},
                headers=auth_headers,
            )
            a1 = AdminClass.query.filter_by(admin_id=1, class_info_id=cls_id).first()
            a2 = AdminClass.query.filter_by(admin_id=2, class_info_id=cls_id).first()
            assert a1.is_primary is False
            assert a2.is_primary is True
            assert ClassInfo.query.get(cls_id).head_teacher_id == 2

    def test_get_admin_classes(self, client, app, auth_headers, seeded_academics):
        cls_id = seeded_academics["cls_id"]
        with app.app_context():
            client.post(
                "/api/admin-classes/1/assign-class",
                json={"class_id": cls_id, "is_primary": False},
                headers=auth_headers,
            )
            resp = client.get("/api/admin-classes/1", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert isinstance(data, list)
            assert any(c["class_id"] == cls_id for c in data)

    def test_remove_class_success(self, client, app, auth_headers, seeded_academics):
        cls_id = seeded_academics["cls_id"]
        with app.app_context():
            client.post(
                "/api/admin-classes/1/assign-class",
                json={"class_id": cls_id, "is_primary": True},
                headers=auth_headers,
            )
            resp = client.post(f"/api/admin-classes/1/remove-class/{cls_id}", headers=auth_headers)
            assert resp.status_code == 200
            assert AdminClass.query.filter_by(admin_id=1, class_info_id=cls_id).first() is None
            assert ClassInfo.query.get(cls_id).head_teacher_id is None

    def test_remove_class_not_found(self, client, app, auth_headers, seeded_academics):
        cls_id = seeded_academics["cls_id"]
        with app.app_context():
            resp = client.post(f"/api/admin-classes/1/remove-class/{cls_id}", headers=auth_headers)
            assert resp.status_code == 404


class TestAdminClassesReadNPlusOne:
    """R22：GET 管理员班级列表走模型层 selectin 关系的 N+1 回归防护。"""

    def test_get_list_batched_no_n_plus_one(self, client, app, auth_headers):
        with app.app_context():
            for i in range(4):
                c = ClassInfo(name=f"r22cls_{i}", grade="高一")
                db.session.add(c)
                db.session.flush()
                db.session.add(
                    AdminClass(admin_id=1, class_info_id=c.id, is_primary=(i == 0))
                )
            db.session.commit()

        pat = re.compile(
            r"(?:from|join)\s*admin_class\b|admin_class\.|(?:from|join)\s*class_info\b|class_info\."
        )
        counter = {"n": 0}

        def _after(conn, cursor, statement, *args, **kwargs):
            s = " ".join(statement.strip().lower().split())
            if s.startswith("select") and pat.search(s):
                counter["n"] += 1

        engine = db.engine
        event.listen(engine, "after_cursor_execute", _after)
        try:
            with app.app_context():
                resp = client.get("/api/admin-classes/1?v=r22", headers=auth_headers)
        finally:
            event.remove(engine, "after_cursor_execute", _after)

        assert resp.status_code == 200
        # 业务查询恒定 2（links + selectin IN）；旧逻辑逐链接 get_by_id = 1+L
        assert counter["n"] == 2, counter["n"]
        rows = resp.get_json()
        assert [r["class_name"] for r in rows] == [f"r22cls_{i}" for i in range(4)]
        assert rows[0]["is_primary"] is True
        assert all(r["is_primary"] is False for r in rows[1:])
