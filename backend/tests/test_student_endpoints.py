"""学生自助端端点测试（P0 学生自助端最小闭环）

覆盖：
- 登录（卡号+姓名双因子）：成功 / 姓名不匹配 / 卡号不存在 / 缺参 / 卡号格式非法
- 受保护端点鉴权隔离：无 token / admin token(type=access) 均必须被拒，
  学生 token(type=student) 方可访问（与 Admin 体系天然隔离）
- /me、/score、/records（流水分页 + 字段规整）
- /notifications（分页 + 字段规整）
- /leaves（列表 + 提交 + 校验，student_id 自动绑定）
- /phonebox/unlock（策略判定：defer / allow_override）

依赖 conftest 的 app/client/auth_headers/app_context fixture。
注意：conftest 的 sample_user.card_id 由 uuid4() 生成可能含连字符，会被本端点的
validate_card_id 拒绝，因此本文件自建 card_id 合规（纯字母数字）的学生 fixture。
"""
import uuid
from datetime import datetime, timedelta

import pytest

from models import User, ScoreRecord, Notification, Approval, ClassInfo, PhoneBoxPolicy, db


@pytest.fixture
def student_user(app_context):
    """创建卡号合规（无连字符）的测试学生，避免被 validate_card_id 拒绝。"""
    card = "STU" + uuid.uuid4().hex[:12]  # 纯字母数字，长度 15
    u = User(name="测试学生", card_id=card, current_score=100)
    db.session.add(u)
    db.session.commit()
    yield u
    try:
        db.session.delete(u)
        db.session.commit()
    except Exception:  # noqa: BLE001
        db.session.rollback()


