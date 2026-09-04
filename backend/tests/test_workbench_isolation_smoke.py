# -*- coding: utf-8 -*-
"""
班主任工作台隐私隔离冒烟测试（#814）。

背景：家长联系（ParentContact）与心理健康（MentalHealthRecord/Alert）此前未做
班级隔离，班主任可跨班读取隐私数据。本用例验证：
1. admin 角色：可看全部；?class_id= 过滤生效（按学生所属班级）。
2. teacher 角色（仅关联班级 A）：list_contacts / list_records / list_alerts
   自动收敛到关联班级；指定其他班级 class_id 也拿不到数据。
3. get_contact 单查越权 → 403。

口径与 attendance_service.list_attendance 一致（get_admin_class_ids 隔离）。

注（2026-09-04）：M9/T3 起列表端点强制分页，data 为分页信封
{contacts|records|alerts|comments, total, page, per_page, pages}；
本文件统一经 _items() 解包为裸列表再断言，兼容旧裸数组契约。
"""
import uuid

import pytest


def _items(data, key):
    """兼容列表端点分页信封（data={key:[...], total, page, ...}）与旧裸数组契约。"""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get(key, [])
    return []


@pytest.fixture
def workbench_data(app):
    """构造两个班级、各 2 名学生、家长联系与心理记录、1 名绑定班级 A 的班主任。"""
    from models import db, Admin, AdminRole, RolePermissionMapping
    from models.user_models import User
    from models.system_models import ClassInfo, AdminClass
    from models.parent import ParentContact, ContactLog
    from models.mental_health import MentalHealthRecord
    from utils.security import hash_password

    with app.app_context():
        # 班级
        cls_a = ClassInfo(name="隔离测试班A-" + uuid.uuid4().hex[:6], grade="高一")
        cls_b = ClassInfo(name="隔离测试班B-" + uuid.uuid4().hex[:6], grade="高一")
        db.session.add_all([cls_a, cls_b])
        db.session.flush()

        # 学生（4 名）
        students = []
        for cls, prefix in ((cls_a, "A"), (cls_b, "B")):
            for i in range(2):
                u = User(
                    name=f"{prefix}班学生{i + 1}",
                    card_id=f"ISO{prefix}{uuid.uuid4().hex[:10]}",
                    class_info_id=cls.id,
                )
                db.session.add(u)
                students.append(u)
        db.session.flush()

        # 家长联系（每名学生 1 条）
        contacts = []
        for s in students:
            c = ParentContact(
                student_id=s.id,
                father_name=f"{s.name}的爸爸",
                father_phone=f"138{s.id:08d}",
            )
            db.session.add(c)
            contacts.append(c)

        # 心理记录（每名学生 1 条）
        for s in students:
            db.session.add(
                MentalHealthRecord(student_id=s.id, mood_level=5, stress_level=1, sleep_hours=8)
            )

        # 班主任：teacher 角色，仅绑定班级 A
        teacher = Admin(
            username="iso_teacher_" + uuid.uuid4().hex[:8],
            password=hash_password("test123456"),
            role="teacher",
            real_name="隔离测试班主任",
        )
        db.session.add(teacher)
        db.session.flush()
        db.session.add(AdminClass(admin_id=teacher.id, class_info_id=cls_a.id, is_primary=True))
        db.session.add(AdminRole(admin_id=teacher.id, role_code="teacher"))
        for perm in (
            "class.view",
            "mental_health.view",
            "comment.view",
            "comment.edit",
            "study_guide.view",
            "study_guide.edit",
        ):
            if not RolePermissionMapping.query.filter_by(
                role_code="teacher", permission_code=perm
            ).first():
                db.session.add(RolePermissionMapping(role_code="teacher", permission_code=perm))

        # 评语（每名学生 1 条，供评语隔离测试）
        from models.teacher_comment import TeacherComment

        comments = []
        for s in students:
            c = TeacherComment(
                student_id=s.id,
                term="2026学年第一学期",
                comment_type="term",
                rating=4,
                content="测试评语-" + s.name,
            )
            db.session.add(c)
            comments.append(c)

        # 改进计划（每名学生 1 条，供计划 CRUD/越权测试）
        from models.study_guide import ImprovementPlan

        plans = []
        for s in students:
            p = ImprovementPlan(
                student_id=s.id,
                plan_type="tutorial",
                plan_content="测试计划-" + s.name,
                progress=10,
            )
            db.session.add(p)
            plans.append(p)
        db.session.commit()

        yield {
            "cls_a_id": cls_a.id,
            "cls_b_id": cls_b.id,
            "students": students,
            "contacts": contacts,
            "comments": comments,
            "plans": plans,
            "teacher_id": teacher.id,
        }
        db.session.rollback()


