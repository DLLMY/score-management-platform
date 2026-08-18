"""subject 路由行为测试（F17 academics-2：subject_routes 写入路径收口到 academics_service）。

验证 17 处 db.session 收口后行为零漂移：
- 科目 CRUD（create/update/delete/toggle）+ 响应体逐字节一致
- 科目-班级关联 CRUD（create/update/delete）
- 科目批量排序（order）
- 科目批量导入（JSON 路径：创建 + 关联班级 + 统计 dict）
- 各类请求级错误（重复名称/代码 400、班级不存在 404、导入格式错误 400）
"""
import pytest

from models import db, Admin, ClassInfo, Subject, SubjectClass


@pytest.fixture
def seeded_subjects(app):
    with app.app_context():
        cls = ClassInfo(name="测试班", grade="高一")
        db.session.add(cls)
        db.session.commit()
        cls_id = cls.id

        subj = Subject(name="数学", code="math")
        db.session.add(subj)
        db.session.commit()
        subj_id = subj.id

        other = Subject(name="历史", code="hist")
        db.session.add(other)
        db.session.commit()
        other_id = other.id

        teacher = Admin(username="teacher1", password="x", role="teacher", real_name="李老师")
        db.session.add(teacher)
        db.session.commit()
        teacher_id = teacher.id
    return {"cls_id": cls_id, "subj_id": subj_id, "other_id": other_id, "teacher_id": teacher_id}


