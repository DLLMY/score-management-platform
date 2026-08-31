"""admin_classes 路由行为测试（F17 academics-1：admin_classes + exam_import）。

验证管理员-班级关联写入路径收口到 services.academics_service 后行为零漂移：
- 分配班级（新建/更新 is_primary、主班同步 head_teacher_id、原班主任 is_primary 清理）
- 移除班级（成功清空 head_teacher_id、未找到回 404）
- GET 列表
"""

import pytest

from models import db, Admin, AdminClass, ClassInfo


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
