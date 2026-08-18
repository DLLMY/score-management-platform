from typing import Any, Callable
from functools import wraps
from flask import request, jsonify

import re

"""
统一参数校验模块
功能：提供常用的参数校验规则和自定义校验器
作者：开发团队
日期：2026-06-14
"""
# ==================== 校验规则定义 ====================


class ValidationRules:
    """校验规则常量"""

    # 字符串长度限制
    NAME_MIN_LEN = 1
    NAME_MAX_LEN = 100
    USERNAME_MIN_LEN = 3
    USERNAME_MAX_LEN = 50
    PASSWORD_MIN_LEN = 6
    PASSWORD_MAX_LEN = 100
    DESCRIPTION_MAX_LEN = 500
    PHONE_MAX_LEN = 20

    # 卡号格式：8-16位数字
    CARD_ID_PATTERN = r"^\d{8,16}$"
    CARD_ID_MIN_LEN = 8
    CARD_ID_MAX_LEN = 16

    # 学号格式：字母开头，6-20位字母数字组合
    STUDENT_ID_PATTERN = r"^[a-zA-Z][a-zA-Z0-9]{5,19}$"
    STUDENT_ID_MIN_LEN = 6
    STUDENT_ID_MAX_LEN = 20

    # 设备ID格式：字母开头，6-64位字母数字下划线组合
    DEVICE_ID_PATTERN = r"^[a-zA-Z][a-zA-Z0-9_]{5,63}$"
    DEVICE_ID_MIN_LEN = 6
    DEVICE_ID_MAX_LEN = 64

    # 中文姓名格式
    CHINESE_NAME_PATTERN = r"^[\u4e00-\u9fa5]{2,20}$"
    ENGLISH_NAME_PATTERN = r"^[a-zA-Z ]{2,50}$"

    # 邮箱格式
    EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"

    # IP地址格式
    IP_PATTERN = r"^(\d{1,3}\.){3}\d{1,3}$"

    # MAC地址格式
    MAC_PATTERN = r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"

    # 分数范围
    SCORE_MIN = -1000
    SCORE_MAX = 1000

    # ID范围
    ID_MIN = 1
    ID_MAX = 2147483647


# ==================== 自定义校验器 ====================


def validate_card_id(card_id: str) -> tuple[bool, str]:
    """
    校验卡号格式

    Args:
        card_id: 卡号字符串

    Returns:
        (是否有效, 错误消息)
    """
    if not card_id:
        return False, "卡号不能为空"

    # 移除空格
    card_id = card_id.strip()

    # 检查长度
    if len(card_id) < ValidationRules.CARD_ID_MIN_LEN:
        return False, f"卡号长度不能少于{ValidationRules.CARD_ID_MIN_LEN}位"

    if len(card_id) > ValidationRules.CARD_ID_MAX_LEN:
        return False, f"卡号长度不能超过{ValidationRules.CARD_ID_MAX_LEN}位"

    # 检查是否为纯数字
    if not card_id.isdigit():
        return False, "卡号必须为纯数字"

    return True, ""


def validate_phone(phone: str) -> tuple[bool, str]:
    """
    校验手机号格式

    Args:
        phone: 手机号字符串

    Returns:
        (是否有效, 错误消息)
    """
    if not phone:
        return True, ""  # 手机号可选

    phone = phone.strip()

    # 支持格式：纯数字、带横线、带空格
    phone_clean = re.sub(r"[-\s]", "", phone)

    if not phone_clean.isdigit():
        return False, "手机号只能包含数字"

    if len(phone_clean) < 7 or len(phone_clean) > 15:
        return False, "手机号长度应在7-15位之间"

    return True, ""


def validate_email(email: str) -> tuple[bool, str]:
    """
    校验邮箱格式

    Args:
        email: 邮箱字符串

    Returns:
        (是否有效, 错误消息)
    """
    if not email:
        return True, ""  # 邮箱可选

    email = email.strip()

    if not re.match(ValidationRules.EMAIL_PATTERN, email):
        return False, "邮箱格式不正确"

    return True, ""


