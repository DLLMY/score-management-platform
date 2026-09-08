import pytest
from datetime import date, timedelta
from models import db
from models.homework import HomeworkAssignment, HomeworkSubmission
from services.homework_service import homework_service


class TestHomeworkService:
    def test_create_assignment(self, app, db_session):
        result = homework_service.create_assignment(
            {
                "class_id": 1,
                "subject_id": 1,
                "title": "数学作业",
                "due_date": (date.today() + timedelta(days=3)).isoformat(),
            }
        )
        assert result[0]["success"] is True
        assert result[1] == 201

    def test_list_assignments(self, app, db_session):
        homework_service.create_assignment(
            {
                "class_id": 1,
                "title": "列表测试作业",
                "due_date": (date.today() + timedelta(days=1)).isoformat(),
            }
        )
        result = homework_service.list_assignments(class_id=1)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_mark_submitted(self, app, db_session):
        create_result = homework_service.create_assignment(
            {
                "class_id": 1,
                "title": "提交测试作业",
                "due_date": (date.today() + timedelta(days=1)).isoformat(),
            }
        )
        assignment_id = create_result[0]["data"]["id"]
        result = homework_service.mark_submitted(assignment_id, 10)
        assert result["success"] is True
        assert result["data"]["is_submitted"] is True

    def test_mark_checked(self, app, db_session):
        create_result = homework_service.create_assignment(
            {
                "class_id": 1,
                "title": "批改测试作业",
                "due_date": (date.today() + timedelta(days=1)).isoformat(),
            }
        )
        assignment_id = create_result[0]["data"]["id"]
        homework_service.mark_submitted(assignment_id, 10)
        result = homework_service.mark_checked(assignment_id, 10, "完成良好")
        assert result["success"] is True

    def test_delete_assignment(self, app, db_session):
        create_result = homework_service.create_assignment(
            {
                "class_id": 1,
                "title": "删除测试作业",
                "due_date": (date.today() + timedelta(days=1)).isoformat(),
            }
        )
        assignment_id = create_result[0]["data"]["id"]
        result = homework_service.delete_assignment(assignment_id)
        assert result["success"] is True
