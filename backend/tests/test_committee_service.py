import pytest
from datetime import date
from models import db
from models.committee import ClassCommittee, CommitteeTerm
from services.committee_service import committee_service


class TestCommitteeService:
    def test_create_member(self, app, db_session):
        result = committee_service.create_member({
            "class_id": 1, "position": "班长", "student_id": 10,
            "responsibilities": "负责班级日常管理"
        })
        assert result[0]["success"] is True
        assert result[1] == 201

    def test_list_members(self, app, db_session):
        committee_service.create_member({"class_id": 1, "position": "学习委员", "student_id": 11})
        result = committee_service.list_members(class_id=1)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_update_member(self, app, db_session):
        create_result = committee_service.create_member({
            "class_id": 1, "position": "体育委员", "student_id": 12
        })
        member_id = create_result[0]["data"]["id"]
        result = committee_service.update_member(member_id, {"rating": 5})
        assert result["success"] is True
        assert result["data"]["rating"] == 5

    def test_delete_member(self, app, db_session):
        create_result = committee_service.create_member({
            "class_id": 1, "position": "待解除", "student_id": 13
        })
        member_id = create_result[0]["data"]["id"]
        result = committee_service.delete_member(member_id)
        assert result["success"] is True

    def test_create_term(self, app, db_session):
        result = committee_service.create_term({
            "class_id": 1, "term_name": "2026秋季",
            "start_date": date.today().isoformat(), "is_current": True
        })
        assert result[0]["success"] is True

    def test_list_terms(self, app, db_session):
        committee_service.create_term({"class_id": 1, "term_name": "2026春季", "is_current": True})
        result = committee_service.list_terms(class_id=1)
        assert result["success"] is True
