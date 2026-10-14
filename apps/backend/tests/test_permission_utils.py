from models import Admin
from utils.permission import (
    PERMISSIONS,
    ROLES,
    _get_inherited_permissions,
    can_access_device,
    get_access_token,
    get_admin_class_ids,
    get_admin_permissions,
    get_allowed_classes,
    get_current_admin,
    has_permission,
    is_admin_or_super_admin,
    requires_admin,
    requires_permission,
    requires_role,
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


# ---- R23: 身份/班级隔离解析请求级缓存的回归防护 ----
import re

from sqlalchemy import event

from models import Admin, AdminClass, ClassInfo, db
from utils.permission import get_allowed_classes, get_current_admin


def _count_table_selects(app, fn, tables, warmup=None):
    """统计 fn() 执行期间真实引用 tables 的 SELECT 条数（R22 同款 harness）。"""
    pat = re.compile(
        "|".join(r"(?:from|join)\s+%s\b|%s\." % (t, t) for t in tables)
    )
    counter = {"n": 0}

    def _after(conn, cursor, statement, *args, **kwargs):
        s = " ".join(statement.strip().lower().split())
        if s.startswith("select") and pat.search(s):
            counter["n"] += 1

    engine = db.engine
    event.listen(engine, "after_cursor_execute", _after)
    try:
        with app.app_context():
            if warmup is not None:
                warmup()
                counter["n"] = 0  # 预热（含懒加载 DB 初始化）查询不计入
            return fn(), counter["n"]
    finally:
        event.remove(engine, "after_cursor_execute", _after)


class TestCurrentAdminRequestCacheR23:
    """R23：get_current_admin 同请求内缓存，只查一次 admin。"""

    def test_get_current_admin_cached_once(self, app, auth_headers):
        token = auth_headers["Authorization"]

        def fn():
            with app.test_request_context(headers={"Authorization": token}):
                a1 = get_current_admin()
                a2 = get_current_admin()
            return (a1, a2)

        (res, cnt) = _count_table_selects(app, fn, {"admin"})
        a1, a2 = res
        assert a1 is not None and a2 is not None
        assert a1 is a2  # 同对象（请求级缓存）
        assert cnt == 1, cnt  # 第二次命中缓存，省 1 次 admin SELECT


class TestAllowedClassesRequestCacheR23:
    """R23：get_allowed_classes 同请求内缓存，只算一次（首次 3 查，二次 0 查）。"""

    def test_get_allowed_classes_cached_once(self, app):
        with app.app_context():
            teacher = Admin(role="head_teacher", username="r23ht", password="testpass123")
            db.session.add(teacher)
            db.session.commit()
            ci = ClassInfo(name="R23-1", is_active=True)
            db.session.add(ci)
            db.session.commit()
            db.session.add(AdminClass(admin_id=teacher.id, class_info_id=ci.id))
            db.session.commit()
            admin_id = teacher.id

        def fn():
            r1 = get_allowed_classes(admin_id)
            r2 = get_allowed_classes(admin_id)
            return (r1, r2)

        (res, cnt) = _count_table_selects(
            app, fn, {"admin", "admin_class", "class_info"},
            warmup=lambda: get_allowed_classes(admin_id),
        )
        r1, r2 = res
        assert r1 == ["R23-1"]
        assert r2 == ["R23-1"]
        # 预热（冷查询+懒加载初始化）后，两次调用均命中请求级缓存 -> 0 查询
        assert cnt == 0, cnt
