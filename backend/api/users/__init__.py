from .users_routes import ns_users
from .user_management_routes import ns_user_management
from .rbac_routes import ns_rbac
from .sub_accounts_routes import ns_sub_accounts
from .permission_logs_routes import ns_permission_logs

"""
用户管理模块
包含用户信息、用户管理、权限管理等路由
"""
__all__ = [
    "ns_users",
    "ns_user_management",
    "ns_rbac",
    "ns_sub_accounts",
    "ns_permission_logs",
]