def validate_score(score: Any) -> tuple[bool, str]:
    """
    校验分数值

    Args:
        score: 分数值

    Returns:
        (是否有效, 错误消息)
    """
    try:
        score_int = int(score)
    except (ValueError, TypeError):
        return False, "分数必须为整数"

    if score_int < ValidationRules.SCORE_MIN:
        return False, f"分数不能小于{ValidationRules.SCORE_MIN}"

    if score_int > ValidationRules.SCORE_MAX:
        return False, f"分数不能大于{ValidationRules.SCORE_MAX}"

    return True, ""


def validate_id(id_value: Any) -> tuple[bool, str]:
    """
    校验ID值

    Args:
        id_value: ID值

    Returns:
        (是否有效, 错误消息)
    """
    try:
        id_int = int(id_value)
    except (ValueError, TypeError):
        return False, "ID必须为整数"

    if id_int < ValidationRules.ID_MIN:
        return False, "ID必须为正数"

    if id_int > ValidationRules.ID_MAX:
        return False, "ID值超出范围"

    return True, ""


def validate_username(username: str) -> tuple[bool, str]:
    """
    校验用户名格式

    Args:
        username: 用户名

    Returns:
        (是否有效, 错误消息)
    """
    if not username:
        return False, "用户名不能为空"

    username = username.strip()

    if len(username) < ValidationRules.USERNAME_MIN_LEN:
        return False, f"用户名长度不能少于{ValidationRules.USERNAME_MIN_LEN}位"

    if len(username) > ValidationRules.USERNAME_MAX_LEN:
        return False, f"用户名长度不能超过{ValidationRules.USERNAME_MAX_LEN}位"

    # 用户名只能包含字母、数字、下划线
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return False, "用户名只能包含字母、数字和下划线"

    return True, ""


def validate_password(password: str) -> tuple[bool, str]:
    """
    校验密码格式

    Args:
        password: 密码

    Returns:
        (是否有效, 错误消息)
    """
    if not password:
        return False, "密码不能为空"

    if len(password) < ValidationRules.PASSWORD_MIN_LEN:
        return False, f"密码长度不能少于{ValidationRules.PASSWORD_MIN_LEN}位"

    if len(password) > ValidationRules.PASSWORD_MAX_LEN:
        return False, f"密码长度不能超过{ValidationRules.PASSWORD_MAX_LEN}位"

    return True, ""


def validate_mac_address(mac: str) -> tuple[bool, str]:
    """
    校验MAC地址格式

    Args:
        mac: MAC地址

    Returns:
        (是否有效, 错误消息)
    """
    if not mac:
        return False, "MAC地址不能为空"

    mac = mac.strip()

    # 尝试多种格式
    patterns = [
        r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$",  # XX:XX:XX:XX:XX:XX
        r"^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$",  # XX-XX-XX-XX-XX-XX
        r"^([0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}$",  # XXXX.XXXX.XXXX
    ]

    for pattern in patterns:
        if re.match(pattern, mac):
            return True, ""

    return False, "MAC地址格式不正确（支持 XX:XX:XX:XX:XX:XX 或 XX-XX-XX-XX-XX-XX）"


def validate_ip_address(ip: str) -> tuple[bool, str]:
    """
    校验IP地址格式

    Args:
        ip: IP地址

    Returns:
        (是否有效, 错误消息)
    """
    if not ip:
        return True, ""  # IP地址可选

    ip = ip.strip()

    if not re.match(ValidationRules.IP_PATTERN, ip):
        return False, "IP地址格式不正确"

    # 检查每个段是否在0-255范围内
    parts = ip.split(".")
    for part in parts:
        if int(part) > 255:
            return False, "IP地址格式不正确"

    return True, ""


def validate_positive_int(value: Any) -> tuple[bool, str]:
    """
    校验正整数

    Args:
        value: 值

    Returns:
        (是否有效, 错误消息)
    """
    try:
        value_int = int(value)
    except (ValueError, TypeError):
        return False, "必须为整数"

    if value_int <= 0:
        return False, "必须为正整数"

    return True, ""


