import pytest
from models import db
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupScore
from services.study_group_service import study_group_service


class TestStudyGroupService:
    def test_create_group(self, app, db_session):
        result = study_group_service.create_group(
            {"class_id": 1, "name": "第一学习小组", "member_ids": [10, 11, 12]}
        )
        assert result[0]["success"] is True
        assert result[0]["data"]["member_count"] == 3

    def test_list_groups(self, app, db_session):
        study_group_service.create_group({"class_id": 1, "name": "第二组"})
        result = study_group_service.list_groups(class_id=1)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_add_member(self, app, db_session):
        create_result = study_group_service.create_group({"class_id": 1, "name": "加人测试组"})
        group_id = create_result[0]["data"]["id"]
        result = study_group_service.add_member(group_id, 15)
        assert result["success"] is True

    def test_add_score(self, app, db_session):
        create_result = study_group_service.create_group({"class_id": 1, "name": "积分测试组"})
        group_id = create_result[0]["data"]["id"]
        result = study_group_service.add_score(group_id, 10, "积极讨论")
        assert result["success"] is True
        assert result["data"]["new_score"] == 10

    def test_remove_member(self, app, db_session):
        create_result = study_group_service.create_group(
            {"class_id": 1, "name": "移除测试组", "member_ids": [10]}
        )
        group_id = create_result[0]["data"]["id"]
        result = study_group_service.remove_member(group_id, 10)
        assert result["success"] is True
