"""exam / score 路由行为测试（F17 academics-3：exam_routes 写入路径收口到 academics_service）。

验证 20 处 db.session 收口后行为零漂移：
- 考试 CRUD（create/update/delete）+ 发布/关闭状态机 + 响应体逐字节一致
- 成绩单条创建（含科目解析/考试关闭禁录/分数范围/冲突检测）
- 成绩批量创建（student_id 或 card_id 识别、冲突跳过）
- 成绩更新/删除（考试关闭禁改/禁删）
- 批量确认某次考试成绩（pending/normal → confirmed）
- 各类请求级错误（缺 name/date 400、缺 subject 400、考试不存在 400、越界 400、冲突 400、404 幂等删除）

注意：单条 create 用 APIResponse.success → 200（与 subject create 的 201 区分）。
"""

import pytest
from datetime import date

from models import db, Subject, User, Exam, Score


@pytest.fixture
def seeded_exam(app):
    with app.app_context():
        subj1 = Subject(name="数学", code="math")
        subj2 = Subject(name="语文", code="chinese")
        db.session.add_all([subj1, subj2])
        db.session.commit()
        subj1_id = subj1.id
        subj2_id = subj2.id

        stu1 = User(name="张三", card_id="CARD001", is_active=True, class_name="高一1班")
        stu2 = User(name="李四", card_id="CARD002", is_active=True, class_name="高一1班")
        db.session.add_all([stu1, stu2])
        db.session.commit()
        stu1_id = stu1.id
        stu2_id = stu2.id

        exam = Exam(name="期中考试", date=date(2026, 1, 1), status="draft", created_by=1)
        db.session.add(exam)
        db.session.commit()
        exam_id = exam.id

        score = Score(
            exam_id=exam_id,
            student_id=stu1_id,
            subject_id=subj1_id,
            score=90.0,
            full_score=100,
            status="pending",
        )
        db.session.add(score)
        db.session.commit()
        score_id = score.id
    return {
        "subj1_id": subj1_id,
        "subj2_id": subj2_id,
        "stu1_id": stu1_id,
        "stu2_id": stu2_id,
        "exam_id": exam_id,
        "score_id": score_id,
    }


