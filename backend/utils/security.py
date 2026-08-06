"""安全工具模块 - 提供CSRF保护、输入验证、JWT认证等功能"""

import re
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import json
import os

# JWT配置
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("FLASK_SECRET_KEY", "your_secret_key_here"))
if JWT_SECRET_KEY == "your_secret_key_here":
    import sys

    print("\n" + "=" * 60)
    print("⚠️  安全警告: 正在使用默认 JWT_SECRET_KEY!")
    print("⚠️  请在生产环境中设置 JWT_SECRET_KEY 环境变量")
    print("=" * 60 + "\n", file=sys.stderr)
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

# ==================== JWT认证 ====================


def generate_tokens(admin_id: int, username: str, role: str):
    """生成访问令牌和刷新令牌"""
    access_payload = {
        "sub": str(admin_id),  # JWT的sub字段必须是字符串
        "username": username,
        "role": role,
        "type": "access",
        "exp": datetime.utcnow() + JWT_ACCESS_TOKEN_EXPIRES,
    }

    refresh_payload = {
        "admin_id": str(admin_id),  # 统一使用字符串
        "username": username,
        "type": "refresh",
        "exp": datetime.utcnow() + JWT_REFRESH_TOKEN_EXPIRES,
    }

    access_token = jwt.encode(access_payload, JWT_SECRET_KEY, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, JWT_SECRET_KEY, algorithm="HS256")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": int(JWT_ACCESS_TOKEN_EXPIRES.total_seconds()),
    }


def decode_token(token: str) -> Optional[Dict]:
    """解码JWT令牌"""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def validate_token(token: str, token_type: str = "access") -> Optional[Dict]:
    """验证JWT令牌"""
    payload = decode_token(token)
    if payload is None:
        return None
    if payload.get("type") == token_type:
        return payload
    return None


SUBACCOUNT_TOKEN_EXPIRES = timedelta(hours=24)
STUDENT_TOKEN_EXPIRES = timedelta(hours=12)


