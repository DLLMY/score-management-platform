"""exam_import 路由行为测试（F17 academics-1：admin_classes + exam_import）。

验证成绩 Excel 导入写入路径收口到 services.academics_service.execute_score_import 后行为零漂移：
- 插入（insert_count / imported_count / Score 落库）
- 更新已存在（update_existing=true → update_count；=false → failed_count）
- 考试未发布 400 / 考试不存在 404
- 分数越界（validate_score=true → failed_count）
"""
import io

import pytest

from models import db, ClassInfo, Exam, Score, Subject, User
from openpyxl import Workbook


@pytest.fixture
def exam_ctx(app):
    with app.app_context():
        cls = ClassInfo(name="测试班", grade="高一")
        db.session.add(cls)
        db.session.commit()
        cls_id = cls.id

        subj = Subject(name="语文", code="yw")
        db.session.add(subj)
        db.session.commit()
        subj_id = subj.id

        stu = User(
            name="张三",
            card_id="202401001",
            class_name="测试班",
            class_info_id=cls_id,
            role="student",
        )
        db.session.add(stu)
        db.session.commit()
        stu_id = stu.id

        exam = Exam(name="月考", status="published", subjects=["语文"])
        db.session.add(exam)
        db.session.commit()
        exam_id = exam.id
    return {"cls_id": cls_id, "subj_id": subj_id, "stu_id": stu_id, "exam_id": exam_id}


def _build_xlsx(rows):
    wb = Workbook()
    ws = wb.active
    ws.append(["学号", "科目", "分数", "满分", "备注"])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


class TestExamImportRoutes:
    def _post_execute(self, client, auth_headers, exam_id, buf, **form):
        data = {"exam_id": str(exam_id), "file": (buf, "scores.xlsx")}
        data.update({k: str(v) for k, v in form.items()})
        return client.post(
            "/api/exam-import/execute",
            data=data,
            headers={"Authorization": auth_headers["Authorization"]},
        )

    def test_execute_insert(self, client, app, auth_headers, exam_ctx):
        exam_id = exam_ctx["exam_id"]
        buf = _build_xlsx([["202401001", "语文", 85, 100, "进步"]])
        with app.app_context():
            resp = self._post_execute(client, auth_headers, exam_id, buf)
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["success"] is True
            d = body["data"]
            assert d["imported_count"] == 1
            assert d["insert_count"] == 1
            assert d["failed_count"] == 0
            sc = Score.query.filter_by(
                exam_id=exam_id, student_id=exam_ctx["stu_id"], subject_id=exam_ctx["subj_id"]
            ).first()
            assert sc is not None
            assert sc.score == 85.0

    def test_execute_update_existing(self, client, app, auth_headers, exam_ctx):
        exam_id = exam_ctx["exam_id"]
        buf = _build_xlsx([["202401001", "语文", 85, 100, ""]])
        with app.app_context():
            self._post_execute(client, auth_headers, exam_id, buf)
            buf2 = _build_xlsx([["202401001", "语文", 92, 100, ""]])
            resp = self._post_execute(client, auth_headers, exam_id, buf2, update_existing="true")
            assert resp.status_code == 200
            d = resp.get_json()["data"]
            assert d["update_count"] == 1
            sc = Score.query.filter_by(
                exam_id=exam_id, student_id=exam_ctx["stu_id"], subject_id=exam_ctx["subj_id"]
            ).first()
            assert sc.score == 92.0

    def test_execute_no_update_conflict(self, client, app, auth_headers, exam_ctx):
        exam_id = exam_ctx["exam_id"]
        buf = _build_xlsx([["202401001", "语文", 85, 100, ""]])
        with app.app_context():
            self._post_execute(client, auth_headers, exam_id, buf)
            buf2 = _build_xlsx([["202401001", "语文", 92, 100, ""]])
            resp = self._post_execute(client, auth_headers, exam_id, buf2, update_existing="false")
            d = resp.get_json()["data"]
            assert d["failed_count"] == 1

    def test_execute_exam_not_published(self, client, app, auth_headers, exam_ctx):
        exam_id = exam_ctx["exam_id"]
        with app.app_context():
            exam = Exam.query.get(exam_id)
            exam.status = "draft"
            db.session.commit()
        buf = _build_xlsx([["202401001", "语文", 85, 100, ""]])
        with app.app_context():
            resp = self._post_execute(client, auth_headers, exam_id, buf)
            assert resp.status_code == 400

    def test_execute_exam_not_found(self, client, app, auth_headers, exam_ctx):
        buf = _build_xlsx([["202401001", "语文", 85, 100, ""]])
        with app.app_context():
            resp = self._post_execute(client, auth_headers, 999999, buf)
            assert resp.status_code == 404

    def test_execute_invalid_score(self, client, app, auth_headers, exam_ctx):
        exam_id = exam_ctx["exam_id"]
        buf = _build_xlsx([["202401001", "语文", -5, 100, ""]])
        with app.app_context():
            resp = self._post_execute(client, auth_headers, exam_id, buf, validate_score="true")
            d = resp.get_json()["data"]
            assert d["failed_count"] == 1

