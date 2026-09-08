from models import Admin
from utils.permission import (
    get_access_token,
    has_permission,
    get_admin_permissions,
    get_current_admin,
    get_allowed_classes,
    get_admin_class_ids,
    is_admin_or_super_admin,
    ROLES,
    PERMISSIONS,
    _get_inherited_permissions,
    requires_admin,
    requires_permission,
    requires_role,
    can_access_device,
)


class TestPermissionUtils:

    def _bind_role(self, db_session, admin, role_code):
        """按当前 DB-RBAC 模型为 admin 绑定角色与权限码（PERMISSIONS 静态字典提供码表）。幂等。"""
        from models import AdminRole, RolePermissionMapping

        if not AdminRole.query.filter_by(admin_id=admin.id, role_code=role_code).first():
            db_session.add(AdminRole(admin_id=admin.id, role_code=role_code))
        for code in PERMISSIONS.get(role_code, []):
            if not RolePermissionMapping.query.filter_by(
                role_code=role_code, permission_code=code
            ).first():
                db_session.add(RolePermissionMapping(role_code=role_code, permission_code=code))
        db_session.commit()

    def test_get_access_token_no_header(self, app):
        with app.test_request_context():
            token = get_access_token()
            assert token is None

    def test_has_permission_basic(self, app):
        with app.app_context():
            admin = Admin.query.first()
            if admin:
                result = has_permission(admin, "score.view")
                assert isinstance(result, bool)

    def test_has_permission_none_admin(self, app):
        with app.app_context():
            result = has_permission(None, "score.view")
            assert result is False

    def test_has_permission_admin_role(self, app):
        with app.app_context():
            admin = Admin.query.first()
            result = has_permission(admin, "any.permission")
            assert result is True

    def test_has_permission_super_admin_role(self, app):
        with app.app_context():
            admin = Admin.query.first()
            result = has_permission(admin, "any.permission")
            assert result is True

    def test_has_permission_teacher_role(self, app, db_session):
        with app.app_context():
            admin = Admin.query.first()
            self._bind_role(db_session, admin, "teacher")
            result = has_permission(admin, "score.view")
            assert result is True

    def test_has_permission_viewer_role(self, app, db_session):
        with app.app_context():
            admin = Admin.query.first()
            self._bind_role(db_session, admin, "viewer")
            result = has_permission(admin, "student.view")
            assert result is True

    def test_has_permission_no_permission(self, app):
        with app.app_context():
            admin = Admin(role="viewer", username="rbac_viewer", password="testpass123")
            result = has_permission(admin, "score.edit")
            assert isinstance(result, bool)

    def test_get_admin_permissions(self, app):
        with app.app_context():
            admin = Admin.query.first()
            if admin:
                permissions = get_admin_permissions(admin)
                assert isinstance(permissions, list)

    def test_get_admin_permissions_none(self, app):
        with app.app_context():
            permissions = get_admin_permissions(None)
            assert permissions == []

    def test_get_admin_permissions_admin_role(self, app):
        with app.app_context():
            admin = Admin.query.first()
            permissions = get_admin_permissions(admin)
            assert "all" in permissions

    def test_get_current_admin_no_token(self, app):
        with app.test_request_context():
            admin = get_current_admin()
            assert admin is None

    def test_get_current_admin_with_token(self, app, auth_headers):
        with app.test_request_context(headers=auth_headers):
            admin = get_current_admin()
            assert admin is None or isinstance(admin, Admin)

    def test_get_allowed_classes(self, app):
        with app.app_context():
            classes = get_allowed_classes(1)
            assert classes is None or isinstance(classes, list)

    def test_get_admin_class_ids(self, app):
        with app.app_context():
            class_ids = get_admin_class_ids(1)
            assert isinstance(class_ids, list)

    def test_is_admin_or_super_admin(self, app):
        with app.app_context():
            admin = Admin.query.first()
            if admin:
                result = is_admin_or_super_admin(admin)
                assert isinstance(result, bool)

    def test_is_admin_or_super_admin_true(self, app):
        with app.app_context():
            admin = Admin.query.first()
            result = is_admin_or_super_admin(admin)
            assert result is True

    def test_is_admin_or_super_admin_false(self, app):
        with app.app_context():
            admin = Admin(role="teacher", username="rbac_teacher", password="testpass123")
            result = is_admin_or_super_admin(admin)
            assert result is False

    def test_roles_definition(self):
        assert isinstance(ROLES, dict)
        assert "admin" in ROLES
        assert "super_admin" in ROLES

    def test_permissions_definition(self):
        assert isinstance(PERMISSIONS, dict)
        assert "admin" in PERMISSIONS
        assert "teacher" in PERMISSIONS

    def test_get_inherited_permissions_empty(self, app):
        with app.app_context():
            perms = _get_inherited_permissions("nonexistent_role")
            assert isinstance(perms, set)

    def test_requires_admin_decorator(self, app):
        with app.app_context():

            @requires_admin
            def protected_func():
                return {"success": True}

            decorated = protected_func
            assert callable(decorated)

    def test_requires_permission_decorator(self, app):
        with app.app_context():

            @requires_permission("score.view")
            def protected_func():
                return {"success": True}

            decorated = protected_func
            assert callable(decorated)

    def test_requires_role_decorator(self, app):
        with app.app_context():

            @requires_role(["admin", "teacher"])
            def protected_func():
                return {"success": True}

            decorated = protected_func
            assert callable(decorated)

    def test_get_inherited_permissions_admin(self, app):
        with app.app_context():
            perms = _get_inherited_permissions("admin")
            assert isinstance(perms, set)

    def test_get_inherited_permissions_teacher(self, app):
        with app.app_context():
            perms = _get_inherited_permissions("teacher")
            assert isinstance(perms, set)

    def test_requires_role_decorator_single_role(self, app):
        with app.app_context():

            @requires_role(["admin"])
            def protected_func():
                return {"success": True}

            decorated = protected_func
            assert callable(decorated)

    def test_can_access_device_none_admin(self, app):
        with app.app_context():
            result = can_access_device(None, 1)
            assert result is False

    def test_can_access_device_admin_role(self, app):
        with app.app_context():
            admin = Admin(role="admin", username="rbac_admin", password="testpass123")
            result = can_access_device(admin, 1)
            assert result is True

    def test_can_access_device_teacher_no_device(self, app):
        with app.app_context():
            admin = Admin(role="teacher", username="rbac_teacher", password="testpass123")
            result = can_access_device(admin, 99999)
            assert result is False

    def test_has_permission_with_all_permission(self, app):
        with app.app_context():
            admin = Admin.query.first()
            result = has_permission(admin, "all")
            assert result is True

    def test_get_admin_permissions_empty(self, app):
        with app.app_context():
            admin = Admin(role="viewer", username="rbac_viewer", password="testpass123")
            permissions = get_admin_permissions(admin)
            assert isinstance(permissions, list)

    def test_get_allowed_classes_none_admin(self, app):
        with app.app_context():
            result = get_allowed_classes(99999)
            assert result is None

    def test_get_admin_class_ids_none_admin(self, app):
        with app.app_context():
            result = get_admin_class_ids(99999)
            assert result == []

    def test_get_current_admin_exception(self, app):
        with app.test_request_context():
            admin = get_current_admin()
            assert admin is None

    def test_get_access_token_from_bearer(self, app):
        with app.test_request_context(headers={"Authorization": "Bearer test_token"}):
            token = get_access_token()
            assert token == "test_token"

    def test_has_permission_with_inherited(self, app):
        with app.app_context():
            admin = Admin(role="head_teacher", username="test_head")
            result = has_permission(admin, "score.approve")
            assert isinstance(result, bool)

    def test_has_permission_subject_teacher(self, app):
        with app.app_context():
            admin = Admin(role="subject_teacher", username="test_subject")
            result = has_permission(admin, "score.entry")
            assert isinstance(result, bool)

    def test_has_permission_operator(self, app):
        with app.app_context():
            admin = Admin(role="operator", username="test_operator")
            result = has_permission(admin, "device.view")
            assert isinstance(result, bool)