def validate_enum(value: Any, allowed_values: list) -> tuple[bool, str]:
    """
    校验枚举值

    Args:
        value: 值
        allowed_values: 允许的值列表

    Returns:
        (是否有效, 错误消息)
    """
    if value not in allowed_values:
        return False, f"值必须在 {allowed_values} 中"

    return True, ""


def validate_student_id(student_id: str) -> tuple[bool, str]:
    """
    校验学号格式（字母开头，6-20位字母数字组合）

    Args:
        student_id: 学号字符串

    Returns:
        (是否有效, 错误消息)
    """
    if not student_id:
        return False, "学号不能为空"

    student_id = student_id.strip()

    if len(student_id) < ValidationRules.STUDENT_ID_MIN_LEN:
        return False, f"学号长度不能少于{ValidationRules.STUDENT_ID_MIN_LEN}位"

    if len(student_id) > ValidationRules.STUDENT_ID_MAX_LEN:
        return False, f"学号长度不能超过{ValidationRules.STUDENT_ID_MAX_LEN}位"

    if not re.match(ValidationRules.STUDENT_ID_PATTERN, student_id):
        return False, "学号必须以字母开头，只能包含字母和数字"

    return True, ""


def validate_device_id(device_id: str) -> tuple[bool, str]:
    """
    校验设备ID格式（字母开头，6-64位字母数字下划线组合）

    Args:
        device_id: 设备ID字符串

    Returns:
        (是否有效, 错误消息)
    """
    if not device_id:
        return False, "设备ID不能为空"

    device_id = device_id.strip()

    if len(device_id) < ValidationRules.DEVICE_ID_MIN_LEN:
        return False, f"设备ID长度不能少于{ValidationRules.DEVICE_ID_MIN_LEN}位"

    if len(device_id) > ValidationRules.DEVICE_ID_MAX_LEN:
        return False, f"设备ID长度不能超过{ValidationRules.DEVICE_ID_MAX_LEN}位"

    if not re.match(ValidationRules.DEVICE_ID_PATTERN, device_id):
        return False, "设备ID必须以字母开头，只能包含字母、数字和下划线"

    return True, ""


def validate_chinese_name(name: str) -> tuple[bool, str]:
    """
    校验中文姓名格式（2-20个汉字）

    Args:
        name: 姓名字符串

    Returns:
        (是否有效, 错误消息)
    """
    if not name:
        return False, "姓名不能为空"

    name = name.strip()

    if len(name) < 2:
        return False, "姓名长度不能少于2个字符"

    if len(name) > 20:
        return False, "姓名长度不能超过20个字符"

    if not re.match(ValidationRules.CHINESE_NAME_PATTERN, name):
        return False, "姓名只能包含中文字符"

    return True, ""


def validate_name(name: str) -> tuple[bool, str]:
    """
    校验姓名格式（支持中文和英文姓名）

    Args:
        name: 姓名字符串

    Returns:
        (是否有效, 错误消息)
    """
    if not name:
        return False, "姓名不能为空"

    name = name.strip()

    if len(name) < 2:
        return False, "姓名长度不能少于2个字符"

    if len(name) > 50:
        return False, "姓名长度不能超过50个字符"

    # 检查是否为纯中文姓名
    if re.match(ValidationRules.CHINESE_NAME_PATTERN, name):
        return True, ""

    # 检查是否为英文姓名
    if re.match(ValidationRules.ENGLISH_NAME_PATTERN, name):
        return True, ""

    return False, "姓名格式无效，请输入中文或英文姓名"


# ==================== 装饰器式校验器 ====================


