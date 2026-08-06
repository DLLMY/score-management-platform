# -*- coding: utf-8 -*-
from app import app
from models import db, Permission

"""
"""
RBAC权限系统数据库迁移脚本
"""
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_migration():
    with app.app_context():
        # 创建新表
        db.create_all()
        print("RBAC表创建完成")

        # 初始化默认权限
        default_permissions = [
            # 系统管理
            {"code": "system.settings", "name": "系统设置", "category": "system"},
            {"code": "system.users", "name": "用户管理", "category": "system"},
            {"code": "system.roles", "name": "角色管理", "category": "system"},
            {"code": "system.logs", "name": "日志查看", "category": "system"},
            # 设备管理
            {"code": "device.view", "name": "查看设备", "category": "device"},
            {"code": "device.create", "name": "创建设备", "category": "device"},
            {"code": "device.edit", "name": "编辑设备", "category": "device"},
            {"code": "device.delete", "name": "删除设备", "category": "device"},
            {"code": "device.groups", "name": "设备分组管理", "category": "device"},
            # 数据查看
            {"code": "data.view", "name": "查看数据", "category": "data"},
            {"code": "data.export", "name": "导出数据", "category": "data"},
            {"code": "data.import", "name": "导入数据", "category": "data"},
        ]

        for perm_data in default_permissions:
            existing = Permission.query.filter_by(code=perm_data["code"]).first()
            if not existing:
                permission = Permission(**perm_data)
                db.session.add(permission)
                print(f"添加权限: {perm_data['code']}")

        # 初始化默认角色
        from models import RolePermission

        default_roles = [
            {"role_code": "admin", "role_name": "超级管理员", "description": "拥有系统所有权限", "permissions": "all"},
            {
                "role_code": "operator",
                "role_name": "运维人员",
                "description": "负责设备运维管理",
                "permissions": "device.view,device.edit,device.groups",
            },
            {
                "role_code": "viewer",
                "role_name": "查看者",
                "description": "仅可查看数据",
                "permissions": "device.view,data.view",
            },
        ]

        for role_data in default_roles:
            existing = RolePermission.query.filter_by(role_code=role_data["role_code"]).first()
            if not existing:
                role = RolePermission(**role_data)
                db.session.add(role)
                print(f"添加角色: {role_data['role_code']}")

        db.session.commit()
        print("RBAC迁移完成!")


if __name__ == "__main__":
    run_migration()
