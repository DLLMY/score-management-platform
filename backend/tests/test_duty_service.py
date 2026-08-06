import pytest
from datetime import date, timedelta
from models import db
from models.duty import DutyGroup, DutyAssignment
from services.duty_service import duty_service


class TestDutyService:
    def test_create_group(self, app, db_session):
        result = duty_service.create_group({
            "class_id": 1, "name": "第一值日组", "day_of_week": "monday", "area": "教室"
        })
        assert result[0]["success"] is True
        assert result[1] == 201

    def test_list_groups(self, app, db_session):
        duty_service.create_group({"class_id": 1, "name": "第二值日组", "day_of_week": "tuesday"})
        result = duty_service.list_groups(class_id=1)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_create_assignment(self, app, db_session):
        group_result = duty_service.create_group({"class_id": 1, "name": "测试组"})
        group_id = group_result[0]["data"]["id"]
        result = duty_service.create_assignment({
            "group_id": group_id, "student_id": 1,
            "date": date.today().isoformat(), "task": "擦黑板"
        })
        assert result[0]["success"] is True

    def test_mark_complete(self, app, db_session):
        group_result = duty_service.create_group({"class_id": 1, "name": "完成测试组"})
        group_id = group_result[0]["data"]["id"]
        assign_result = duty_service.create_assignment({
            "group_id": group_id, "student_id": 1,
            "date": date.today().isoformat(), "task": "扫地"
        })
        assignment_id = assign_result[0]["data"]["id"]
        result = duty_service.mark_complete(assignment_id)
        assert result["success"] is True
        assert result["data"]["is_completed"] is True

    def test_rotate_assignments(self, app, db_session):
        duty_service.create_group({"class_id": 1, "name": "旋转测试组"})
        result = duty_service.rotate_assignments(class_id=1, period="weekly")
        assert result["success"] is True

    def test_delete_group(self, app, db_session):
        group_result = duty_service.create_group({"class_id": 1, "name": "待删除组"})
        group_id = group_result[0]["data"]["id"]
        result = duty_service.delete_group(group_id)
        assert result["success"] is True