def validate_request(*validators: Callable) -> Callable:
    """
    请求参数校验装饰器

    Args:
        validators: 校验函数列表

    Returns:
        装饰后的函数
    """

    def decorator(func: Callable) -> Callable:

        @wraps(func)
        def wrapper(*args, **kwargs):
            # 获取请求数据
            json_data = request.get_json(silent=True) or {}
            query_params = dict(request.args)

            errors = []

            for validator in validators:
                try:
                    result = validator(json_data, query_params)  # noqa: F841
                    if isinstance(result, tuple) and len(result) == 2:
                        is_valid, error_msg = result
                        if not is_valid:
                            errors.append(error_msg)
                    elif isinstance(result, dict):
                        # 返回字典表示多个错误
                        for field, error in result.items():
                            if error:
                                errors.append(f"{field}: {error}")
                except Exception as e:
                    errors.append(f"校验异常: {str(e)}")

            if errors:
                return jsonify({"success": False, "message": "参数校验失败", "errors": errors}), 400

            return func(*args, **kwargs)

        return wrapper

    return decorator


def create_field_validator(
    field_name: str, validator_func: Callable, source: str = "json"
) -> Callable:
    """
    创建字段校验器

    Args:
        field_name: 字段名
        validator_func: 校验函数
        source: 数据来源 ('json', 'query', 'both')

    Returns:
        校验器函数
    """

    def validator(json_data: dict, query_data: dict) -> tuple[bool, str]:
        value = None

        if source in ("json", "both"):
            value = json_data.get(field_name)
        if source in ("query", "both") and value is None:
            value = query_data.get(field_name)

        return validator_func(value)

    return validator


# ==================== Flask-RESTX 字段定义 ====================


def get_common_fields():
    """获取通用字段定义"""
    from flask_restx import fields

    return {
        "id": fields.Integer(readOnly=True, description="ID"),
        "name": fields.String(
            required=True,
            min_length=ValidationRules.NAME_MIN_LEN,
            max_length=ValidationRules.NAME_MAX_LEN,
            description="名称",
        ),
        "description": fields.String(
            max_length=ValidationRules.DESCRIPTION_MAX_LEN, description="描述"
        ),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
        "updated_at": fields.DateTime(readOnly=True, description="更新时间"),
    }


def get_user_fields():
    """获取用户相关字段定义"""

    return {
        "id": fields.Integer(readOnly=True, description="学生ID"),
        "name": fields.String(
            required=True,
            min_length=ValidationRules.NAME_MIN_LEN,
            max_length=ValidationRules.NAME_MAX_LEN,
            description="学生姓名",
        ),
        "gender": fields.String(description="性别"),
        "class_name": fields.String(description="班级"),
        "phone": fields.String(max_length=ValidationRules.PHONE_MAX_LEN, description="联系电话"),
        "card_id": fields.String(description="卡片ID"),
        "current_score": fields.Integer(description="当前积分"),
        "is_active": fields.Boolean(description="是否启用"),
        "is_blacklisted": fields.Boolean(description="是否黑名单"),
    }


def get_score_fields():
    """获取积分相关字段定义"""

    return {
        "score_change": fields.Integer(
            required=True,
            description=f"积分变化量 ({ValidationRules.SCORE_MIN}到{ValidationRules.SCORE_MAX})",
        ),
        "description": fields.String(
            max_length=ValidationRules.DESCRIPTION_MAX_LEN, description="操作描述"
        ),
    }


def get_pagination_fields():
    """获取分页相关字段定义"""

    return {
        "page": fields.Integer(description="当前页码"),
        "per_page": fields.Integer(description="每页数量"),
        "total": fields.Integer(description="总记录数"),
        "pages": fields.Integer(description="总页数"),
    }


# ==================== 统一错误响应 ====================


def success_response(data=None, message="操作成功"):
    """成功响应"""
    response = {"success": True, "message": message}
    if data is not None:
        response["data"] = data
    return jsonify(response)


def error_response(message: str, errors: list = None, code: int = 400):
    """错误响应"""
    response = {"success": False, "message": message}
    if errors:
        response["errors"] = errors
    return response, code


def validation_error_response(errors: list):
    """参数校验错误响应"""
    return error_response("参数校验失败", errors, 400)


def not_found_response(resource: str = "资源"):
    """资源不存在响应"""
    return error_response(f"{resource}不存在", code=404)


def unauthorized_response(message: str = "未授权访问"):
    """未授权响应"""
    return error_response(message, code=401)


def forbidden_response(message: str = "禁止访问"):
    """禁止访问响应"""
    return error_response(message, code=403)
