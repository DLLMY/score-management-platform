from datetime import datetime
import bcrypt
from models import db
from models import is_bcrypt_hash  # 定义于 __init__（行 98），再导出块之前已就绪
from utils.serialize import serialize_dt


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    gender = db.Column(db.String(10))
    class_name = db.Column(db.String(50), index=True)
    class_info_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), index=True)
    class_info = db.relationship("ClassInfo", backref=db.backref("users", lazy=True))
    phone = db.Column(db.String(20), index=True)
    parent_info = db.Column(db.String(500))
    father_name = db.Column(db.String(100))
    father_phone = db.Column(db.String(20))
    mother_name = db.Column(db.String(100))
    mother_phone = db.Column(db.String(20))
    guardian_name = db.Column(db.String(100))
    guardian_phone = db.Column(db.String(20))
    guardian_relation = db.Column(db.String(50))
    card_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    current_score = db.Column(
        db.Float, default=0, index=True
    )  # R7: Float 支持 0.5 分变动（原 Integer 截断与流水不一致）
    is_blacklisted = db.Column(db.Boolean, default=False, index=True)
    blacklist_reason = db.Column(db.String(500))
    blacklist_until = db.Column(db.DateTime)
    daily_unlock_limit = db.Column(db.Integer, default=5)
    today_unlock_count = db.Column(db.Integer, default=0)
    last_unlock_date = db.Column(db.Date)
    # R2 修复: 周开锁限额落库（此前 UnlockValidator 用内存属性 → 周限额永不持久化）
    weekly_unlock_count = db.Column(db.Integer, default=0)
    week_start_date = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True, index=True)
    role = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)  # R7

    def to_dict(self, fields=None):
        """学生(用户)序列化（B3 扩展 2026-08-23）。
        基础列全量；role 为端点硬编码常量（不在此输出，由路由补 "student"）；
        score 别名(=current_score) 仅详情端点由路由补；class_name 取模型列
        （与 users 管理端点一致），student login/me 如需派生 class_info.name 由路由覆盖。
        """
        data = {
            "id": self.id,
            "name": self.name,
            "gender": self.gender,
            "class_name": self.class_name,
            "class_info_id": self.class_info_id,
            "phone": self.phone,
            "parent_info": self.parent_info,
            "father_name": self.father_name,
            "father_phone": self.father_phone,
            "mother_name": self.mother_name,
            "mother_phone": self.mother_phone,
            "guardian_name": self.guardian_name,
            "guardian_phone": self.guardian_phone,
            "guardian_relation": self.guardian_relation,
            "card_id": self.card_id,
            "current_score": self.current_score,
            "is_blacklisted": self.is_blacklisted,
            "blacklist_reason": self.blacklist_reason,
            "blacklist_until": serialize_dt(self.blacklist_until),
            "daily_unlock_limit": self.daily_unlock_limit,
            "today_unlock_count": self.today_unlock_count,
            "last_unlock_date": serialize_dt(self.last_unlock_date),
            "weekly_unlock_count": self.weekly_unlock_count,
            "week_start_date": serialize_dt(self.week_start_date),
            "is_active": self.is_active,
            "created_at": serialize_dt(self.created_at),
            "updated_at": serialize_dt(self.updated_at),
        }
        if fields is None:
            return data
        return {k: data[k] for k in fields if k in data}


class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    _password = db.Column("password", db.String(200), nullable=False)
    role = db.Column(db.String(20), default="admin")
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    class_name = db.Column(db.String(50))
    primary_class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"))
    is_active = db.Column(db.Boolean, default=True)
    force_password_change = db.Column(db.Boolean, default=False)
    last_login_at = db.Column(db.DateTime)
    login_count = db.Column(db.Integer, default=0)
    last_login_ip = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, value):
        """设置密码时自动进行哈希处理"""
        if value and not is_bcrypt_hash(value):
            self._password = bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        else:
            self._password = value


class SubAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    parent_admin_id = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=False, index=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    _password = db.Column("password", db.String(200), nullable=False)
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    role_type = db.Column(db.String(30), default="dashboard_viewer", index=True)
    permissions = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    parent_admin = db.relationship("Admin", backref=db.backref("sub_accounts", lazy=True))

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, value):
        """设置密码时自动进行哈希处理"""
        if value and not is_bcrypt_hash(value):
            self._password = bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        else:
            self._password = value

    def to_dict(self, fields=None):
        """基础字段序列化（B3 扩展 2026-08-23）。

        ⚠️ 永不序列化 _password（敏感字段，任何 fields 子集都取不到）。
        端点字段子集：SUB_ACCOUNT_FIELDS（list 9 字段）/ SUB_ACCOUNT_LOGIN_FIELDS（登录 4 字段）；
        detail 用全量（含 updated_at）。
        """
        data = {
            "id": self.id,
            "parent_admin_id": self.parent_admin_id,
            "username": self.username,
            "real_name": self.real_name,
            "phone": self.phone,
            "role_type": self.role_type,
            "permissions": self.permissions,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if fields is None:
            return data
        return {k: data[k] for k in fields if k in data}


class RolePermission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    role_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self, fields=None):
        """基础字段序列化（B3 扩展 2026-08-23）。

        角色权限定义响应：list 用 ROLE_PERMISSION_FIELDS 子集（无 updated_at），
        detail 用全量。
        """
        data = {
            "id": self.id,
            "role_code": self.role_code,
            "role_name": self.role_name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if fields is None:
            return data
        return {k: data[k] for k in fields if k in data}


class PermissionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operator_id = db.Column(db.Integer)
    operator_type = db.Column(db.String(30))
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    description = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class AdminRole(db.Model):
    """管理员角色关联表"""

    __tablename__ = "admin_roles"

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=False, index=True)
    role_code = db.Column(db.String(50), index=True)
    assigned_at = db.Column(db.DateTime, default=datetime.now)

    admin = db.relationship("Admin", backref=db.backref("role_links", lazy=True))


class Permission(db.Model):
    """权限定义表"""

    __tablename__ = "permissions"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), index=True)
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self, fields=None):
        """基础字段序列化（B3 扩展 2026-08-23）。

        权限响应（rbac_routes list/detail）字段集与全量一致，直接 to_dict()。
        """
        data = {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if fields is None:
            return data
        return {k: data[k] for k in fields if k in data}


class RolePermissionMapping(db.Model):
    """角色-权限映射表"""

    __tablename__ = "role_permission_mappings"

    id = db.Column(db.Integer, primary_key=True)
    role_code = db.Column(db.String(50), index=True)
    permission_code = db.Column(db.String(100), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


class RoleHierarchy(db.Model):
    """角色继承层级表"""

    __tablename__ = "role_hierarchies"

    id = db.Column(db.Integer, primary_key=True)
    parent_role_code = db.Column(db.String(50), index=True)
    child_role_code = db.Column(db.String(50), index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


class SecurityAudit(db.Model):
    """安全审计日志"""

    __tablename__ = "security_audits"

    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(50), nullable=False, index=True)
    severity = db.Column(db.String(20), default="info", index=True)
    user_id = db.Column(db.Integer, index=True)
    user_type = db.Column(db.String(30))
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    request_path = db.Column(db.String(500))
    request_method = db.Column(db.String(10))
    response_status = db.Column(db.Integer)
    event_details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)


class LoginAttempt(db.Model):
    """登录尝试记录"""

    __tablename__ = "login_attempts"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), index=True)
    ip_address = db.Column(db.String(45), index=True)
    attempt_count = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime)
    last_attempt_at = db.Column(db.DateTime)
    success = db.Column(db.Boolean, default=False)
    user_agent = db.Column(db.Text)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
