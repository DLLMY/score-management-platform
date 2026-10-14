"""R25 回归：读路径优化（簇 D 同表多 COUNT 条件聚合 + 簇 N+1 批量预取）。

- 簇 D（R25-1/2）：notify_history / admin_notifications 统计端点，把同表多 COUNT 合并为
  单条条件聚合；用 SQL 计数 harness（after_cursor_execute + 精确表名）证明目标表 SELECT
  降到 1，并验证契约与数值。cached_api 路由用唯一 ?v= 参数穿透缓存。
- 簇 N+1（R25-3/4/5）：exam 录分列表 / 课表导出 / 科目班级列表，把循环内逐行 get_by_id
  改为「收集 id -> 一次 IN 查询 -> dict 回查」；证明目标关联表 SELECT 恒为批处理条数，
  不随行数增长，且序列化字段（name/grade/color/username 等）正确。
"""

import re
import time

from sqlalchemy import event

from models import (
    Admin,
    ClassInfo,
    CourseSchedule,
    Exam,
    Notification,
    NotifyHistory,
    Score,
    Subject,
    SubjectClass,
    User,
    db,
)
from services.course_schedule_service import build_schedule_export_data
from services.exam_import_query_service import get_import_history_view
from services.subject_service import get_subject_classes_view


def _count_table_selects(app, fn, tables, warmup=None):
    """统计 fn() 执行期间真实引用 tables 的 SELECT 条数（R23/R24 同款 harness）。"""
    pat = re.compile("|".join(r"(?:from|join)\s+%s\b|%s\." % (t, t) for t in tables))
    counter = {"n": 0}

    def _after(conn, cursor, statement, *args, **kwargs):
        s = " ".join(statement.strip().lower().split())
        if s.startswith("select") and pat.search(s):
            counter["n"] += 1

    engine = db.engine
    event.listen(engine, "after_cursor_execute", _after)
    try:
        with app.app_context():
            if warmup is not None:
                warmup()
                counter["n"] = 0
            return fn(), counter["n"]
    finally:
        event.remove(engine, "after_cursor_execute", _after)


def _bust():
    """唯一 query 参数，穿透 cached_api(ttl) 使命中缓存失效、真实执行查询。"""
    return "r25%d" % int(time.time() * 1000)


class TestR25NotifyHistoryStats:
    """R25-1：/api/notify_history/stats 6 COUNT -> 1 条件聚合。"""

    def _seed(self, db_session):
        from datetime import datetime, timedelta

        now = datetime.now()
        rows = [
            NotifyHistory(text="t1", status="sent", created_at=now),
            NotifyHistory(text="t2", status="failed", created_at=now),
            NotifyHistory(text="t3", status="sent", created_at=now - timedelta(days=10)),
            NotifyHistory(text="t4", status="sent", created_at=now - timedelta(days=40)),
        ]
        db_session.add_all(rows)
        db_session.commit()

    def test_query_count(self, client, app, auth_headers, db_session):
        self._seed(db_session)
        (resp, cnt) = _count_table_selects(
            app,
            lambda: client.get("/api/notify_history/stats?v=%s" % _bust(), headers=auth_headers),
            {"notify_histories"},
        )
        assert resp.status_code == 200
        assert cnt == 1, cnt  # 原 total/today/week/month/sent/failed 6 COUNT -> 1

    def test_numeric(self, client, app, auth_headers, db_session):
        self._seed(db_session)
        resp = client.get("/api/notify_history/stats?v=%s" % _bust(), headers=auth_headers)
        assert resp.status_code == 200
        d = resp.get_json()
        assert d["total_count"] == 4
        assert d["today_count"] == 2
        assert d["week_count"] == 2  # 仅今日 2 条（10 天前在 7 天窗外）
        assert d["month_count"] == 3  # 今日 2 + 10 天前 1（40 天前在 30 天窗外）
        assert d["success_count"] == 3
        assert d["fail_count"] == 1
        assert d["success_rate"] == 75.0


class TestR25AdminNotificationCount:
    """R25-2：/api/admin_notifications/count unread+total 2 COUNT -> 1 条件聚合。"""

    def _seed(self, db_session):
        rows = [
            Notification(type="t", title="n1", content="c", recipient_type="admin", admin_id=1, is_read=False),
            Notification(type="t", title="n2", content="c", recipient_type="admin", admin_id=1, is_read=False),
            Notification(type="t", title="n3", content="c", recipient_type="admin", admin_id=1, is_read=True),
        ]
        db_session.add_all(rows)
        db_session.commit()

    def test_query_count(self, client, app, auth_headers, db_session):
        self._seed(db_session)
        (resp, cnt) = _count_table_selects(
            app,
            lambda: client.get(
                "/api/admin_notifications/count?admin_id=1&v=%s" % _bust(), headers=auth_headers
            ),
            {"notification"},
        )
        assert resp.status_code == 200
        assert cnt == 1, cnt  # 原 unread + total 2 COUNT -> 1

    def test_numeric(self, client, app, auth_headers, db_session):
        base_u = Notification.query.filter_by(recipient_type="admin", is_read=False).count()
        base_t = Notification.query.filter_by(recipient_type="admin").count()
        self._seed(db_session)
        resp = client.get(
            "/api/admin_notifications/count?admin_id=1&v=%s" % _bust(), headers=auth_headers
        )
        assert resp.status_code == 200
        d = resp.get_json()["data"]
        assert d["unread_count"] == base_u + 2
        assert d["total_count"] == base_t + 3


