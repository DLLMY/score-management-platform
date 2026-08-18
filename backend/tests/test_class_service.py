from models import ClassInfo

"""Tests for Class Service"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

try:
    from services.class_service import ClassService
except ImportError:
    pass


class TestClassService:
    """测试班级服务"""

    def test_init(self):
        """测试初始化"""
        from services.class_service import ClassService

        service = ClassService()

        assert service is not None

    def test_can_access_class_no_admin(self, app):
        """测试班级访问权限-无管理员"""
        with app.app_context():

            service = ClassService()

            result = service._can_access_class("一班")

            assert result is False

    def test_can_access_class_admin_none_allowed(self, app):
        """测试班级访问权限-管理员无限制"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            with patch("services.class_service.get_allowed_classes", return_value=None):
                result = service._can_access_class("一班", admin=mock_admin)

                assert result is True

    def test_can_access_class_admin_allowed(self, app):
        """测试班级访问权限-管理员有权限"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            with patch(
                "services.class_service.get_allowed_classes",
                return_value=["一班", "二班"],
            ):
                result = service._can_access_class("一班", admin=mock_admin)

                assert result is True

    def test_can_access_class_admin_not_allowed(self, app):
        """测试班级访问权限-管理员无权限"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            with patch(
                "services.class_service.get_allowed_classes",
                return_value=["一班", "二班"],
            ):
                result = service._can_access_class("三班", admin=mock_admin)

                assert result is False

    def test_get_head_teacher_name_none(self, app):
        """测试获取班主任姓名-无ID"""
        with app.app_context():

            service = ClassService()

            result = service._get_head_teacher_name(None)

            assert result is None

    def test_get_head_teacher_name_not_found(self, app):
        """测试获取班主任姓名-未找到"""
        with app.app_context():

            service = ClassService()

            with patch("services.class_service.get_by_id", return_value=None):
                result = service._get_head_teacher_name(1)

                assert result is None

    def test_get_head_teacher_name_found(self, app):
        """测试获取班主任姓名-找到"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.real_name = "张老师"

            with patch("services.class_service.get_by_id", return_value=mock_admin):
                result = service._get_head_teacher_name(1)

                assert result == "张老师"

    def test_get_class_list(self, app):
        """测试获取班级列表"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            mock_paginate = MagicMock()
            mock_paginate.items = [mock_class]

            with patch("utils.permission.get_current_admin", return_value=mock_admin):
                with patch("services.class_service.get_allowed_classes", return_value=None):
                    with patch("services.class_service.ClassInfo.query") as mock_query:
                        mock_query.order_by.return_value.paginate.return_value = mock_paginate
                        mock_query.count.return_value = 1

                        result = service.get_class_list()

                        assert isinstance(result, dict)
                        assert "classes" in result
                        assert "pagination" in result
                        assert len(result["classes"]) == 1

    def test_get_class_list_with_keyword(self, app):
        """测试获取班级列表-带关键词"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            mock_paginate = MagicMock()
            mock_paginate.items = [mock_class]

            with patch("utils.permission.get_current_admin", return_value=mock_admin):
                with patch("services.class_service.get_allowed_classes", return_value=None):
                    with patch("services.class_service.ClassInfo.query") as mock_query:
                        mock_query.filter.return_value.order_by.return_value.paginate.return_value = (
                            mock_paginate
                        )
                        mock_query.filter.return_value.count.return_value = 1

                        result = service.get_class_list(keyword="测试")

                        assert isinstance(result, dict)
                        assert "classes" in result

    def test_create_class_existing(self, app):
        """测试创建班级-名称已存在"""
        with app.app_context():

            service = ClassService()

            mock_query = MagicMock()
            mock_query.first.return_value = MagicMock()

            with patch("services.class_service.ClassInfo.query") as mock_class_query:
                mock_class_query.filter_by.return_value = mock_query

                result, status = service.create_class({"name": "一班"})

                assert status == 400
                assert result["success"] is False
                assert "已存在" in result["message"]

    def test_create_class_success(self, app):
        """测试创建班级-成功"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.return_value = mock_class
                MockClassInfo.query.filter_by.return_value.first.return_value = None

                with patch("services.class_service.db_session_scope"):
                    with patch("services.class_service.db.session.add"):
                        with patch("services.class_service.db.session.flush"):
                            with patch.object(
                                service,
                                "_build_class_response",
                                return_value={"id": 1, "name": "一班"},
                            ):
                                result, status = service.create_class(
                                    {"name": "一班", "grade": "一年级"}
                                )

                                assert status == 201
                                assert "id" in result

    def test_create_class_with_head_teacher(self, app):
        """测试创建班级-带班主任"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = 1
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.return_value = mock_class
                MockClassInfo.query.filter_by.return_value.first.return_value = None

                with patch("services.class_service.db_session_scope"):
                    with patch("services.class_service.db.session.add"):
                        with patch("services.class_service.db.session.flush"):
                            with patch("services.class_service.AdminClass"):
                                with patch.object(
                                    service,
                                    "_build_class_response",
                                    return_value={"id": 1, "name": "一班"},
                                ):
                                    result, status = service.create_class(
                                        {
                                            "name": "一班",
                                            "grade": "一年级",
                                            "head_teacher_id": 1,
                                        }
                                    )

                                    assert status == 201

    def test_get_class_not_found(self, app):
        """测试获取班级-未找到"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            with patch(
                "services.class_service.ClassInfo.query.get_or_404",
                side_effect=Exception("Not Found"),
            ):
                with pytest.raises(Exception):
                    service.get_class(999, admin=mock_admin)

    def test_get_class_no_access(self, app):
        """测试获取班级-无权访问"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.name = "一班"

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.get_or_404.return_value = mock_class

                with patch.object(service, "_can_access_class", return_value=False):
                    result, status = service.get_class(1, admin=mock_admin)

                    assert result["success"] is False
                    assert "无权" in result["message"]
                    assert status == 403

    def test_get_class_success(self, app):
        """测试获取班级-成功"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.get_or_404.return_value = mock_class

                with patch.object(service, "_can_access_class", return_value=True):
                    with patch.object(
                        service, "_build_class_response", return_value={"id": 1, "name": "一班"}
                    ):
                        result = service.get_class(1, admin=mock_admin)

                        assert "id" in result
                        assert result["name"] == "一班"

    def test_update_class_no_access(self, app):
        """测试更新班级-无权访问"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.name = "一班"

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.get_or_404.return_value = mock_class

                with patch.object(service, "_can_access_class", return_value=False):
                    result, status = service.update_class(1, {}, admin=mock_admin)

                    assert result["success"] is False
                    assert "无权" in result["message"]
                    assert status == 403

    def test_update_class_name_exists(self, app):
        """测试更新班级-名称已存在"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.name = "一班"

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.get_or_404.return_value = mock_class
                MockClassInfo.query.filter_by.return_value.first.return_value = MagicMock()

                with patch.object(service, "_can_access_class", return_value=True):
                    result, status = service.update_class(1, {"name": "二班"}, admin=mock_admin)

                    assert status == 400
                    assert "已存在" in result["message"]

    def test_update_class_success(self, app):
        """测试更新班级-成功"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.get_or_404.return_value = mock_class
                MockClassInfo.query.filter_by.return_value.first.return_value = None

                with patch.object(service, "_can_access_class", return_value=True):
                    with patch("services.class_service.db_session_scope"):
                        with patch.object(
                            service, "_build_class_response", return_value={"grade": "二年级"}
                        ):
                            result = service.update_class(1, {"grade": "二年级"}, admin=mock_admin)

                            assert result["grade"] == "二年级"

    def test_delete_class_no_access(self, app):
        """测试删除班级-无权访问"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.name = "一班"

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.get_or_404.return_value = mock_class

                with patch.object(service, "_can_access_class", return_value=False):
                    result, status = service.delete_class(1, admin=mock_admin)

                    assert result["success"] is False
                    assert "无权" in result["message"]
                    assert status == 403

    def test_delete_class_success(self, app):
        """测试删除班级-成功"""
        with app.app_context():

            service = ClassService()

            mock_admin = MagicMock()
            mock_admin.id = 1

            mock_class = MagicMock()
            mock_class.name = "一班"

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.get_or_404.return_value = mock_class

                with patch.object(service, "_can_access_class", return_value=True):
                    with patch("services.class_service.db_session_scope"):
                        with patch("services.class_service.AdminClass.query"):
                            with patch("services.class_service.db.session.delete"):
                                result = service.delete_class(1, admin=mock_admin)

                                assert result["success"] is True
                                assert "删除成功" in result["message"]

    def test_validate_associations_no_issues(self, app):
        """测试验证关联-无问题"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.head_teacher_id = None

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.all.return_value = [mock_class]

                result = service.validate_associations()

                assert isinstance(result, dict)
                assert result["success"] is True
                assert result["issues_found"] == 0
                assert len(result["issues"]) == 0

    def test_validate_associations_missing_link(self, app):
        """测试验证关联-缺少关联记录"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.head_teacher_id = 1

            mock_admin_class_query = MagicMock()
            mock_admin_class_query.first.return_value = None

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.all.return_value = [mock_class]

                with patch("services.class_service.AdminClass.query") as mock_admin_query:
                    mock_admin_query.filter_by.return_value = mock_admin_class_query

                    result = service.validate_associations()

                    assert result["issues_found"] == 1
                    assert result["issues"][0]["type"] == "missing_link"

    def test_validate_associations_not_primary(self, app):
        """测试验证关联-is_primary未设置"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.head_teacher_id = 1

            mock_admin_link = MagicMock()
            mock_admin_link.is_primary = False
            mock_admin_link.admin_id = 1

            mock_admin_class_query = MagicMock()
            mock_admin_class_query.first.return_value = mock_admin_link

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.all.return_value = [mock_class]

                with patch("services.class_service.AdminClass.query") as mock_admin_query:
                    mock_admin_query.filter_by.return_value = mock_admin_class_query

                    result = service.validate_associations()

                    issue_types = [i["type"] for i in result["issues"]]
                    assert "not_primary" in issue_types

    def test_fix_associations_empty(self, app):
        """测试修复关联-空数据"""
        with app.app_context():

            service = ClassService()

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.all.return_value = []

                with patch("services.class_service.db_session_scope"):
                    result = service.fix_associations()

                    assert result["success"] is True
                    assert result["fixed_count"] == 0
                    assert len(result["issues_fixed"]) == 0

    def test_fix_associations_create_link(self, app):
        """测试修复关联-创建关联记录"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.head_teacher_id = 1

            mock_admin_class_query = MagicMock()
            mock_admin_class_query.first.return_value = None

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.all.return_value = [mock_class]

                with patch("services.class_service.AdminClass"):
                    with patch("services.class_service.AdminClass.query") as mock_admin_query:
                        mock_admin_query.filter_by.return_value = mock_admin_class_query

                        with patch("services.class_service.db_session_scope"):
                            with patch("services.class_service.db.session.add"):
                                result = service.fix_associations()

                                assert result["fixed_count"] >= 1
                                assert "created_link" in [
                                    i["action"] for i in result["issues_fixed"]
                                ]

    def test_fix_associations_set_primary(self, app):
        """测试修复关联-设置is_primary"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.head_teacher_id = 1

            mock_admin_link = MagicMock()
            mock_admin_link.is_primary = False

            mock_admin_class_query = MagicMock()
            mock_admin_class_query.first.return_value = mock_admin_link

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.all.return_value = [mock_class]

                with patch("services.class_service.AdminClass.query") as mock_admin_query:
                    mock_admin_query.filter_by.return_value = mock_admin_class_query

                    with patch("services.class_service.db_session_scope"):
                        result = service.fix_associations()

                        assert result["fixed_count"] >= 1
                        assert "set_primary" in [i["action"] for i in result["issues_fixed"]]

    def test_fix_associations_sync_head_teacher(self, app):
        """测试修复关联-同步班主任"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.head_teacher_id = 2

            mock_admin_link = MagicMock()
            mock_admin_link.is_primary = True
            mock_admin_link.admin_id = 1

            mock_admin_class_query = MagicMock()
            mock_admin_class_query.first.return_value = mock_admin_link

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.all.return_value = [mock_class]

                with patch("services.class_service.AdminClass.query") as mock_admin_query:
                    mock_admin_query.filter_by.return_value = mock_admin_class_query

                    with patch("services.class_service.db_session_scope"):
                        result = service.fix_associations()

                        assert result["fixed_count"] >= 1
                        assert "sync_head_teacher" in [i["action"] for i in result["issues_fixed"]]

    def test_export_classes_json(self, app):
        """测试导出班级-JSON格式"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.order_by.return_value.all.return_value = [mock_class]

                with patch.object(service, "_get_head_teacher_name", return_value=None):
                    with patch.object(service, "_get_student_count", return_value=0):
                        result = service.export_classes()

                        assert result["type"] == "json"
                        assert "filename" in result
                        assert result["filename"].endswith(".json")

    def test_export_classes_excel(self, app):
        """测试导出班级-Excel格式"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.order_by.return_value.all.return_value = [mock_class]

                with patch.object(service, "_get_head_teacher_name", return_value=None):
                    with patch.object(service, "_get_student_count", return_value=0):
                        result = service.export_classes(export_format="excel")

                        assert result["type"] == "excel"
                        assert "filename" in result
                        assert result["filename"].endswith(".xlsx")

    def test_export_classes_with_keyword(self, app):
        """测试导出班级-带关键词"""
        with app.app_context():

            service = ClassService()

            mock_class = MagicMock()
            mock_class.id = 1
            mock_class.name = "一班"
            mock_class.grade = "一年级"
            mock_class.description = "测试班级"
            mock_class.head_teacher_id = None
            mock_class.is_active = True
            mock_class.created_at = datetime.now()
            mock_class.updated_at = datetime.now()

            with patch("services.class_service.ClassInfo.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = [mock_class]

                with patch.object(service, "_get_head_teacher_name", return_value=None):
                    with patch.object(service, "_get_student_count", return_value=0):
                        result = service.export_classes(keyword="测试")

                        assert result["type"] == "json"

    def test_import_classes_create(self, app):
        """测试导入班级-创建新班级"""
        with app.app_context():

            service = ClassService()

            import_list = [{"name": "一班", "grade": "一年级"}]

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.filter_by.return_value.first.return_value = None

                with patch("services.class_service.db_session_scope"):
                    with patch("services.class_service.db.session.add"):
                        with patch("services.class_service.db.session.flush"):
                            result = service.import_classes(import_list)

                            assert result["success_count"] >= 1
                            assert "created" in [m["action"] for m in result["messages"]]

    def test_import_classes_update(self, app):
        """测试导入班级-更新现有班级"""
        with app.app_context():

            service = ClassService()

            import_list = [{"name": "一班", "grade": "二年级"}]

            mock_existing = MagicMock()
            mock_existing.id = 1
            mock_existing.name = "一班"
            mock_existing.grade = "一年级"

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.filter_by.return_value.first.return_value = mock_existing

                with patch("services.class_service.db_session_scope"):
                    result = service.import_classes(import_list)

                    assert result["success_count"] >= 1
                    assert "updated" in [m["action"] for m in result["messages"]]

    def test_import_classes_skip(self, app):
        """测试导入班级-跳过已存在"""
        with app.app_context():

            service = ClassService()

            import_list = [{"name": "一班", "grade": "一年级"}]

            mock_existing = MagicMock()
            mock_existing.id = 1

            with patch("services.class_service.ClassInfo") as MockClassInfo:
                MockClassInfo.query.filter_by.return_value.first.return_value = mock_existing

                with patch("services.class_service.db_session_scope"):
                    result = service.import_classes(
                        import_list, MagicMock(conflict_strategy="skip")
                    )

                    assert "skipped" in [m["action"] for m in result["messages"]]

    def test_import_classes_validation_failure(self, app):
        """测试导入班级-验证失败"""
        with app.app_context():

            service = ClassService()

            import_list = [{"name": None}]

            mock_config = MagicMock()
            mock_config.field_mappings = [
                {"source_field": "班级名称", "target_field": "name", "required": True}
            ]
            mock_config.validation_rules = [
                {"field": "name", "rule_type": "required", "message": "班级名称必填"}
            ]
            mock_config.conflict_strategy = "update"

            with patch("services.class_service.db_session_scope"):
                result = service.import_classes(import_list, mock_config)

                assert result["failed_count"] >= 1
                messages = [m["message"] for m in result["messages"]]
                assert any("验证失败" in msg for msg in messages)

    def test_import_classes_resolve_head_teacher(self, app):
        """测试导入班级-解析班主任"""
        with app.app_context():

            service = ClassService()

            import_list = [{"name": "一班", "head_teacher_name": "张老师"}]

            mock_admin = MagicMock()
            mock_admin.id = 1
            mock_admin.real_name = "张老师"
            mock_admin.role = "teacher"

            with (
                patch("services.class_service.ClassInfo") as MockClassInfo,
                patch("services.class_service.Admin.query") as mock_admin_query,
                patch("services.class_service.db_session_scope"),
            ):

                MockClassInfo.query.filter_by.return_value.first.return_value = None
                mock_admin_query.filter.return_value.first.return_value = mock_admin

                with (
                    patch("services.class_service.db.session.add"),
                    patch("services.class_service.db.session.flush"),
                ):

                    result = service.import_classes(import_list)

                    assert result["success_count"] >= 1