def generate_subaccount_token(subaccount_id: int, username: str, role_type: str, parent_admin_id: int):
    """为子账号生成JWT令牌"""
    payload = {
        "sub": str(subaccount_id),
        "username": username,
        "role_type": role_type,
        "parent_admin_id": parent_admin_id,
        "type": "subaccount",
        "exp": datetime.utcnow() + SUBACCOUNT_TOKEN_EXPIRES,
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
    return {"token": token, "expires_in": int(SUBACCOUNT_TOKEN_EXPIRES.total_seconds())}


def generate_student_token(user_id: int, username: str, card_id: str):
    """为学生生成JWT令牌"""
    payload = {
        "sub": str(user_id),
        "username": username,
        "card_id": card_id,
        "type": "student",
        "exp": datetime.utcnow() + STUDENT_TOKEN_EXPIRES,
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
    return {"token": token, "expires_in": int(STUDENT_TOKEN_EXPIRES.total_seconds())}


# ==================== 密码处理 ====================


def hash_password(password: str) -> str:
    """使用bcrypt哈希密码"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """验证密码是否匹配"""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def set_auth_cookies(response, access_token: str, refresh_token: str = None):
    """在响应中设置认证Cookie"""
    from flask import current_app

    access_expires = 3600  # 1 hour
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        secure=current_app.config.get("SESSION_COOKIE_SECURE", False),
        samesite="Lax",
        max_age=access_expires,
    )
    if refresh_token:
        refresh_expires = 7 * 24 * 3600  # 7 days
        response.set_cookie(
            "refresh_token",
            refresh_token,
            httponly=True,
            secure=current_app.config.get("SESSION_COOKIE_SECURE", False),
            samesite="Lax",
            max_age=refresh_expires,
        )
    return response


def clear_auth_cookies(response):
    """清除认证Cookie"""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response


def is_strong_password(password: str) -> bool:
    """检查密码强度"""
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    return True


# ==================== 输入验证 ====================


def validate_email(email: str) -> bool:
    """验证邮箱格式"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def validate_phone(phone: str) -> bool:
    """验证手机号码格式"""
    pattern = r"^1[3-9]\d{9}$"
    return re.match(pattern, phone) is not None


def validate_card_id(card_id: str) -> bool:
    """验证饭卡号格式"""
    # 允许纯数字或字母数字组合，长度4-20位
    pattern = r"^[A-Za-z0-9]{4,20}$"
    return re.match(pattern, card_id) is not None


def validate_username(username: str) -> bool:
    """验证用户名格式"""
    # 字母开头，允许字母数字下划线，长度2-50位
    pattern = r"^[A-Za-z][A-Za-z0-9_]{1,49}$"
    return re.match(pattern, username) is not None


def validate_password(password: str) -> bool:
    """验证密码强度"""
    # 至少6位，包含字母和数字
    if len(password) < 6:
        return False
    has_alpha = re.search(r"[A-Za-z]", password) is not None
    has_digit = re.search(r"\d", password) is not None
    return has_alpha and has_digit


def validate_integer(value: Any, min_val: int = None, max_val: int = None) -> bool:
    """验证整数值"""
    try:
        val = int(value)
        if min_val is not None and val < min_val:
            return False
        if max_val is not None and val > max_val:
            return False
        return True
    except (ValueError, TypeError):
        return False


def validate_string_length(value: str, min_len: int = 1, max_len: int = 255) -> bool:
    """验证字符串长度"""
    if not isinstance(value, str):
        return False
    return min_len <= len(value.strip()) <= max_len


def validate_score(value: Any) -> bool:
    """验证积分值"""
    return validate_integer(value, min_val=-10000, max_val=10000)


def validate_class_name(class_name: str) -> bool:
    """验证班级名称格式"""
    # 允许中文、数字、括号等，长度1-50
    if not isinstance(class_name, str):
        return False
    pattern = r"^[\u4e00-\u9fa5a-zA-Z0-9()（）班级级]{1,50}$"
    return re.match(pattern, class_name.strip()) is not None


def validate_gender(gender: str) -> bool:
    """验证性别"""
    return gender in ["男", "女", ""]


def validate_status(status: str) -> bool:
    """验证状态"""
    return status in ["active", "inactive", ""]


def validate_datetime(date_str: str) -> bool:
    """验证日期时间格式"""
    formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y/%m/%d"]
    for fmt in formats:
        try:
            datetime.strptime(date_str, fmt)
            return True
        except ValueError:
            continue
    return False


def validate_json(data: str) -> bool:
    """验证JSON格式"""
    try:
        json.loads(data)
        return True
    except (json.JSONDecodeError, TypeError):
        return False


# ==================== 输入验证器 ====================


class InputValidator:
    """输入验证器"""

    def __init__(self):
        self.errors = []

    def validate(self, field: str, value: Any, rules: List[Dict[str, Any]]) -> bool:
        """验证字段"""
        self.errors = []

        for rule in rules:
            if isinstance(rule, str):
                # 简单规则
                if rule == "required":
                    if value is None or (isinstance(value, str) and value.strip() == ""):
                        self.errors.append(f"{field} 必填")
                elif rule == "email":
                    if value and not validate_email(value):
                        self.errors.append(f"{field} 格式不正确")
                elif rule == "phone":
                    if value and not validate_phone(value):
                        self.errors.append(f"{field} 格式不正确")
                elif rule == "card_id":
                    if value and not validate_card_id(value):
                        self.errors.append(f"{field} 格式不正确，需4-20位字母或数字")
                elif rule == "username":
                    if value and not validate_username(value):
                        self.errors.append(f"{field} 格式不正确，需字母开头，2-50位字母数字下划线")
                elif rule == "password":
                    if value and not validate_password(value):
                        self.errors.append(f"{field} 需至少6位，包含字母和数字")
                elif rule == "integer":
                    if value and not validate_integer(value):
                        self.errors.append(f"{field} 必须是整数")
                elif rule == "score":
                    if value and not validate_score(value):
                        self.errors.append(f"{field} 必须是-10000到10000之间的整数")
                elif rule == "class_name":
                    if value and not validate_class_name(value):
                        self.errors.append(f"{field} 格式不正确")
                elif rule == "gender":
                    if value and not validate_gender(value):
                        self.errors.append(f"{field} 只能是'男'或'女'")
                elif rule == "datetime":
                    if value and not validate_datetime(value):
                        self.errors.append(f"{field} 日期格式不正确")
                elif rule == "json":
                    if value and not validate_json(value):
                        self.errors.append(f"{field} JSON格式不正确")

            elif isinstance(rule, dict):
                # 参数化规则
                if "min" in rule:
                    if value is not None:
                        try:
                            val = int(value) if isinstance(value, (int, str)) else value
                            if val < rule["min"]:
                                self.errors.append(f"{field} 不能小于 {rule['min']}")
                        except (ValueError, TypeError):
                            self.errors.append(f"{field} 必须是数字")
                if "max" in rule:
                    if value is not None:
                        try:
                            val = int(value) if isinstance(value, (int, str)) else value
                            if val > rule["max"]:
                                self.errors.append(f"{field} 不能大于 {rule['max']}")
                        except (ValueError, TypeError):
                            self.errors.append(f"{field} 必须是数字")
                if "minLength" in rule:
                    if value and len(str(value).strip()) < rule["minLength"]:
                        self.errors.append(f"{field} 至少需要 {rule['minLength']} 个字符")
                if "maxLength" in rule:
                    if value and len(str(value).strip()) > rule["maxLength"]:
                        self.errors.append(f"{field} 最多允许 {rule['maxLength']} 个字符")

        return len(self.errors) == 0

    def get_errors(self) -> List[str]:
        """获取错误列表"""
        return self.errors


# ==================== 安全辅助函数 ====================


def sanitize_input(value: str) -> str:
    """清理输入，防止XSS攻击"""
    if not isinstance(value, str):
        return value

    # HTML实体编码
    replacements = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;", "/": "&#x2F;", "\\": "&#x5C;"}

    for old, new in replacements.items():
        value = value.replace(old, new)

    return value


def sanitize_filename(filename: str) -> str:
    """清理文件名，防止路径遍历攻击"""
    if not isinstance(filename, str):
        return ""

    # 移除危险字符
    dangerous_chars = ["/", "\\", "..", ":", "*", "?", '"', "<", ">", "|"]
    for char in dangerous_chars:
        filename = filename.replace(char, "_")

    # 限制长度
    return filename[:200]


def is_safe_redirect_url(url: str) -> bool:
    """检查重定向URL是否安全"""
    if not url or not isinstance(url, str):
        return False

    # 只允许相对路径或白名单域名
    if url.startswith("/"):
        return True

    # 禁止javascript伪协议
    if url.lower().startswith("javascript:"):
        return False

    # 禁止data协议
    if url.lower().startswith("data:"):
        return False

    return True


# ==================== 请求参数提取 ====================


def get_request_data() -> Dict[str, Any]:
    """从请求中提取数据，支持JSON和表单"""
    data = {}

    # 优先从JSON获取
    if request and request.is_json:
        try:
            data = request.get_json() or {}
        except Exception:
            pass

    # 如果JSON为空，从表单获取
    if not data and request and request.form:
        data = request.form.to_dict()

    return data


def get_request_param(key: str, default: Any = None) -> Any:
    """获取请求参数"""
    data = get_request_data()
    return data.get(key, default)


# ==================== 导出 ====================

__all__ = [
    # JWT认证
    "generate_tokens",
    "decode_token",
    "validate_token",
    # 密码处理
    "hash_password",
    "verify_password",
    "is_strong_password",
    # 验证函数
    "validate_email",
    "validate_phone",
    "validate_card_id",
    "validate_username",
    "validate_password",
    "validate_integer",
    "validate_string_length",
    "validate_score",
    "validate_class_name",
    "validate_gender",
    "validate_status",
    "validate_datetime",
    "validate_json",
    # 验证器类
    "InputValidator",
    # 安全辅助函数
    "sanitize_input",
    "sanitize_filename",
    "is_safe_redirect_url",
    # 请求参数提取
    "get_request_data",
    "get_request_param",
]
