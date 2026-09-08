try:
    from utils.permission import ROLES
except ImportError:
    pass

try:
    from utils.permission import PERMISSIONS
except ImportError:
    pass

try:
    from utils.permission import has_permission
except ImportError:
    pass


class TestPermissionDefinitions:

    def test_roles_definition(self, app):
        with app.app_context():
            from utils.permission import ROLES

            assert "super_admin" in ROLES
            assert "admin" in ROLES
            assert "teacher" in ROLES
            assert "head_teacher" in ROLES
            assert "dashboard" in ROLES
            assert "viewer" in ROLES

            assert ROLES["super_admin"] == "超级管理员"
            assert ROLES["admin"] == "超级管理员"
            assert ROLES["teacher"] == "教师"

    def test_permissions_definition(self, app):
        with app.app_context():
            from utils.permission import PERMISSIONS

            assert "admin" in PERMISSIONS
            assert "super_admin" in PERMISSIONS
            assert "teacher" in PERMISSIONS
            assert "head_teacher" in PERMISSIONS

            assert "all" in PERMISSIONS["admin"]
            assert "all" in PERMISSIONS["super_admin"]

            teacher_perms = PERMISSIONS["teacher"]
            assert "view_users" in teacher_perms
            assert "view_records" in teacher_perms
            assert "manage_scores" in teacher_perms
            assert "edit_scores" in teacher_perms

    def test_permissions_structure(self, app):
        with app.app_context():
            for role, perms in PERMISSIONS.items():
                assert isinstance(perms, list)
                for perm in perms:
                    assert isinstance(perm, str)

    def test_has_permission_super_admin(self, app):
        with app.app_context():
            from utils.permission import has_permission

            class MockAdmin:
                def __init__(self, role):
                    self.role = role
                    self.id = 99991

            admin = MockAdmin("super_admin")
            assert has_permission(admin, "any_permission") is True
            assert has_permission(admin, "student.view") is True
            assert has_permission(admin, "score.edit") is True

    def test_has_permission_admin(self, app):
        with app.app_context():
            from utils.permission import has_permission

            class MockAdmin:
                def __init__(self, role):
                    self.role = role
                    self.id = 99992

            admin = MockAdmin("admin")
            assert has_permission(admin, "any_permission") is True
            assert has_permission(admin, "notification.send") is True

    def test_has_permission_teacher(self, app):
        with app.app_context():
            from utils.permission import has_permission

            class MockAdmin:
                def __init__(self, role):
                    self.role = role
                    self.id = 99993

            teacher = MockAdmin("teacher")
            assert has_permission(teacher, "view_users") is True
            assert has_permission(teacher, "manage_scores") is True
            assert has_permission(teacher, "manage_system") is False

    def test_has_permission_none_admin(self, app):
        with app.app_context():
            assert has_permission(None, "any_permission") is False

    def test_has_permission_viewer(self, app):
        with app.app_context():
            from utils.permission import has_permission

            class MockAdmin:
                def __init__(self, role):
                    self.role = role
                    self.id = 99994

            viewer = MockAdmin("viewer")
            viewer_perms = ["view_users", "view_dashboard", "view_records", "view_exams"]
            for perm in viewer_perms:
                assert has_permission(viewer, perm) is True