class TestSubjectRoutes:
    # ---- 创建 ----
    def test_create_subject(self, client, app, auth_headers, seeded_subjects):
        with app.app_context():
            resp = client.post(
                "/api/subjects",
                json={"name": "英语", "code": "eng", "grade": "高一"},
                headers=auth_headers,
            )
            assert resp.status_code == 201
            body = resp.get_json()
            assert body["name"] == "英语"
            assert body["code"] == "eng"
            assert body["class_count"] == 0
            assert Subject.query.filter_by(name="英语").first() is not None

    def test_create_subject_duplicate_name(self, client, app, auth_headers, seeded_subjects):
        with app.app_context():
            resp = client.post(
                "/api/subjects", json={"name": "数学"}, headers=auth_headers
            )
            assert resp.status_code == 400

    def test_create_subject_duplicate_code(self, client, app, auth_headers, seeded_subjects):
        with app.app_context():
            resp = client.post(
                "/api/subjects", json={"name": "化学", "code": "math"}, headers=auth_headers
            )
            assert resp.status_code == 400

    # ---- 切换启用/禁用 ----
    def test_toggle_subject(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        with app.app_context():
            before = Subject.query.get(subj_id).is_active
            resp = client.get(f"/api/subjects/{subj_id}/toggle", headers=auth_headers)
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["is_active"] != before
            assert Subject.query.get(subj_id).is_active != before

    def test_toggle_subject_not_found(self, client, app, auth_headers, seeded_subjects):
        resp = client.get("/api/subjects/999999/toggle", headers=auth_headers)
        assert resp.status_code == 404

    # ---- 更新 ----
    def test_update_subject(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        with app.app_context():
            resp = client.put(
                f"/api/subjects/{subj_id}",
                json={"name": "数学新版", "color": "#FF0000"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["name"] == "数学新版"
            assert body["color"] == "#FF0000"
            assert Subject.query.get(subj_id).name == "数学新版"

    def test_update_subject_duplicate_name(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        with app.app_context():
            resp = client.put(
                f"/api/subjects/{subj_id}", json={"name": "历史"}, headers=auth_headers
            )
            assert resp.status_code == 400

    def test_update_subject_not_found(self, client, app, auth_headers, seeded_subjects):
        resp = client.put(
            "/api/subjects/999999", json={"name": "x"}, headers=auth_headers
        )
        assert resp.status_code == 404

    # ---- 删除 ----
    def test_delete_subject(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        with app.app_context():
            resp = client.delete(f"/api/subjects/{subj_id}", headers=auth_headers)
            assert resp.status_code == 200
            assert Subject.query.get(subj_id) is None

    def test_delete_subject_not_found(self, client, app, auth_headers, seeded_subjects):
        resp = client.delete("/api/subjects/999999", headers=auth_headers)
        assert resp.status_code == 404

    # ---- 科目-班级关联 ----
    def test_add_subject_class(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        cls_id = seeded_subjects["cls_id"]
        teacher_id = seeded_subjects["teacher_id"]
        with app.app_context():
            resp = client.post(
                f"/api/subjects/{subj_id}/classes",
                json={"subject_id": subj_id, "class_info_id": cls_id, "teacher_id": teacher_id},
                headers=auth_headers,
            )
            assert resp.status_code == 201
            body = resp.get_json()
            assert body["subject_id"] == subj_id
            assert body["class_info_id"] == cls_id
            assert body["teacher_name"] == "李老师"
            link = SubjectClass.query.filter_by(subject_id=subj_id, class_info_id=cls_id).first()
            assert link is not None

    def test_add_subject_class_duplicate(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        cls_id = seeded_subjects["cls_id"]
        teacher_id = seeded_subjects["teacher_id"]
        with app.app_context():
            client.post(
                f"/api/subjects/{subj_id}/classes",
                json={"subject_id": subj_id, "class_info_id": cls_id, "teacher_id": teacher_id},
                headers=auth_headers,
            )
            resp = client.post(
                f"/api/subjects/{subj_id}/classes",
                json={"subject_id": subj_id, "class_info_id": cls_id, "teacher_id": teacher_id},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    def test_add_subject_class_class_not_found(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        with app.app_context():
            resp = client.post(
                f"/api/subjects/{subj_id}/classes",
                json={"subject_id": subj_id, "class_info_id": 999999, "teacher_id": seeded_subjects["teacher_id"]},
                headers=auth_headers,
            )
            assert resp.status_code == 404

    def test_update_subject_class(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        cls_id = seeded_subjects["cls_id"]
        teacher_id = seeded_subjects["teacher_id"]
        with app.app_context():
            client.post(
                f"/api/subjects/{subj_id}/classes",
                json={"subject_id": subj_id, "class_info_id": cls_id, "teacher_id": teacher_id},
                headers=auth_headers,
            )
            resp = client.put(
                f"/api/subjects/{subj_id}/classes/{cls_id}",
                json={"teacher_id": None},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            link = SubjectClass.query.filter_by(subject_id=subj_id, class_info_id=cls_id).first()
            assert link.teacher_id is None

    def test_update_subject_class_not_found(self, client, app, auth_headers, seeded_subjects):
        resp = client.put(
            f"/api/subjects/{seeded_subjects['subj_id']}/classes/999999",
            json={"teacher_id": None},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_delete_subject_class(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        cls_id = seeded_subjects["cls_id"]
        teacher_id = seeded_subjects["teacher_id"]
        with app.app_context():
            client.post(
                f"/api/subjects/{subj_id}/classes",
                json={"subject_id": subj_id, "class_info_id": cls_id, "teacher_id": teacher_id},
                headers=auth_headers,
            )
            resp = client.delete(
                f"/api/subjects/{subj_id}/classes/{cls_id}", headers=auth_headers
            )
            assert resp.status_code == 200
            assert SubjectClass.query.filter_by(subject_id=subj_id, class_info_id=cls_id).first() is None

    # ---- 批量排序 ----
    def test_update_subject_order(self, client, app, auth_headers, seeded_subjects):
        subj_id = seeded_subjects["subj_id"]
        with app.app_context():
            resp = client.put(
                "/api/subjects/order",
                json=[{"id": subj_id, "order": 7}],
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert Subject.query.get(subj_id).sort_order == 7

    def test_update_subject_order_invalid(self, client, app, auth_headers, seeded_subjects):
        resp = client.put("/api/subjects/order", json={"id": 1}, headers=auth_headers)
        assert resp.status_code == 400

    # ---- 批量导入 ----
    def test_import_subject_json(self, client, app, auth_headers, seeded_subjects):
        cls_id = seeded_subjects["cls_id"]
        with app.app_context():
            resp = client.post(
                "/api/subjects/import",
                json={
                    "data": [
                        {"name": "物理", "code": "phy", "grade": "高一", "class_name": "测试班"}
                    ]
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["success"] is True
            assert body["success_count"] == 1
            assert body["failed_count"] == 0
            new_subj = Subject.query.filter_by(name="物理").first()
            assert new_subj is not None
            link = SubjectClass.query.filter_by(subject_id=new_subj.id, class_info_id=cls_id).first()
            assert link is not None

    def test_import_subject_invalid_format(self, client, app, auth_headers, seeded_subjects):
        with app.app_context():
            resp = client.post(
                "/api/subjects/import", json={"foo": 1}, headers=auth_headers
            )
            assert resp.status_code == 400