class TestR25ExamImportHistory:
    """R25-3：get_import_history_view 每行 3xget_by_id + subject_rel 懒加载 -> 批量预取。"""

    def _seed(self, db_session):
        admin = Admin(username="r25t", password="pw", real_name="Teacher R25", role="admin")
        s1 = User(name="S1", card_id="R25S1", is_active=True)
        s2 = User(name="S2", card_id="R25S2", is_active=True)
        e1 = Exam(name="E1")
        e2 = Exam(name="E2")
        su1 = Subject(name="SU1")
        su2 = Subject(name="SU2")
        db_session.add_all([admin, s1, s2, e1, e2, su1, su2])
        db_session.commit()
        scores = [
            Score(student_id=s1.id, exam_id=e1.id, subject_id=su1.id, score=90, full_score=100, status="entered", entered_by=admin.id),
            Score(student_id=s2.id, exam_id=e1.id, subject_id=su2.id, score=80, full_score=100, status="entered", entered_by=admin.id),
            Score(student_id=s1.id, exam_id=e2.id, subject_id=su1.id, score=85, full_score=100, status="entered", entered_by=admin.id),
        ]
        db_session.add_all(scores)
        db_session.commit()

    def test_batch_query_count(self, app, db_session):
        self._seed(db_session)
        (res, cnt) = _count_table_selects(
            app, lambda: get_import_history_view(), {"user", "exams", "admin", "subject"}
        )
        assert cnt == 4, cnt  # student/exam/admin/subject_rel 4 个 selectin 批量预取（原每行 3 get_by_id）

    def test_contract_and_numeric(self, app, db_session):
        self._seed(db_session)
        with app.app_context():
            res = get_import_history_view()
        data = res["data"]
        assert len(data) == 3
        row = data[0]
        assert set(row.keys()) >= {
            "id", "exam_name", "student_name", "student_card_id", "subject",
            "score", "full_score", "status", "entered_by", "entered_at",
        }
        assert row["student_name"] in ("S1", "S2")
        assert row["exam_name"] in ("E1", "E2")
        assert row["subject"] in ("SU1", "SU2")
        assert row["entered_by"] == "r25t"  # Admin.username


class TestR25ScheduleExport:
    """R25-4：build_schedule_export_data 每行 2xget_by_id -> 批量预取。"""

    def _seed(self, db_session):
        cls = ClassInfo(name="R25导出班", grade="高一")
        db_session.add(cls)
        db_session.commit()
        subs = [Subject(name="R25科目%d" % i) for i in (1, 2, 3)]
        db_session.add_all(subs)
        db_session.commit()
        for i, sub in enumerate(subs, start=1):
            db_session.add(
                CourseSchedule(
                    class_info_id=cls.id,
                    subject_id=sub.id,
                    day_of_week=i,
                    period_number=i,
                    teacher_name="T",
                )
            )
        db_session.commit()

    def test_batch_query_count(self, app, db_session):
        self._seed(db_session)
        (res, cnt) = _count_table_selects(
            app, lambda: build_schedule_export_data(None), {"class_info", "subject"}
        )
        data, _prefix = res
        assert len(data) == 3
        assert cnt == 2, cnt  # class_info + subject 2 个 selectin 批量预取（原每行 2 get_by_id）

    def test_contract(self, app, db_session):
        self._seed(db_session)
        with app.app_context():
            data, prefix = build_schedule_export_data(None)
        row = data[0]
        assert row["class_name"] == "R25导出班"
        assert row["class_grade"] == "高一"
        assert row["subject_name"].startswith("R25科目")
        assert "subject_color" in row
        assert isinstance(prefix, str) and prefix.startswith("course_schedules_export_")


class TestR25SubjectClasses:
    """R25-5：get_subject_classes_view 每行 2xget_by_id -> 批量预取。"""

    def _seed(self, db_session):
        teacher = Admin(username="r25sub", password="pw", real_name="王老师", role="admin")
        subj = Subject(name="R25主科")
        db_session.add_all([teacher, subj])
        db_session.commit()
        for i in (1, 2, 3):
            cls = ClassInfo(name="R25班%d" % i, grade="高一")
            db_session.add(cls)
        db_session.commit()
        classes = ClassInfo.query.filter(ClassInfo.name.like("R25班%")).all()
        for cls in classes[:3]:
            db_session.add(SubjectClass(subject_id=subj.id, class_info_id=cls.id, teacher_id=teacher.id))
        db_session.commit()
        return subj.id

    def test_batch_query_count(self, app, db_session):
        sid = self._seed(db_session)
        (res, cnt) = _count_table_selects(
            app, lambda: get_subject_classes_view(sid), {"admin", "class_info"}
        )
        classes = res["classes"]
        assert len(classes) == 3
        assert cnt == 2, cnt  # teacher(admin) + class_info 2 个 selectin 批量预取（原每行 2 get_by_id）

    def test_contract(self, app, db_session):
        sid = self._seed(db_session)
        with app.app_context():
            res = get_subject_classes_view(sid)
        row = res["classes"][0]
        assert row["teacher_name"] == "王老师"  # Admin.real_name
        assert row["class_name"].startswith("R25班")
        assert row["grade"] == "高一"  # ClassInfo.grade