def _teacher_headers(teacher_id):
    from utils.security import generate_tokens

    tokens = generate_tokens(admin_id=teacher_id, username="teacher", role="teacher")
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tokens["access_token"],
    }


def _admin_headers():
    from utils.security import generate_tokens

    tokens = generate_tokens(admin_id=1, username="test_admin", role="admin")
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tokens["access_token"],
    }


class TestParentContactIsolation:
    def test_admin_lists_all_and_filters_by_class(self, client, app, workbench_data):
        """admin 全量可见；class_id 过滤按学生所属班级生效。"""
        resp = client.get("/api/parent/contacts", headers=_admin_headers())
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        all_ids = {c["id"] for c in _items(data["data"], "contacts")}
        assert len(all_ids) == len(workbench_data["contacts"])

        resp = client.get(
            "/api/parent/contacts?class_id=%d" % workbench_data["cls_a_id"],
            headers=_admin_headers(),
        )
        data = resp.get_json()
        got = _items(data["data"], "contacts")
        assert len(got) == 2
        assert all(c["student_id"] in {s.id for s in workbench_data["students"][:2]} for c in got)

    def test_teacher_only_sees_own_class(self, client, app, workbench_data):
        """班主任只能看到关联班级 A 的家长；class_id=B 时返回空。"""
        headers = _teacher_headers(workbench_data["teacher_id"])

        resp = client.get("/api/parent/contacts", headers=headers)
        assert resp.status_code == 200
        data = _items(resp.get_json()["data"], "contacts")
        own_students = {s.id for s in workbench_data["students"][:2]}
        assert len(data) == 2
        assert all(c["student_id"] in own_students for c in data)

        resp = client.get(
            "/api/parent/contacts?class_id=%d" % workbench_data["cls_b_id"], headers=headers
        )
        assert resp.status_code == 200
        assert _items(resp.get_json()["data"], "contacts") == []

    def test_teacher_single_get_forbidden(self, client, app, workbench_data):
        """班主任单查班级 B 学生的家长信息 → 403。"""
        other_contact = workbench_data["contacts"][2]  # 班级 B 的学生家长
        headers = _teacher_headers(workbench_data["teacher_id"])
        resp = client.get(f"/api/parent/contacts/{other_contact.id}", headers=headers)
        assert resp.status_code == 403


class TestMentalHealthIsolation:
    def test_admin_lists_all_and_filters_by_class(self, client, app, workbench_data):
        resp = client.get("/api/mental-health/records", headers=_admin_headers())
        assert resp.status_code == 200
        assert len(_items(resp.get_json()["data"], "records")) == 4

        resp = client.get(
            "/api/mental-health/records?class_id=%d" % workbench_data["cls_a_id"],
            headers=_admin_headers(),
        )
        data = _items(resp.get_json()["data"], "records")
        assert len(data) == 2
        assert all(r["student_id"] in {s.id for s in workbench_data["students"][:2]} for r in data)

    def test_teacher_only_sees_own_class_records(self, client, app, workbench_data):
        headers = _teacher_headers(workbench_data["teacher_id"])
        resp = client.get("/api/mental-health/records", headers=headers)
        assert resp.status_code == 200
        data = _items(resp.get_json()["data"], "records")
        own_students = {s.id for s in workbench_data["students"][:2]}
        assert len(data) == 2
        assert all(r["student_id"] in own_students for r in data)

    def test_teacher_alert_scope(self, client, app, workbench_data):
        """预警列表同样收敛到关联班级。"""
        from models import db, Alert

        with app.app_context():
            for s in workbench_data["students"]:
                db.session.add(
                    Alert(
                        source="mental",
                        student_id=s.id,
                        alert_type="low_mood",
                        severity="2",
                        message="冒烟测试预警",
                    )
                )
            db.session.commit()

        headers = _teacher_headers(workbench_data["teacher_id"])
        resp = client.get("/api/mental-health/alerts", headers=headers)
        assert resp.status_code == 200
        data = _items(resp.get_json()["data"], "alerts")
        own_students = {s.id for s in workbench_data["students"][:2]}
        assert len(data) == 2
        assert all(a["student_id"] in own_students for a in data)


