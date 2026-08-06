#!/usr/bin/env python3
"""
上课时间 - GET /api/course-schedules/now 端点测试

验证：
1. 不带 class_info_id 时返回全局上课状态、当前节次与 in_session 字段结构。
2. 带 class_info_id 时，按班级课表反查命中上课返回 in_session=True 及班级/科目信息。
"""
from services.class_time_checker import ClassTimeChecker


class TestCourseScheduleNow:
    def test_now_no_class_param(self, app, client, auth_headers):
        """不带 class_info_id：返回全局状态字段结构。"""
        resp = client.get("/api/course-schedules/now", headers=auth_headers)
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["success"] is True
        data = body["data"]
        assert "is_during_class_time" in data
        assert "period" in data
        assert "in_session" in data
        assert "now" in data
        assert data["class_info_id"] is None

    def test_now_with_class_in_session(self, app, client, auth_headers, monkeypatch):
        """带 class_info_id 且课表反查命中上课 -> in_session=True 并带班级/科目。"""
        monkeypatch.setattr(
            ClassTimeChecker,
            "is_during_class_time",
            lambda check_time=None: (False, None),
        )
        monkeypatch.setattr(
            ClassTimeChecker,
            "check_class_in_session",
            lambda class_info_id, check_time=None: (
                True,
                {
                    "class_info_id": class_info_id,
                    "class_name": "测试班",
                    "period_number": 2,
                    "subject_name": "数学",
                },
            ),
        )
        resp = client.get(
            "/api/course-schedules/now?class_info_id=1", headers=auth_headers
        )
        body = resp.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["in_session"] is True
        assert data["class_info_id"] == 1
        assert data["class_name"] == "测试班"
        assert data["subject_name"] == "数学"

    def test_now_with_class_not_in_session(self, app, client, auth_headers, monkeypatch):
        """带 class_info_id 且课表反查未命中上课 -> in_session=False。"""
        monkeypatch.setattr(
            ClassTimeChecker,
            "is_during_class_time",
            lambda check_time=None: (False, None),
        )
        monkeypatch.setattr(
            ClassTimeChecker,
            "check_class_in_session",
            lambda class_info_id, check_time=None: (False, None),
        )
        resp = client.get(
            "/api/course-schedules/now?class_info_id=1", headers=auth_headers
        )
        body = resp.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["in_session"] is False
        assert data["class_name"] == ""
        assert data["subject_name"] == ""
