import pytest
from models import db
from models import ClassInfo, User
from models.activity import Activity, ActivityRegistration
from models.culture import CultureRecord
from models.study_guide import StudyGuide, ImprovementPlan
from services.activity_service import activity_service
from services.culture_service import culture_service
from services.study_guide_service import study_guide_service


@pytest.fixture
def existing_class(db_session):
    """创建一个真实班级（E4 校验后 create_* 需要 class_id 真实存在）。"""
    cls = ClassInfo(name=f"测试班-{id(object())}", grade="高一")
    db_session.add(cls)
    db_session.commit()
    return cls


@pytest.fixture
def existing_student(db_session):
    """创建一个真实学生（require_student 校验需要 student_id 存在）。"""
    u = User(name=f"测试学生-{id(object())}", card_id=f"C{id(object())}")
    db_session.add(u)
    db_session.commit()
    return u


class TestActivityService:
    def test_create_activity(self, app, db_session, existing_class):
        result = activity_service.create_activity({
            "class_id": existing_class.id, "title": "运动会", "activity_type": "sports"
        })
        assert result[0]["success"] is True

    def test_register_student(self, app, db_session, existing_class):
        create_result = activity_service.create_activity({
            "class_id": existing_class.id, "title": "报名测试活动"
        })
        activity_id = create_result[0]["data"]["id"]
        result = activity_service.register_student(activity_id, 10)
        assert result["success"] is True


class TestCultureService:
    def test_create_record(self, app, db_session, existing_class):
        result = culture_service.create_record({
            "class_id": existing_class.id, "category": "slogan",
            "title": "班级口号", "content": "团结友爱"
        })
        assert result[0]["success"] is True


class TestStudyGuideService:
    def test_create_guide(self, app, db_session, existing_class):
        result = study_guide_service.create_guide({
            "class_id": existing_class.id, "title": "高效学习方法",
            "guide_type": "method", "content": "费曼学习法..."
        })
        assert result[0]["success"] is True

    def test_create_plan(self, app, db_session, existing_student):
        result = study_guide_service.create_plan({
            "student_id": existing_student.id, "plan_type": "tutorial",
            "target_score": 90, "current_score": 75
        })
        assert result[0]["success"] is True

    def test_update_plan_progress(self, app, db_session, existing_student):
        create_result = study_guide_service.create_plan({
            "student_id": existing_student.id, "plan_type": "remedial",
            "progress": 50
        })
        plan_id = create_result[0]["data"]["id"]
        result = study_guide_service.update_plan_progress(plan_id, 100)
        assert result["success"] is True
        assert result["data"]["is_completed"] is True