class TestTeacherCommentIsolation:
    """评语模块（P1 新增）隔离与 CRUD。"""

    def test_admin_lists_all_and_filters_by_class(self, client, app, workbench_data):
        resp = client.get("/api/teacher-comments", headers=_admin_headers())
        assert resp.status_code == 200
        assert len(_items(resp.get_json()["data"], "comments")) == 4

        resp = client.get(
            "/api/teacher-comments?class_id=%d" % workbench_data["cls_a_id"],
            headers=_admin_headers(),
        )
        data = _items(resp.get_json()["data"], "comments")
        assert len(data) == 2
        assert all(c["student_id"] in {s.id for s in workbench_data["students"][:2]} for c in data)

    def test_teacher_only_sees_own_class_comments(self, client, app, workbench_data):
        headers = _teacher_headers(workbench_data["teacher_id"])
        resp = client.get("/api/teacher-comments", headers=headers)
        assert resp.status_code == 200
        data = _items(resp.get_json()["data"], "comments")
        own_students = {s.id for s in workbench_data["students"][:2]}
        assert len(data) == 2
        assert all(c["student_id"] in own_students for c in data)

    def test_teacher_crud_and_forbidden(self, client, app, workbench_data):
        """班主任可对自己班学生评语增删改；操作 B 班学生评语 → 403。"""
        headers = _teacher_headers(workbench_data["teacher_id"])
        own_student = workbench_data["students"][0]

        # 创建
        resp = client.post(
            "/api/teacher-comments",
            json={"student_id": own_student.id, "content": "新增评语"},
            headers=headers,
        )
        assert resp.status_code == 201
        new_id = resp.get_json()["data"]["id"]

        # 更新
        resp = client.put(
            f"/api/teacher-comments/{new_id}", json={"content": "更新后的评语"}, headers=headers
        )
        assert resp.status_code == 200
        assert resp.get_json()["data"]["content"] == "更新后的评语"

        # 删除
        resp = client.delete(f"/api/teacher-comments/{new_id}", headers=headers)
        assert resp.status_code == 200

        # 越权：B 班学生评语
        other_comment = workbench_data["comments"][2]
        resp = client.delete(f"/api/teacher-comments/{other_comment.id}", headers=headers)
        assert resp.status_code == 403
        resp = client.put(
            f"/api/teacher-comments/{other_comment.id}", json={"content": "越权"}, headers=headers
        )
        assert resp.status_code == 403


class TestImprovementPlanCRUD:
    """改进计划编辑/删除（P0 修复：此前 PUT/DELETE /plans/{id} 必 404）。"""

    def test_plan_put_delete_own_class(self, client, app, workbench_data):
        headers = _teacher_headers(workbench_data["teacher_id"])
        plan = workbench_data["plans"][0]  # 班 A 学生

        resp = client.put(
            f"/api/study-guide/plans/{plan.id}",
            json={"plan_content": "更新后的计划", "progress": 50},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["plan_content"] == "更新后的计划"
        assert data["progress"] == 50

        resp = client.delete(f"/api/study-guide/plans/{plan.id}", headers=headers)
        assert resp.status_code == 200

    def test_plan_cross_class_forbidden(self, client, app, workbench_data):
        headers = _teacher_headers(workbench_data["teacher_id"])
        plan = workbench_data["plans"][2]  # 班 B 学生

        resp = client.put(
            f"/api/study-guide/plans/{plan.id}", json={"plan_content": "越权"}, headers=headers
        )
        assert resp.status_code == 403
        resp = client.delete(f"/api/study-guide/plans/{plan.id}", headers=headers)
        assert resp.status_code == 403

    def test_plan_admin_crud(self, client, app, workbench_data):
        resp = client.put(
            f"/api/study-guide/plans/{workbench_data['plans'][0].id}",
            json={"progress": -5},
            headers=_admin_headers(),
        )
        assert resp.status_code == 200
        # 防负值：进度收敛到 [0,100]
        assert resp.get_json()["data"]["progress"] == 0
