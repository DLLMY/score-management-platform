import pytest
from models import db
from models.activity import Activity, ActivityRegistration
from models.culture import CultureRecord
from models.study_guide import StudyGuide, ImprovementPlan
from services.activity_service import activity_service
from services.culture_service import culture_service
from services.study_guide_service import study_guide_service


class TestActivityService:
    def test_create_activity(self, app, db_session):
        result = activity_service.create_activity({
            "class_id": 1, "title": "运动会", "activity_type": "sports"
        })
        assert result[0]["success"] is True

    def test_register_student(self, app, db_session):
        create_result = activity_service.create_activity({
            "class_id": 1, "title": "报名测试活动"
        })
        activity_id = create_result[0]["data"]["id"]
        result = activity_service.register_student(activity_id, 10)
        assert result["success"] is True


class TestCultureService:
    def test_create_record(self, app, db_session):
        result = culture_service.create_record({
            "class_id": 1, "category": "slogan",
            "title": "班级口号", "content": "团结友爱"
        })
        assert result[0]["success"] is True


class TestStudyGuideService:
    def test_create_guide(self, app, db_session):
        result = study_guide_service.create_guide({
            "class_id": 1, "title": "高效学习方法",
            "guide_type": "method", "content": "费曼学习法..."
        })
        assert result[0]["success"] is True

    def test_create_plan(self, app, db_session):
        result = study_guide_service.create_plan({
            "student_id": 10, "plan_type": "tutorial",
            "target_score": 90, "current_score": 75
        })
        assert result[0]["success"] is True

    def test_update_plan_progress(self, app, db_session):
        create_result = study_guide_service.create_plan({
            "student_id": 10, "plan_type": "remedial",
            "progress": 50
        })
        plan_id = create_result[0]["data"]["id"]
        result = study_guide_service.update_plan_progress(plan_id, 100)
        assert result["success"] is True
        assert result["data"]["is_completed"] is True