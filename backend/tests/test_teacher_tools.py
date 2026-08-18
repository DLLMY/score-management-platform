"""科任老师效率端点测试（P1：批量录分 + 群发通知）

覆盖：
- 批量录分 POST /api/scores/batch（权限 score.entry）
  - 成功（student_id + card_id 两种识别）
  - 缺 exam_id / scores 非数组 / 空数组 → 400
  - 学生不存在 → 收集到 errors 但不整体失败
  - 学生 token(type=student) 调 admin 端点 → 401（JWT 类型隔离）
- 群发通知 POST /api/notifications/batch（权限 notification.send）
  - 按 class_id 群发成功
  - 缺 user_ids 与 class_id → 400
  - 标题/内容为空 → 400
  - 学生 token 调 admin 端点 → 401

依赖 conftest 的 client / auth_headers（super_admin，持所有权限）/ app_context fixture。
"""
import uuid
import pytest

from models import db, Exam, User, Notification, Score, Subject
from utils.security import generate_student_token


@pytest.fixture
def exam(app_context):
    # P0-2: 成绩按 subject_id(FK→Subject) 存储，批量录分需科目存在于 Subject 表
    for name, code in (("数学", "SX"), ("语文", "YW"), ("英语", "EN")):
        if not Subject.query.filter_by(name=name).first():
            db.session.add(Subject(name=name, code=code))
    db.session.commit()
    e = Exam(name="BatchExam_" + uuid.uuid4().hex[:6], status="published")
    db.session.add(e)
    db.session.commit()
    return e


@pytest.fixture
def make_student(app_context):
    def _make(card_suffix, class_info_id=None):
        u = User(
            name="stu_" + card_suffix,
            card_id="STU" + uuid.uuid4().hex[:10],
            is_active=True,
        )
        if class_info_id is not None:
            u.class_info_id = class_info_id
        db.session.add(u)
        db.session.commit()
        return u

    return _make


class TestBatchScore:
    def test_batch_success_by_student_id(self, client, auth_headers, exam, make_student):
        s = make_student("a")
        resp = client.post(
            "/api/scores/batch",
            headers=auth_headers,
            json={
                "exam_id": exam.id,
                "scores": [
                    {"student_id": s.id, "subject": "数学", "score": 88},
                    {"card_id": s.card_id, "subject": "语文", "score": 91.5},
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["created"] == 2
        assert body["data"]["errors"] == []
        assert Score.query.filter_by(exam_id=exam.id).count() == 2

    def test_batch_missing_exam_id(self, client, auth_headers):
        resp = client.post(
            "/api/scores/batch", headers=auth_headers, json={"scores": [{"student_id": 1, "subject": "x", "score": 1}]}
        )
        assert resp.status_code == 400

    def test_batch_scores_not_list(self, client, auth_headers, exam):
        resp = client.post(
            "/api/scores/batch", headers=auth_headers, json={"exam_id": exam.id, "scores": "bad"}
        )
        assert resp.status_code == 400

    def test_batch_empty_list(self, client, auth_headers, exam):
        resp = client.post(
            "/api/scores/batch", headers=auth_headers, json={"exam_id": exam.id, "scores": []}
        )
        assert resp.status_code == 400

    def test_batch_unknown_student_collected(self, client, auth_headers, exam):
        resp = client.post(
            "/api/scores/batch",
            headers=auth_headers,
            json={
                "exam_id": exam.id,
                "scores": [
                    {"student_id": 999999, "subject": "数学", "score": 80},
                    {"card_id": "NOPE1", "subject": "语文", "score": 70},
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.get_json()
        # 两条都失败，created=0，errors 收集 2 条
        assert body["data"]["created"] == 0
        assert len(body["data"]["errors"]) == 2

    def test_batch_bad_score_format(self, client, auth_headers, exam, make_student):
        s = make_student("b")
        resp = client.post(
            "/api/scores/batch",
            headers=auth_headers,
            json={"exam_id": exam.id, "scores": [{"student_id": s.id, "subject": "数学", "score": "abc"}]},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["created"] == 0
        assert body["data"]["errors"][0]["message"] == "分数格式非法"

    def test_batch_rejects_student_token(self, client, make_student):
        s = make_student("c")
        token = generate_student_token(s.id, s.name, s.card_id)
        resp = client.post(
            "/api/scores/batch",
            headers={"Authorization": f"Bearer {token}"},
            json={"exam_id": 1, "scores": [{"student_id": s.id, "subject": "x", "score": 1}]},
        )
        # JWT 类型隔离：学生 token(type=student) 不能调 admin 端点
        assert resp.status_code == 401


class TestBatchNotify:
    def test_batch_by_class_id(self, client, auth_headers, make_student):
        cid = 777
        s1 = make_student("d", class_info_id=cid)
        s2 = make_student("e", class_info_id=cid)
        resp = client.post(
            "/api/notifications/batch",
            headers=auth_headers,
            json={"class_id": cid, "title": "班会通知", "content": "明天开班会"},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["sent"] == 2
        assert Notification.query.filter_by(student_id=s1.id).count() == 1
        assert Notification.query.filter_by(student_id=s2.id).count() == 1

    def test_batch_by_user_ids(self, client, auth_headers, make_student):
        s = make_student("f")
        resp = client.post(
            "/api/notifications/batch",
            headers=auth_headers,
            json={"user_ids": [s.id], "title": "t", "content": "c"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["data"]["sent"] == 1

    def test_batch_missing_targets(self, client, auth_headers):
        resp = client.post(
            "/api/notifications/batch", headers=auth_headers, json={"title": "t", "content": "c"}
        )
        assert resp.status_code == 400

    def test_batch_empty_title(self, client, auth_headers, make_student):
        s = make_student("g")
        resp = client.post(
            "/api/notifications/batch",
            headers=auth_headers,
            json={"user_ids": [s.id], "title": "", "content": "c"},
        )
        assert resp.status_code == 400

    def test_batch_rejects_student_token(self, client, make_student):
        s = make_student("h")
        token = generate_student_token(s.id, s.name, s.card_id)
        resp = client.post(
            "/api/notifications/batch",
            headers={"Authorization": f"Bearer {token}"},
            json={"user_ids": [s.id], "title": "t", "content": "c"},
        )
        assert resp.status_code == 401
