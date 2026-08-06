"""
权限服务单元测试

适配当前 utils.permission 的实现：has_permission / get_admin_permissions 均基于
数据库 RBAC 表（AdminRole / RolePermissionMapping / RoleHierarchy）查询，
不再依赖 admin.role 字段或静态 PERMISSIONS 字典的角色推导。
"""
import pytest
from utils.permission import (
    has_permission,
    get_admin_permissions,
    PERMISSIONS,
    ROLES,
)


@pytest.fixture
def bind_rbac(sample_admin, db_session):
    """为 sample_admin 绑定角色与权限集合（重置同名角色映射，避免跨用例污染）。"""
    from models import AdminRole, RolePermissionMapping

    def _bind(role_code, perms):
        RolePermissionMapping.query.filter_by(role_code=role_code).delete()
        AdminRole.query.filter_by(admin_id=sample_admin.id).delete()
        db_session.commit()
        for p in perms:
            db_session.add(RolePermissionMapping(role_code=role_code, permission_code=p))
        db_session.add(AdminRole(admin_id=sample_admin.id, role_code=role_code))
        db_session.commit()

    return _bind


class TestPermissionService:
    """权限服务测试类（基于数据库 RBAC 表）"""

    def test_has_permission_admin_role(self, sample_admin, app_context, bind_rbac):
        """管理员拥有 all 权限。"""
        bind_rbac("admin", ["all"])
        assert has_permission(sample_admin, "any_permission")
        assert has_permission(sample_admin, "system.logs")

    def test_has_permission_super_admin_role(self, sample_admin, app_context, bind_rbac):
        """超级管理员拥有 all 权限。"""
        bind_rbac("super_admin", ["all"])
        assert has_permission(sample_admin, "any_permission")

    def test_has_permission_teacher_role_allowed(self, sample_admin, app_context, bind_rbac):
        """教师角色拥有允许的权限。"""
        bind_rbac("teacher", ["student.view", "score.view"])
        assert has_permission(sample_admin, "student.view")
        assert has_permission(sample_admin, "score.view")

    def test_has_permission_teacher_role_denied(self, sample_admin, app_context, bind_rbac):
        """教师角色无 system.logs 权限。"""
        bind_rbac("teacher", ["student.view", "score.view"])
        assert not has_permission(sample_admin, "system.logs")

    def test_has_permission_viewer_role_allowed(self, sample_admin, app_context, bind_rbac):
        """查看者角色拥有允许的权限。"""
        bind_rbac("viewer", ["student.view", "device.view"])
        assert has_permission(sample_admin, "student.view")
        assert has_permission(sample_admin, "device.view")

    def test_has_permission_viewer_role_denied(self, sample_admin, app_context, bind_rbac):
        """查看者角色无 student.edit 权限。"""
        bind_rbac("viewer", ["student.view"])
        assert not has_permission(sample_admin, "student.edit")

    def test_has_permission_operator_role(self, sample_admin, app_context, bind_rbac):
        """运维角色权限（角色码可自定义，不依赖静态字典）。"""
        bind_rbac("operator", ["device.view", "system.logs"])
        assert has_permission(sample_admin, "device.view")
        assert has_permission(sample_admin, "system.logs")

    def test_has_permission_null_admin(self):
        """空管理员对象。"""
        assert not has_permission(None, "student.view")

    def test_get_admin_permissions_admin(self, sample_admin, app_context, bind_rbac):
        bind_rbac("admin", ["all"])
        permissions = get_admin_permissions(sample_admin)
        assert "all" in permissions

    def test_get_admin_permissions_teacher(self, sample_admin, app_context, bind_rbac):
        bind_rbac("teacher", ["student.view", "score.view", "device.view"])
        permissions = get_admin_permissions(sample_admin)
        assert "student.view" in permissions
        assert "score.view" in permissions
        assert "device.view" in permissions

    def test_get_admin_permissions_viewer(self, sample_admin, app_context, bind_rbac):
        bind_rbac("viewer", ["student.view", "device.view"])
        permissions = get_admin_permissions(sample_admin)
        assert "student.view" in permissions
        assert "device.view" in permissions

    def test_permission_constants_defined(self):
        """权限常量定义（仅校验当前字典实际存在的键）。"""
        assert "admin" in PERMISSIONS
        assert "teacher" in PERMISSIONS
        assert "viewer" in PERMISSIONS
        assert "view_users" in PERMISSIONS["teacher"]

    def test_role_constants_defined(self):
        """角色常量定义（仅校验当前字典实际存在的键）。"""
        assert "admin" in ROLES
        assert "super_admin" in ROLES
        assert "teacher" in ROLES
        assert "viewer" in ROLES

    def test_role_display_names(self):
        """角色显示名称（对齐当前 ROLES 字典）。"""
        assert ROLES["admin"] == "超级管理员"
        assert ROLES["teacher"] == "教师"
        assert ROLES["viewer"] == "查看员"


class TestPermissionInheritance:
    """权限继承测试（基于数据库角色继承层级）"""

    def test_permission_inheritance_from_static(
        self, sample_admin, app_context, db_session, bind_rbac
    ):
        """头班主任继承教师角色权限 + 自身直接权限。"""
        from models import RoleHierarchy

        bind_rbac("teacher", ["student.view"])
        bind_rbac("head_teacher", ["publish_exams"])
        db_session.add(RoleHierarchy(parent_role_code="teacher", child_role_code="head_teacher"))
        db_session.commit()

        assert has_permission(sample_admin, "student.view")
        assert has_permission(sample_admin, "publish_exams")


class TestRoleBasedAccess:
    """基于角色的访问控制测试"""

    def test_dashboard_role_permissions(self, sample_admin, app_context, bind_rbac):
        """大屏管理员角色权限。"""
        bind_rbac("dashboard", ["device.view"])
        assert has_permission(sample_admin, "device.view")
        assert not has_permission(sample_admin, "student.edit")

    def test_subject_teacher_permissions(self, sample_admin, app_context, bind_rbac):
        """任课教师角色权限（自定义角色码）。"""
        bind_rbac("subject_teacher", ["student.view"])
        assert has_permission(sample_admin, "student.view")


class TestPermissionEdgeCases:
    """权限边界情况测试"""

    def test_permission_with_unknown_role(self, sample_admin, app_context, bind_rbac):
        """未知角色（无权限映射）。"""
        bind_rbac("unknown_role", [])
        assert not has_permission(sample_admin, "student.view")

    def test_permission_with_empty_role(self, sample_admin, app_context, bind_rbac):
        """空角色（无权限映射）。"""
        bind_rbac("", [])
        assert not has_permission(sample_admin, "student.view")

    def test_permission_with_special_permission(self, sample_admin, app_context, bind_rbac):
        """all 不是普通权限标识，未授予 all 时查询 'all' 应返回 False。"""
        bind_rbac("teacher", ["student.view", "score.view"])
        assert not has_permission(sample_admin, "all")
