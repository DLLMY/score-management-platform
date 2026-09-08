import pytest
from datetime import date
from models import db
from models import ClassInfo, User
from models.committee import ClassCommittee, CommitteeTerm
from services.committee_service import committee_service


@pytest.fixture
def test_class(db_session):
    c = ClassInfo(name=f"班委班-{id(object())}", grade="高一")
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture
def test_students(db_session):
    users = [
        User(name=f"班委生{i}-{id(object())}", card_id=f"CM{i}-{id(object())}") for i in range(4)
    ]
    db_session.add_all(users)
    db_session.commit()
    return users


class TestCommitteeService:
    def test_create_member(self, app, db_session, test_class, test_students):
        result = committee_service.create_member(
            {
                "class_id": test_class.id,
                "position": "班长",
                "student_id": test_students[0].id,
                "responsibilities": "负责班级日常管理",
            }
        )
        assert result[0]["success"] is True
        assert result[1] == 201

    def test_list_members(self, app, db_session, test_class, test_students):
        committee_service.create_member(
            {"class_id": test_class.id, "position": "学习委员", "student_id": test_students[1].id}
        )
        result = committee_service.list_members(class_id=test_class.id)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_update_member(self, app, db_session, test_class, test_students):
        create_result = committee_service.create_member(
            {"class_id": test_class.id, "position": "体育委员", "student_id": test_students[2].id}
        )
        member_id = create_result[0]["data"]["id"]
        result = committee_service.update_member(member_id, {"rating": 5})
        assert result["success"] is True
        assert result["data"]["rating"] == 5

    def test_delete_member(self, app, db_session, test_class, test_students):
        create_result = committee_service.create_member(
            {"class_id": test_class.id, "position": "待解除", "student_id": test_students[3].id}
        )
        member_id = create_result[0]["data"]["id"]
        result = committee_service.delete_member(member_id)
        assert result["success"] is True

    def test_create_term(self, app, db_session, test_class):
        result = committee_service.create_term(
            {
                "class_id": test_class.id,
                "term_name": "2026秋季",
                "start_date": date.today().isoformat(),
                "is_current": True,
            }
        )
        assert result[0]["success"] is True

    def test_list_terms(self, app, db_session, test_class):
        committee_service.create_term(
            {"class_id": test_class.id, "term_name": "2026春季", "is_current": True}
        )
        result = committee_service.list_terms(class_id=test_class.id)
        assert result["success"] is True