class TestStudentLogin:
    def test_login_success(self, client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": student_user.name},
            content_type="application/json",
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "access_token" in body["data"]
        assert body["data"]["student"]["id"] == student_user.id
        assert body["data"]["student"]["card_id"] == student_user.card_id

    def test_login_wrong_name(self, client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": "错误姓名"},
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_login_unknown_card(self, client):
        resp = client.post(
            "/api/student/login",
            json={"card_id": "NOSUCHCARD999", "name": "x"},
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_login_missing_fields(self, client):
        resp = client.post("/api/student/login", json={}, content_type="application/json")
        assert resp.status_code == 400

    def test_login_bad_card_format(self, client):
        # 含非法字符（连字符），应触发格式校验 400
        resp = client.post(
            "/api/student/login",
            json={"card_id": "BAD-CARD", "name": "x"},
            content_type="application/json",
        )
        assert resp.status_code == 400


class TestStudentProtected:
    @staticmethod
    def _login(client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": student_user.name},
            content_type="application/json",
        )
        return resp.get_json()["data"]["access_token"]

    def test_me_requires_auth(self, client):
        resp = client.get("/api/student/me")
        assert resp.status_code == 401

    def test_admin_token_rejected_on_student_endpoint(self, client, auth_headers):
        # admin token 的 type=access，requires_student 校验 type=student 必然拒绝
        resp = client.get("/api/student/me", headers={"Authorization": auth_headers["Authorization"]})
        assert resp.status_code == 401

    def test_me_with_student_token(self, client, student_user):
        token = self._login(client, student_user)
        resp = client.get("/api/student/me", headers={"Authorization": "Bearer " + token})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["id"] == student_user.id
        assert body["data"]["name"] == student_user.name

    def test_score_with_student_token(self, client, student_user):
        token = self._login(client, student_user)
        resp = client.get("/api/student/score", headers={"Authorization": "Bearer " + token})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["current_score"] == student_user.current_score
        assert body["data"]["card_id"] == student_user.card_id


class TestStudentRecords:
    @staticmethod
    def _login(client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": student_user.name},
            content_type="application/json",
        )
        return resp.get_json()["data"]["access_token"]

    def test_records_pagination_and_shape(self, client, student_user, app_context):
        for i in range(3):
            db.session.add(
            ScoreRecord(
                student_id=student_user.id,
                    score_change=10 - i,
                    description=f"record {i}",
                    operator="tester",
                )
            )
        db.session.commit()

        token = self._login(client, student_user)
        h = {"Authorization": "Bearer " + token}

        # 分页：第 1 页取 2 条，total 应为 3
        resp = client.get("/api/student/records?page=1&page_size=2", headers=h)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        payload = body["data"]
        assert isinstance(payload["data"], list)
        assert len(payload["data"]) == 2
        assert payload["pagination"]["total"] == 3
        assert payload["pagination"]["pages"] == 2
        # 字段规整：score_change 为数值（Float 列，序列化后为 float）、created_at 为字符串（可 JSON 序列化）
        first = payload["data"][0]
        assert isinstance(first["score_change"], (int, float))
        assert isinstance(first["created_at"], str)

        # 第 2 页取剩余 1 条
        resp2 = client.get("/api/student/records?page=2&page_size=2", headers=h)
        assert resp2.status_code == 200
        data2 = resp2.get_json()["data"]
        assert len(data2["data"]) == 1

    def test_records_requires_auth(self, client):
        resp = client.get("/api/student/records")
        assert resp.status_code == 401


class TestStudentNotifications:
    @staticmethod
    def _login(client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": student_user.name},
            content_type="application/json",
        )
        return resp.get_json()["data"]["access_token"]

    def test_notifications_requires_auth(self, client):
        resp = client.get("/api/student/notifications")
        assert resp.status_code == 401

    def test_notifications_list_and_shape(self, client, student_user, app_context):
        db.session.add(
            Notification(
                student_id=student_user.id,
                type="info",
                title="测试通知",
                content="这是一条通知",
                status="sent",
            )
        )
        db.session.commit()

        token = self._login(client, student_user)
        resp = client.get("/api/student/notifications?page=1&page_size=10",
                          headers={"Authorization": "Bearer " + token})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        payload = body["data"]
        assert isinstance(payload["data"], list)
        assert len(payload["data"]) == 1
        assert payload["pagination"]["total"] == 1
        first = payload["data"][0]
        assert first["title"] == "测试通知"
        assert first["user_id"] == student_user.id  # 仅能看到自己的通知
        assert isinstance(first["created_at"], str)


class TestStudentLeaves:
    @staticmethod
    def _login(client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": student_user.name},
            content_type="application/json",
        )
        return resp.get_json()["data"]["access_token"]

    def test_leaves_requires_auth(self, client):
        resp = client.get("/api/student/leaves")
        assert resp.status_code == 401

    def test_list_leaves_and_shape(self, client, student_user, app_context):
        db.session.add(
            Approval(
                student_id=student_user.id,
                type="leave",
                leave_type="sick",
                start_date=datetime(2026, 8, 10).date(),
                end_date=datetime(2026, 8, 11).date(),
                description="感冒",
                status="pending",
            )
        )
        db.session.commit()

        token = self._login(client, student_user)
        resp = client.get("/api/student/leaves", headers={"Authorization": "Bearer " + token})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert len(body["data"]) == 1
        first = body["data"][0]
        assert first["leave_type"] == "sick"
        assert first["student_id"] == student_user.id

    def test_apply_leave_success(self, client, student_user):
        token = self._login(client, student_user)
        resp = client.post(
            "/api/student/leaves",
            json={"leave_type": "personal", "start_date": "2026-08-12", "end_date": "2026-08-13", "reason": "家事"},
            headers={"Authorization": "Bearer " + token},
            content_type="application/json",
        )
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["status"] == "pending"
        assert body["data"]["student_id"] == student_user.id  # 自动绑定当前学生

    def test_apply_leave_missing_date(self, client, student_user):
        token = self._login(client, student_user)
        resp = client.post(
            "/api/student/leaves",
            json={"start_date": "2026-08-12"},
            headers={"Authorization": "Bearer " + token},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_apply_leave_end_before_start(self, client, student_user):
        token = self._login(client, student_user)
        resp = client.post(
            "/api/student/leaves",
            json={"start_date": "2026-08-15", "end_date": "2026-08-10"},
            headers={"Authorization": "Bearer " + token},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_apply_leave_bad_format(self, client, student_user):
        token = self._login(client, student_user)
        resp = client.post(
            "/api/student/leaves",
            json={"start_date": "not-a-date", "end_date": "2026-08-10"},
            headers={"Authorization": "Bearer " + token},
            content_type="application/json",
        )
        assert resp.status_code == 400


class TestStudentPhoneboxUnlock:
    @staticmethod
    def _login(client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": student_user.name},
            content_type="application/json",
        )
        return resp.get_json()["data"]["access_token"]

    def test_unlock_defer_no_class(self, client, student_user):
        # 学生无班级 -> evaluate 返回 defer -> 403 且 allowed=False
        token = self._login(client, student_user)
        resp = client.post(
            "/api/student/phonebox/unlock",
            headers={"Authorization": "Bearer " + token},
            content_type="application/json",
        )
        assert resp.status_code == 403
        body = resp.get_json()
        assert body["data"]["allowed"] is False
        assert body["data"]["decision"] == "defer"

    def test_unlock_allowed_with_policy(self, client, student_user, app_context):
        cls = ClassInfo(name="测试班级-解锁")
        db.session.add(cls)
        db.session.commit()
        student_user.class_info_id = cls.id
        db.session.commit()

        policy = PhoneBoxPolicy(
            class_info_id=cls.id,
            allow_self_unlock=True,
            override_until=datetime.now() + timedelta(minutes=30),  # 一键放行优先
        )
        db.session.add(policy)
        db.session.commit()

        token = self._login(client, student_user)
        resp = client.post(
            "/api/student/phonebox/unlock",
            headers={"Authorization": "Bearer " + token},
            content_type="application/json",
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["allowed"] is True
        assert body["data"]["decision"] == "allow_override"


class TestStudentRank:
    @staticmethod
    def _login(client, student_user):
        resp = client.post(
            "/api/student/login",
            json={"card_id": student_user.card_id, "name": student_user.name},
            content_type="application/json",
        )
        return resp.get_json()["data"]["access_token"]

    def test_student_rank_requires_auth(self, client):
        resp = client.get("/api/student/rank")
        assert resp.status_code == 401

    def test_student_rank_no_class(self, client, student_user):
        token = self._login(client, student_user)
        resp = client.get("/api/student/rank", headers={"Authorization": "Bearer " + token})
        assert resp.status_code == 200
        d = resp.get_json()["data"]
        assert d["class_name"] is None
        assert d["my_rank"] is None
        assert "ranking" in d and "my_score" in d and "total_students" in d

    def test_student_rank_with_class(self, client, student_user, app_context):
        cls = ClassInfo(name="测试班级-排名")
        db.session.add(cls)
        db.session.commit()
        student_user.class_info_id = cls.id
        student_user.class_name = "测试班级-排名"
        student_user.current_score = 200
        other = User(
            name="同学B",
            card_id="STU" + uuid.uuid4().hex[:12],
            class_name="测试班级-排名",
            current_score=50,
        )
        db.session.add(other)
        db.session.commit()
        token = self._login(client, student_user)
        resp = client.get("/api/student/rank", headers={"Authorization": "Bearer " + token})
        assert resp.status_code == 200
        d = resp.get_json()["data"]
        assert d["class_name"] == "测试班级-排名"
        assert d["my_rank"] == 1
        assert d["total_students"] == 2
        assert d["ranking"][0]["user_id"] == student_user.id
