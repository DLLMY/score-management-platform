"""子账号写入/事务路径薄封装（F17 防腐层：从 api/users/sub_accounts_routes 收口）。

逐字节复刻原路由内联落库行为；路由保留 get_or_404 / 请求校验（密码必填）/
登录令牌生成 / 限流 / 响应构造。
"""

from datetime import datetime

from models import db, SubAccount, PermissionLog
from utils.security import hash_password


def create_sub_account(data):
    """复刻 SubAccountList.post 内联建模 + add + commit。返回 account 实例。"""
    account = SubAccount(
        parent_admin_id=data.get("parent_admin_id"),
        username=data.get("username"),
        password=hash_password(data.get("password")),
        real_name=data.get("real_name"),
        phone=data.get("phone"),
        role_type=data.get("role_type", "dashboard_viewer"),
        permissions=data.get("permissions", ""),
        is_active=data.get("is_active", True),
    )
    db.session.add(account)
    db.session.commit()
    return account


def update_sub_account(account, data):
    """复刻 SubAccountResource.put 内联字段赋值 + commit。返回 account 实例。"""
    account.username = data.get("username", account.username)
    if data.get("password"):
        account.password = hash_password(data.get("password"))
    account.real_name = data.get("real_name", account.real_name)
    account.phone = data.get("phone", account.phone)
    account.role_type = data.get("role_type", account.role_type)
    account.permissions = data.get("permissions", account.permissions)
    account.is_active = data.get("is_active", account.is_active)
    account.updated_at = datetime.now()
    db.session.commit()
    return account


def delete_sub_account(account):
    """复刻 SubAccountResource.delete 内联 delete + commit。"""
    db.session.delete(account)
    db.session.commit()


def log_sub_account_action(action, target_id=None, description=None, operator_id=None, ip_address=None):
    """复刻 log_permission_action 内联 PermissionLog 建模 + add + commit。

    失败回滚防脏 session 污染后续请求（与原实现一致）。
    """
    try:
        log = PermissionLog(
            operator_id=operator_id,
            operator_type="admin",
            action=action,
            target_type="sub_account",
            target_id=target_id,
            description=description,
            ip_address=ip_address,
            created_at=datetime.now(),
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()
        pass
