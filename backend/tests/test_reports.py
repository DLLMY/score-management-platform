"""班级学期报告导出测试（P1 科任老师效率模块）

覆盖 GET /api/reports/class-semester（权限 score.view）：
- Excel / CSV 成功导出（内容类型正确、非空）
- 缺 class_id → 400
- 班级不存在 → 404
- 学生 token(type=student) 调 admin 端点 → 401/403（权限隔离）

依赖 conftest 的 client / auth_headers（super_admin）/ app_context fixture。
"""
import uuid

import pytest

from models import db, ClassInfo, Exam, Score, User
from utils.security import generate_student_token


@pytest.fixture
def klass(app_context):
    c = ClassInfo(name="RptClass_" + uuid.uuid4().hex[:6])
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def students(app_context, klass):
    out = []
    for i in range(3):
        u = User(
            name=f"rpt_stu_{i}",
            card_id="RPT" + uuid.uuid4().hex[:10],
            is_active=True,
            class_info_id=klass.id,
            current_score=80 + i,
        )
        db.session.add(u)
        out.append(u)
    db.session.commit()
    return out


@pytest.fixture
def exam_with_scores(app_context, klass, students):
    e = Exam(name="RptExam_" + uuid.uuid4().hex[:6], status="published", class_id=klass.id)
    db.session.add(e)
    db.session.commit()
    for i, s in enumerate(students):
        db.session.add(
            Score(exam_id=e.id, student_id=s.id, subject="数学", score=90 - i * 5)
        )
        db.session.add(
            Score(exam_id=e.id, student_id=s.id, subject="语文", score=85 + i * 3)
        )
    db.session.commit()
    return e


class TestClassSemesterReport:
    def test_export_excel_success(self, client, auth_headers, klass, students, exam_with_scores):
        resp = client.get(f"/api/reports/class-semester?class_id={klass.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert "spreadsheetml" in resp.content_type
        assert len(resp.data) > 0

    def test_export_csv_success(self, client, auth_headers, klass, students, exam_with_scores):
        resp = client.get(
            f"/api/reports/class-semester?class_id={klass.id}&format=csv", headers=auth_headers
        )
        assert resp.status_code == 200
        assert "text/csv" in resp.content_type
        assert len(resp.data) > 0
        # CSV 含 BOM 与表头
        assert resp.data[:3] == b"\xef\xbb\xbf"

    def test_missing_class_id(self, client, auth_headers):
        resp = client.get("/api/reports/class-semester", headers=auth_headers)
        assert resp.status_code == 400

    def test_class_not_found(self, client, auth_headers):
        resp = client.get("/api/reports/class-semester?class_id=999999", headers=auth_headers)
        assert resp.status_code == 404

    def test_rejects_student_token(self, client, students):
        s = students[0]
        token = generate_student_token(s.id, s.name, s.card_id)
        resp = client.get(
            f"/api/reports/class-semester?class_id={s.class_info_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        # JWT 类型隔离：学生 token(type=student) 不能调 admin 端点
        assert resp.status_code in (401, 403)
