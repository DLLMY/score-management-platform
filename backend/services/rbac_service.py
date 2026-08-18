"""RBAC 权限系统写入/事务路径薄封装（F17 防腐层：从 api/users/rbac_routes 收口）。

逐字节复刻原路由内联落库行为；路由保留 first_or_404 / 请求校验 / 409 冲突检查 /
响应构造。log_permission_action / init_default_permissions（scripts/fix_permissions_catalog 导入）
/ init_default_roles 由路由保留同名委托函数以维持导入契约。
只读助手（get_inherited_permissions / check_admin_permission）留在路由。
"""

from datetime import datetime

from models import (
    db,
    AdminRole,
    Permission,
    PermissionLog,
    RolePermission,
    RolePermissionMapping,
    RoleHierarchy,
)


def log_rbac_permission_action(
    action, target_type, target_id=None, description=None, operator_id=None, ip_address=None
):
    """复刻 log_permission_action 内联 PermissionLog 建模 + add + commit（失败回滚防脏 session）。"""
    try:
        log = PermissionLog(
            operator_id=operator_id,
            operator_type="admin",
            action=action,
            target_type=target_type,
            target_id=target_id,
            description=description,
            ip_address=ip_address,
            created_at=datetime.now(),
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()  # 失败回滚，防脏 session 污染后续请求
        pass


def create_permission(data):
    """复刻 PermissionList.post 内联建模 + add + commit。返回 permission 实例。"""
    permission = Permission(
        code=data["code"],
        name=data["name"],
        description=data.get("description", ""),
        category=data.get("category", "general"),
        is_active=data.get("is_active", True),
    )
    db.session.add(permission)
    db.session.commit()
    return permission


def update_permission(permission, data):
    """复刻 PermissionResource.put 内联条件字段赋值 + commit。"""
    if "name" in data:
        permission.name = data["name"]
    if "description" in data:
        permission.description = data["description"]
    if "category" in data:
        permission.category = data["category"]
    if "is_active" in data:
        permission.is_active = data["is_active"]
    permission.updated_at = datetime.now()
    db.session.commit()


def delete_permission(permission):
    """复刻 PermissionResource.delete 内联 delete + commit。"""
    db.session.delete(permission)
    db.session.commit()


def create_role(data):
    """复刻 RoleList.post 内联角色 + 权限映射 + 层级映射 + commit。返回 role 实例。"""
    role = RolePermission(
        role_code=data["role_code"],
        role_name=data.get("role_name", data["role_code"]),
        description=data.get("description", ""),
        is_active=data.get("is_active", True),
    )
    db.session.add(role)
    # 添加权限关联
    for perm_code in data.get("permissions", []):
        mapping = RolePermissionMapping(role_code=data["role_code"], permission_code=perm_code)
        db.session.add(mapping)
    # 添加父角色关联
    for parent_code in data.get("parent_roles", []):
        hierarchy = RoleHierarchy(parent_role_code=parent_code, child_role_code=data["role_code"])
        db.session.add(hierarchy)
    db.session.commit()
    return role


def update_role(rp, data):
    """复刻 RoleResource.put 内联条件字段赋值 + 权限/父角色覆盖同步 + commit。"""
    if "role_name" in data:
        rp.role_name = data["role_name"]
    if "description" in data:
        rp.description = data["description"]
    if "is_active" in data:
        rp.is_active = data["is_active"]
    # 更新权限列表
    if "permissions" in data:
        # 删除旧权限
        RolePermissionMapping.query.filter_by(role_code=rp.role_code).delete()
        # 添加新权限
        for perm_code in data["permissions"]:
            mapping = RolePermissionMapping(role_code=rp.role_code, permission_code=perm_code)
            db.session.add(mapping)
    # 更新父角色列表
    if "parent_roles" in data:
        # 删除旧父角色
        RoleHierarchy.query.filter_by(child_role_code=rp.role_code).delete()
        # 添加新父角色
        for parent_code in data["parent_roles"]:
            hierarchy = RoleHierarchy(parent_role_code=parent_code, child_role_code=rp.role_code)
            db.session.add(hierarchy)
    rp.updated_at = datetime.now()
    db.session.commit()
    return rp


def delete_role(rp):
    """复刻 RoleResource.delete 内联删除映射/层级 + delete 角色 + commit。"""
    # 删除角色权限关联
    RolePermissionMapping.query.filter_by(role_code=rp.role_code).delete()
    # 删除角色层级关联（作为子角色）
    RoleHierarchy.query.filter_by(child_role_code=rp.role_code).delete()
    # 删除角色
    db.session.delete(rp)
    db.session.commit()


def assign_admin_roles(admin_id, role_codes):
    """复刻 AdminRoleList.put 内联覆盖式角色分配（删除旧关联 + 添加有效新关联）+ commit。"""
    # 删除旧的角色关联
    AdminRole.query.filter_by(admin_id=admin_id).delete()
    # 添加新的角色关联
    for role_code in role_codes:
        # 检查角色是否存在
        rp = RolePermission.query.filter_by(role_code=role_code).first()
        if not rp:
            continue
        admin_role = AdminRole(admin_id=admin_id, role_code=role_code)
        db.session.add(admin_role)
    db.session.commit()


def add_admin_role(admin_id, role_code):
    """复刻 AdminRoleResource.post 内联 add + commit。"""
    admin_role = AdminRole(admin_id=admin_id, role_code=role_code)
    db.session.add(admin_role)
    db.session.commit()


def remove_admin_role(admin_role):
    """复刻 AdminRoleResource.delete 内联 delete + commit。"""
    db.session.delete(admin_role)
    db.session.commit()


def set_role_permissions(rp, permissions):
    """复刻 RolePermissionList.put 内联覆盖式权限设置 + commit。"""
    # 删除旧权限
    RolePermissionMapping.query.filter_by(role_code=rp.role_code).delete()
    # 添加新权限
    for perm_code in permissions:
        mapping = RolePermissionMapping(role_code=rp.role_code, permission_code=perm_code)
        db.session.add(mapping)
    rp.updated_at = datetime.now()
    db.session.commit()


def add_role_permission(role_code, permission_code):
    """复刻 RolePermissionResource.post 内联 add + commit。"""
    mapping = RolePermissionMapping(role_code=role_code, permission_code=permission_code)
    db.session.add(mapping)
    db.session.commit()


def remove_role_permission(mapping):
    """复刻 RolePermissionResource.delete 内联 delete + commit。"""
    db.session.delete(mapping)
    db.session.commit()


def init_default_permissions():
    """初始化默认权限数据（逐字节复刻原路由函数，供启动链/脚本调用）。"""
    default_permissions = [
        # 系统管理
        {"code": "system.settings", "name": "系统设置", "category": "system"},
        {"code": "system.users", "name": "用户管理", "category": "system"},
        {"code": "system.roles", "name": "角色管理", "category": "system"},
        {"code": "system.logs", "name": "日志查看", "category": "system"},
        {"code": "system.backup", "name": "备份恢复", "category": "system"},
        {"code": "system.cache", "name": "缓存管理", "category": "system"},
        {"code": "system.monitor", "name": "系统监控", "category": "system"},
        # 设备管理
        {"code": "device.view", "name": "查看设备", "category": "device"},
        {"code": "device.create", "name": "创建设备", "category": "device"},
        {"code": "device.edit", "name": "编辑设备", "category": "device"},
        {"code": "device.delete", "name": "删除设备", "category": "device"},
        {"code": "device.groups", "name": "设备分组管理", "category": "device"},
        # 学生管理
        {"code": "student.view", "name": "查看学生", "category": "academic"},
        {"code": "student.create", "name": "添加学生", "category": "academic"},
        {"code": "student.edit", "name": "编辑学生", "category": "academic"},
        {"code": "student.delete", "name": "删除学生", "category": "academic"},
        # 成绩管理
        {"code": "score.view", "name": "查看成绩", "category": "academic"},
        {"code": "score.entry", "name": "录入成绩", "category": "academic"},
        {"code": "score.edit", "name": "修改成绩", "category": "academic"},
        {"code": "score.delete", "name": "删除成绩", "category": "academic"},
        {"code": "score.approve", "name": "审批成绩", "category": "academic"},
        # 班级管理
        {"code": "class.view", "name": "查看班级", "category": "academic"},
        {"code": "class.manage", "name": "管理班级", "category": "academic"},
        # 班主任工作台（座次/值日/班委/家长联系 共用 class.edit 把关写操作）
        {"code": "class.edit", "name": "编辑班级事务(座次/值日/班委/家长联系)", "category": "班主任工作台"},
        {"code": "homework.view", "name": "查看作业", "category": "班主任工作台"},
        {"code": "homework.edit", "name": "布置作业", "category": "班主任工作台"},
        {"code": "homework.check", "name": "检查作业", "category": "班主任工作台"},
        {"code": "attendance.view", "name": "查看考勤", "category": "班主任工作台"},
        {"code": "attendance.edit", "name": "登记考勤", "category": "班主任工作台"},
        {"code": "attendance.approve", "name": "审批请假", "category": "班主任工作台"},
        {"code": "study_group.view", "name": "查看学习小组", "category": "班主任工作台"},
        {"code": "study_group.edit", "name": "管理学习小组", "category": "班主任工作台"},
        {"code": "mental_health.view", "name": "查看心理健康", "category": "班主任工作台"},
        {"code": "mental_health.edit", "name": "记录心理健康", "category": "班主任工作台"},
        {"code": "activity.view", "name": "查看文体活动", "category": "班主任工作台"},
        {"code": "activity.edit", "name": "管理文体活动", "category": "班主任工作台"},
        {"code": "culture.view", "name": "查看班级文化", "category": "班主任工作台"},
        {"code": "culture.edit", "name": "编辑班级文化", "category": "班主任工作台"},
        {"code": "study_guide.view", "name": "查看学法指导", "category": "班主任工作台"},
        {"code": "study_guide.edit", "name": "管理学法指导", "category": "班主任工作台"},
        # 考试管理
        {"code": "exam.view", "name": "查看考试", "category": "academic"},
        {"code": "exam.manage", "name": "管理考试", "category": "academic"},
        # 评分规则
        {"code": "rule.view", "name": "查看规则", "category": "academic"},
        {"code": "rule.manage", "name": "管理规则", "category": "academic"},
        # 时段管理
        {"code": "period.view", "name": "查看时段", "category": "academic"},
        {"code": "period.manage", "name": "管理时段", "category": "academic"},
        # 课表管理
        {"code": "schedule.view", "name": "查看课表", "category": "academic"},
        {"code": "schedule.manage", "name": "管理课表", "category": "academic"},
        # 科目管理
        {"code": "subject.view", "name": "查看科目", "category": "academic"},
        {"code": "subject.manage", "name": "管理科目", "category": "academic"},
        # 通知管理
        {"code": "notification.view", "name": "查看通知", "category": "communication"},
        {"code": "notification.send", "name": "发送通知", "category": "communication"},
        {"code": "notification.force_send", "name": "强制发送通知", "category": "communication"},
        {"code": "timetable.rule.manage", "name": "管理时间规则", "category": "academic"},
        {"code": "phonebox.unlock.manage", "name": "管理本班手机箱开箱策略", "category": "device"},
        # 数据分析
        {"code": "algorithm.view", "name": "查看分析", "category": "analysis"},
        {"code": "algorithm.manage", "name": "管理分析", "category": "analysis"},
        # 报表管理
        {"code": "report.export", "name": "导出报表", "category": "data"},
        {"code": "report.import", "name": "导入数据", "category": "data"},
        # 数据查看（保留兼容）
        {"code": "data.view", "name": "查看数据", "category": "data"},
        {"code": "data.export", "name": "导出数据", "category": "data"},
        {"code": "data.import", "name": "导入数据", "category": "data"},
        {"code": "data_analysis", "name": "数据分析", "category": "data"},
        # 管理权限
        {"code": "admin_manage", "name": "管理员管理", "category": "system"},
        {"code": "all", "name": "全部权限", "category": "system"},
    ]
    for perm_data in default_permissions:
        existing = Permission.query.filter_by(code=perm_data["code"]).first()
        if not existing:
            permission = Permission(**perm_data)
            db.session.add(permission)
    db.session.commit()


def init_default_roles():
    """初始化默认角色数据（逐字节复刻原路由函数）。"""
    default_roles = [
        {
            "role_code": "super_admin",
            "role_name": "超级管理员",
            "description": "拥有所有权限",
            "permissions": ["all", "system.backup", "system.cache", "system.monitor", "notification.force_send"],
        },
        {
            "role_code": "admin",
            "role_name": "管理员",
            "description": "系统管理权限",
            "permissions": [
                "system.users",
                "system.roles",
                "system.settings",
                "system.logs",
                "system.backup",
                "system.cache",
                "system.monitor",
                "admin_manage",
                "student.view",
                "student.create",
                "student.edit",
                "student.delete",
                "score.view",
                "score.entry",
                "score.edit",
                "score.delete",
                "score.approve",
                "class.view",
                "class.manage",
                "exam.view",
                "exam.manage",
                "rule.view",
                "rule.manage",
                "period.view",
                "period.manage",
                "schedule.view",
                "schedule.manage",
                "subject.view",
                "subject.manage",
                "notification.send",
                "notification.view",
                "timetable.rule.manage",
                "algorithm.view",
                "algorithm.manage",
                "report.export",
                "report.import",
                "device.view",
                "device.edit",
                "device.delete",
            ],
        },
        {
            "role_code": "teacher",
            "role_name": "班主任",
            "description": "管理班级学生和成绩",
            "permissions": [
                "student.view",
                "student.create",
                "student.edit",
                "student.delete",
                "score.view",
                "score.entry",
                "score.edit",
                "score.delete",
                "class.view",
                "exam.view",
                "rule.view",
                "period.view",
                "schedule.view",
                "subject.view",
                "notification.send",
                "notification.view",
                "report.export",
                "algorithm.view",
                "phonebox.unlock.manage",
                # 班主任工作台 12 个模块。class.edit 覆盖座次表/值日生/班委/家长联系
                # 4 个模块的全部写端点，缺了这条这 4 个页面点新增就 403。
                "class.edit",
                "homework.view",
                "homework.edit",
                "homework.check",
                "attendance.view",
                "attendance.edit",
                "attendance.approve",
                "study_group.view",
                "study_group.edit",
                "mental_health.view",
                "mental_health.edit",
                "activity.view",
                "activity.edit",
                "culture.view",
                "culture.edit",
                "study_guide.view",
                "study_guide.edit",
            ],
        },
        {
            "role_code": "subject_teacher",
            "role_name": "任课教师",
            "description": "查看授课班级成绩和数据",
            "permissions": [
                "student.view",
                "score.view",
                "score.entry",
                "score.edit",
                "class.view",
                "exam.view",
                "schedule.view",
                "subject.view",
                "notification.view",
            ],
        },
        {
            "role_code": "head_teacher",
            "role_name": "年级组长",
            "description": "管理年级多个班级",
            "permissions": [
                "student.view",
                "student.create",
                "student.edit",
                "student.delete",
                "score.view",
                "score.entry",
                "score.edit",
                "score.delete",
                "score.approve",
                "class.view",
                "exam.view",
                "exam.manage",
                "rule.view",
                "rule.manage",
                "period.view",
                "period.manage",
                "schedule.view",
                "schedule.manage",
                "subject.view",
                "subject.manage",
                "notification.send",
                "notification.view",
                "report.export",
                "report.import",
                "algorithm.view",
            ],
        },
        {
            "role_code": "dashboard_viewer",
            "role_name": "数据大屏用户",
            "description": "查看数据大屏展示",
            "permissions": [
                "student.view",
                "score.view",
                "class.view",
                "exam.view",
                "schedule.view",
                "subject.view",
                "algorithm.view",
                "notification.view",
            ],
        },
        {
            "role_code": "operator",
            "role_name": "运维人员",
            "description": "负责设备运维管理",
            "permissions": [
                "device.view",
                "device.edit",
                "device.groups",
                "system.logs",
                "system.cache",
                "system.monitor",
                "notification.view",
            ],
        },
        {
            "role_code": "viewer",
            "role_name": "查看者",
            "description": "仅可查看数据",
            "permissions": [
                "student.view",
                "score.view",
                "class.view",
                "exam.view",
                "schedule.view",
                "subject.view",
                "rule.view",
                "period.view",
                "notification.view",
            ],
        },
    ]
    for role_data in default_roles:
        existing = RolePermission.query.filter_by(role_code=role_data["role_code"]).first()
        if not existing:
            role = RolePermission(
                role_code=role_data["role_code"],
                role_name=role_data["role_name"],
                description=role_data["description"],
                is_active=True,
            )
            db.session.add(role)
        else:
            existing.is_active = True
        for perm_code in role_data["permissions"]:
            mapping_exists = RolePermissionMapping.query.filter_by(
                role_code=role_data["role_code"], permission_code=perm_code
            ).first()
            if not mapping_exists:
                mapping = RolePermissionMapping(role_code=role_data["role_code"], permission_code=perm_code)
                db.session.add(mapping)
    db.session.commit()
