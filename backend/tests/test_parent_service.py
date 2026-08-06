import pytest
from models import db
from models.parent import ParentContact, ContactLog
from services.parent_service import parent_service


class TestParentService:
    def test_create_contact(self, app, db_session):
        result = parent_service.create_contact({
            "student_id": 10, "father_name": "张三",
            "father_phone": "13800138000", "mother_name": "李四"
        })
        assert result[0]["success"] is True
        assert result[1] == 201

    def test_list_contacts(self, app, db_session):
        parent_service.create_contact({"student_id": 10, "father_name": "测试爸爸"})
        result = parent_service.list_contacts()
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_update_contact(self, app, db_session):
        create_result = parent_service.create_contact({"student_id": 10, "father_name": "原名"})
        contact_id = create_result[0]["data"]["id"]
        result = parent_service.update_contact(contact_id, {"father_name": "新名"})
        assert result["success"] is True
        assert result["data"]["father_name"] == "新名"

    def test_create_contact_log(self, app, db_session):
        create_result = parent_service.create_contact({"student_id": 10, "father_name": "日志测试"})
        contact_id = create_result[0]["data"]["id"]
        result = parent_service.create_contact_log({
            "parent_id": contact_id, "contact_type": "phone",
            "content": "沟通学习情况"
        })
        assert result[0]["success"] is True

    def test_resolve_log(self, app, db_session):
        contact_result = parent_service.create_contact({"student_id": 10, "father_name": "解决测试"})
        contact_id = contact_result[0]["data"]["id"]
        log_result = parent_service.create_contact_log({
            "parent_id": contact_id, "content": "待解决问题"
        })
        log_id = log_result[0]["data"]["id"]
        result = parent_service.resolve_log(log_id)
        assert result["success"] is True
        assert result["data"]["is_resolved"] is True
