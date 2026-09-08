import pytest
from models import db, Subject, ClassInfo


def _envelope(resp):
    """兼容既有双元组契约：create 返回 [(dict,200),201]（body 为 list），其余返回 dict。

    统一抽取业务 envelope dict（含 success/code/message/data）。
    """
    body = resp.get_json()
    if isinstance(body, list):
        return body[0]
    return body


@pytest.fixture
def seeded_schedule(app, sample_class):
    with app.app_context():
        subject = Subject(name="数学", code="MATH01", is_active=True)
        db.session.add(subject)
        db.session.commit()
        return {
            "subject_id": subject.id,
            "class_info_id": sample_class.id,
            "class_name": sample_class.name,
        }


@pytest.fixture
def schedule_payload(seeded_schedule):
    return {
        "class_info_id": seeded_schedule["class_info_id"],
        "subject_id": seeded_schedule["subject_id"],
        "day_of_week": 0,
        "period_number": 1,
        "teacher_name": "张老师",
        "classroom": "101",
        "is_active": True,
    }


class TestCourseScheduleRoutes:
    def test_create_schedule(self, client, auth_headers, schedule_payload):
        resp = client.post("/api/course-schedules/", json=schedule_payload, headers=auth_headers)
        assert resp.status_code == 201
        env = _envelope(resp)
        assert env["success"] is True
        assert env["data"]["subject_id"] == schedule_payload["subject_id"]
        assert env["data"]["day_of_week"] == 0
        assert env["data"]["period_number"] == 1
        assert env["data"]["teacher_name"] == "张老师"
        assert env["data"]["classroom"] == "101"

    def test_create_duplicate_conflict(self, client, auth_headers, schedule_payload):
        r1 = client.post("/api/course-schedules/", json=schedule_payload, headers=auth_headers)
        assert r1.status_code == 201
        r2 = client.post("/api/course-schedules/", json=schedule_payload, headers=auth_headers)
        assert r2.status_code == 400
        assert "冲突" in _envelope(r2)["message"]

    def test_get_schedule(self, client, auth_headers, schedule_payload):
        create = client.post("/api/course-schedules/", json=schedule_payload, headers=auth_headers)
        sid = _envelope(create)["data"]["id"]
        resp = client.get(f"/api/course-schedules/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        assert _envelope(resp)["data"]["id"] == sid

    def test_get_schedule_404(self, client, auth_headers):
        resp = client.get("/api/course-schedules/999999", headers=auth_headers)
        assert resp.status_code == 404

    def test_update_schedule(self, client, auth_headers, schedule_payload):
        create = client.post("/api/course-schedules/", json=schedule_payload, headers=auth_headers)
        sid = _envelope(create)["data"]["id"]
        upd = {
            "subject_id": schedule_payload["subject_id"],
            "day_of_week": 2,
            "period_number": 3,
            "teacher_name": "李老师",
            "classroom": "202",
            "is_active": True,
        }
        resp = client.put(f"/api/course-schedules/{sid}", json=upd, headers=auth_headers)
        assert resp.status_code == 200
        sched = _envelope(resp)["data"]["schedule"]
        assert sched["day_of_week"] == 2
        assert sched["period_number"] == 3
        assert sched["teacher_name"] == "李老师"
        assert sched["classroom"] == "202"

    def test_update_schedule_404(self, client, auth_headers, schedule_payload):
        resp = client.put(
            "/api/course-schedules/999999", json=schedule_payload, headers=auth_headers
        )
        assert resp.status_code == 404

    def test_delete_schedule(self, client, auth_headers, schedule_payload):
        create = client.post("/api/course-schedules/", json=schedule_payload, headers=auth_headers)
        sid = _envelope(create)["data"]["id"]
        resp = client.delete(f"/api/course-schedules/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        assert _envelope(resp)["success"] is True
        resp2 = client.get(f"/api/course-schedules/{sid}", headers=auth_headers)
        assert resp2.status_code == 404

    def test_import_json_create(self, client, auth_headers, seeded_schedule):
        payload = {
            "data": [
                {
                    "class_name": seeded_schedule["class_name"],
                    "subject_name": "数学",
                    "day_of_week": "周三",
                    "period_number": 4,
                    "teacher_name": "王老师",
                    "classroom": "303",
                }
            ]
        }
        resp = client.post(
            "/api/course-schedules/import?conflict_strategy=update",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = _envelope(resp)["data"]
        assert data["success"] is True
        assert data["success_count"] == 1
        assert data["failed_count"] == 0

    def test_import_json_existing_slot_conflict(
        self, client, auth_headers, schedule_payload, seeded_schedule
    ):
        # 先建一条 day_of_week=0 period_number=1
        create = client.post("/api/course-schedules/", json=schedule_payload, headers=auth_headers)
        assert create.status_code == 201
        # 原路由在更新分支前先做 check_conflicts 且不传 exclude_id，故同槽位导入会被判冲突 -> 失败（不更新）。
        # 锁定该既有契约：success_count=0，failed_count=1，原记录不变。
        payload = {
            "data": [
                {
                    "class_name": seeded_schedule["class_name"],
                    "subject_name": "数学",
                    "day_of_week": 0,
                    "period_number": 1,
                    "teacher_name": "赵老师",
                    "classroom": "404",
                }
            ]
        }
        resp = client.post(
            "/api/course-schedules/import?conflict_strategy=update",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = _envelope(resp)["data"]
        assert data["success_count"] == 0
        assert data["failed_count"] == 1
        # 原记录未被更新
        list_resp = client.get(
            f'/api/course-schedules/?class_info_id={seeded_schedule["class_info_id"]}',
            headers=auth_headers,
        )
        schedules = _envelope(list_resp)["data"]["schedules"]
        matched = [s for s in schedules if s["day_of_week"] == 0 and s["period_number"] == 1]
        assert len(matched) == 1
        assert matched[0]["teacher_name"] == "张老师"