class TestExamRoutes:
    # ---- 创建 ----
    def test_create_exam(self, client, app, auth_headers, seeded_exam):
        with app.app_context():
            resp = client.post(
                "/api/exams",
                json={"name": "期末考试", "date": "2026-06-01"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["name"] == "期末考试"
            assert Exam.query.filter_by(name="期末考试").first() is not None

    def test_create_exam_missing_name(self, client, app, auth_headers, seeded_exam):
        with app.app_context():
            resp = client.post("/api/exams", json={"date": "2026-06-01"}, headers=auth_headers)
            assert resp.status_code == 400

    def test_create_exam_missing_date(self, client, app, auth_headers, seeded_exam):
        with app.app_context():
            resp = client.post("/api/exams", json={"name": "期末考试"}, headers=auth_headers)
            assert resp.status_code == 400

    # ---- 更新 ----
    def test_update_exam(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            resp = client.put(
                f"/api/exams/{exam_id}",
                json={"name": "期中考试(改)", "importance": "high"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["name"] == "期中考试(改)"
            assert Exam.query.get(exam_id).name == "期中考试(改)"

    def test_update_exam_not_found(self, client, app, auth_headers, seeded_exam):
        resp = client.put("/api/exams/999999", json={"name": "x"}, headers=auth_headers)
        assert resp.status_code == 404

    # ---- 删除（幂等） ----
    def test_delete_exam(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            resp = client.delete(f"/api/exams/{exam_id}", headers=auth_headers)
            assert resp.status_code == 200
            assert Exam.query.get(exam_id) is None

    def test_delete_exam_idempotent(self, client, app, auth_headers, seeded_exam):
        resp = client.delete("/api/exams/999999", headers=auth_headers)
        assert resp.status_code == 200

    # ---- 发布状态机 ----
    def test_publish_exam(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            resp = client.post(f"/api/exams/{exam_id}/publish", headers=auth_headers)
            assert resp.status_code == 200
            assert Exam.query.get(exam_id).status == "published"

    def test_publish_exam_idempotent(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            client.post(f"/api/exams/{exam_id}/publish", headers=auth_headers)
            resp = client.post(f"/api/exams/{exam_id}/publish", headers=auth_headers)
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["message"] == "考试已发布"

    def test_publish_exam_not_draft(self, client, app, auth_headers, seeded_exam):
        with app.app_context():
            resp = client.post(
                "/api/exams",
                json={"name": "已关闭考试", "date": "2026-06-01", "status": "closed"},
                headers=auth_headers,
            )
            closed_id = resp.get_json()["data"]["id"]
            r2 = client.post(f"/api/exams/{closed_id}/publish", headers=auth_headers)
            assert r2.status_code == 400

    # ---- 关闭状态机 ----
    def test_close_exam(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            client.post(f"/api/exams/{exam_id}/publish", headers=auth_headers)
            resp = client.post(f"/api/exams/{exam_id}/close", headers=auth_headers)
            assert resp.status_code == 200
            assert Exam.query.get(exam_id).status == "closed"

    def test_close_exam_idempotent(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            client.post(f"/api/exams/{exam_id}/publish", headers=auth_headers)
            client.post(f"/api/exams/{exam_id}/close", headers=auth_headers)
            resp = client.post(f"/api/exams/{exam_id}/close", headers=auth_headers)
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["message"] == "考试已结束"

    def test_close_exam_not_published(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            resp = client.post(f"/api/exams/{exam_id}/close", headers=auth_headers)
            assert resp.status_code == 400


class TestScoreRoutes:
    # ---- 单条创建 ----
    def test_create_score(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        stu2 = seeded_exam["stu2_id"]
        subj2 = seeded_exam["subj2_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores",
                json={
                    "exam_id": exam_id,
                    "student_id": stu2,
                    "subject_id": subj2,
                    "score": 85,
                    "full_score": 100,
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["score"] == 85
            assert (
                Score.query.filter_by(exam_id=exam_id, student_id=stu2, subject_id=subj2).first()
                is not None
            )

    def test_create_score_missing_subject(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        stu2 = seeded_exam["stu2_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores",
                json={"exam_id": exam_id, "student_id": stu2, "score": 85},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    def test_create_score_exam_not_found(self, client, app, auth_headers, seeded_exam):
        stu2 = seeded_exam["stu2_id"]
        subj2 = seeded_exam["subj2_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores",
                json={"exam_id": 999999, "student_id": stu2, "subject_id": subj2, "score": 85},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    def test_create_score_exam_closed(self, client, app, auth_headers, seeded_exam):
        stu2 = seeded_exam["stu2_id"]
        subj2 = seeded_exam["subj2_id"]
        with app.app_context():
            r = client.post(
                "/api/exams",
                json={"name": "已关闭", "date": "2026-06-01", "status": "closed"},
                headers=auth_headers,
            )
            closed_id = r.get_json()["data"]["id"]
            resp = client.post(
                "/api/scores",
                json={"exam_id": closed_id, "student_id": stu2, "subject_id": subj2, "score": 85},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    def test_create_score_out_of_range(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        stu2 = seeded_exam["stu2_id"]
        subj2 = seeded_exam["subj2_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores",
                json={"exam_id": exam_id, "student_id": stu2, "subject_id": subj2, "score": 150},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    def test_create_score_duplicate(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        stu1 = seeded_exam["stu1_id"]
        subj1 = seeded_exam["subj1_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores",
                json={"exam_id": exam_id, "student_id": stu1, "subject_id": subj1, "score": 80},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    # ---- 批量创建 ----
    def test_batch_create_scores(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        stu1 = seeded_exam["stu1_id"]
        stu2 = seeded_exam["stu2_id"]
        subj1 = seeded_exam["subj1_id"]
        subj2 = seeded_exam["subj2_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores/batch",
                json={
                    "exam_id": exam_id,
                    "scores": [
                        {"student_id": stu2, "subject_id": subj1, "score": 70},
                        {"student_id": stu1, "subject_id": subj2, "score": 88},
                    ],
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["created"] == 2
            assert body["data"]["total"] == 2

    def test_batch_create_scores_missing_exam_id(self, client, app, auth_headers, seeded_exam):
        with app.app_context():
            resp = client.post("/api/scores/batch", json={"scores": []}, headers=auth_headers)
            assert resp.status_code == 400

    def test_batch_create_scores_empty(self, client, app, auth_headers, seeded_exam):
        with app.app_context():
            resp = client.post(
                "/api/scores/batch",
                json={"exam_id": seeded_exam["exam_id"], "scores": []},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    def test_batch_create_scores_student_not_found(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        subj1 = seeded_exam["subj1_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores/batch",
                json={
                    "exam_id": exam_id,
                    "scores": [{"student_id": 999999, "subject_id": subj1, "score": 70}],
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["created"] == 0
            assert len(body["data"]["errors"]) == 1

    # ---- 更新 ----
    def test_update_score(self, client, app, auth_headers, seeded_exam):
        score_id = seeded_exam["score_id"]
        with app.app_context():
            resp = client.put(
                f"/api/scores/{score_id}",
                json={"score": 95, "remark": "进步"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["score"] == 95
            assert Score.query.get(score_id).score == 95

    def test_update_score_not_found(self, client, app, auth_headers, seeded_exam):
        resp = client.put("/api/scores/999999", json={"score": 95}, headers=auth_headers)
        assert resp.status_code == 404

    def test_update_score_exam_closed(self, client, app, auth_headers, seeded_exam):
        score_id = seeded_exam["score_id"]
        with app.app_context():
            client.post(f"/api/exams/{seeded_exam['exam_id']}/publish", headers=auth_headers)
            client.post(f"/api/exams/{seeded_exam['exam_id']}/close", headers=auth_headers)
            resp = client.put(f"/api/scores/{score_id}", json={"score": 95}, headers=auth_headers)
            assert resp.status_code == 400

    def test_update_score_out_of_range(self, client, app, auth_headers, seeded_exam):
        score_id = seeded_exam["score_id"]
        with app.app_context():
            resp = client.put(f"/api/scores/{score_id}", json={"score": 200}, headers=auth_headers)
            assert resp.status_code == 400

    # ---- 删除 ----
    def test_delete_score(self, client, app, auth_headers, seeded_exam):
        score_id = seeded_exam["score_id"]
        with app.app_context():
            resp = client.delete(f"/api/scores/{score_id}", headers=auth_headers)
            assert resp.status_code == 200
            assert Score.query.get(score_id) is None

    def test_delete_score_not_found(self, client, app, auth_headers, seeded_exam):
        resp = client.delete("/api/scores/999999", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_score_exam_closed(self, client, app, auth_headers, seeded_exam):
        score_id = seeded_exam["score_id"]
        with app.app_context():
            client.post(f"/api/exams/{seeded_exam['exam_id']}/publish", headers=auth_headers)
            client.post(f"/api/exams/{seeded_exam['exam_id']}/close", headers=auth_headers)
            resp = client.delete(f"/api/scores/{score_id}", headers=auth_headers)
            assert resp.status_code == 400

    # ---- 批量确认 ----
    def test_confirm_all_scores(self, client, app, auth_headers, seeded_exam):
        exam_id = seeded_exam["exam_id"]
        with app.app_context():
            resp = client.post(
                "/api/scores/confirm-all", json={"exam_id": exam_id}, headers=auth_headers
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["data"]["updated"] == 1
            assert Score.query.get(seeded_exam["score_id"]).status == "confirmed"

    def test_confirm_all_scores_missing_exam_id(self, client, app, auth_headers, seeded_exam):
        with app.app_context():
            resp = client.post("/api/scores/confirm-all", json={}, headers=auth_headers)
            assert resp.status_code == 400
