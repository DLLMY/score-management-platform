"""
数据验证工具 - 提供请求数据验证功能
"""

from functools import wraps
from flask import request, jsonify
import re
from typing import Any, Dict, List, Callable


class ValidationError(Exception):
    """验证错误异常"""

    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(message)


class Validator:
    """数据验证器类"""

    @staticmethod
    def required(value: Any, field_name: str) -> None:
        """验证必填字段"""
        if value is None or (isinstance(value, str) and (not value.strip())):
            raise ValidationError(f"{field_name}不能为空", field_name)

    @staticmethod
    def min_length(value: str, length: int, field_name: str) -> None:
        """验证最小长度"""
        if value and len(str(value)) < length:
            raise ValidationError(f"{field_name}长度不能少于{length}个字符", field_name)

    @staticmethod
    def max_length(value: str, length: int, field_name: str) -> None:
        """验证最大长度"""
        if value and len(str(value)) > length:
            raise ValidationError(f"{field_name}长度不能超过{length}个字符", field_name)

    @staticmethod
    def pattern(value: str, pattern: str, field_name: str, message: str = None) -> None:
        """验证正则表达式"""
        if value and (not re.match(pattern, str(value))):
            raise ValidationError(message or f"{field_name}格式不正确", field_name)

    @staticmethod
    def range(value: int, min_val: int, max_val: int, field_name: str) -> None:
        """验证数值范围"""
        if value is not None:
            if value < min_val or value > max_val:
                raise ValidationError(f"{field_name}必须在{min_val}-{max_val}之间", field_name)

    @staticmethod
    def one_of(value: Any, choices: List[Any], field_name: str) -> None:
        """验证值必须在列表中"""
        if value and value not in choices:
            raise ValidationError(
                f"{field_name}必须是以下之一: {', '.join(map(str, choices))}", field_name
            )


class SchemaValidator:
    """Schema验证器"""

    def __init__(self, schema: Dict[str, Dict]):
        self.schema = schema

    def validate(self, data: Dict) -> tuple[bool, Dict]:
        """
        验证数据
        返回: (is_valid, errors_or_data)
        """
        errors = {}
        validated_data = {}
        for field, rules in self.schema.items():
            value = data.get(field)
            try:
                if rules.get("required", False):
                    Validator.required(value, field)
                if value is None:
                    continue
                if "min_length" in rules:
                    Validator.min_length(value, rules["min_length"], field)
                if "max_length" in rules:
                    Validator.max_length(value, rules["max_length"], field)
                if "pattern" in rules:
                    Validator.pattern(value, rules["pattern"], field, rules.get("pattern_message"))
                if "min" in rules and "max" in rules:
                    Validator.range(value, rules["min"], rules["max"], field)
                if "choices" in rules:
                    Validator.one_of(value, rules["choices"], field)
                if "type" in rules:
                    if rules["type"] == "int":
                        validated_data[field] = int(value)
                    elif rules["type"] == "float":
                        validated_data[field] = float(value)
                    elif rules["type"] == "str":
                        validated_data[field] = str(value).strip()
                    elif rules["type"] == "bool":
                        validated_data[field] = bool(value)
                    else:
                        validated_data[field] = value
                else:
                    validated_data[field] = value
            except ValidationError as e:
                errors[e.field or field] = e.message
        if errors:
            return (False, errors)
        return (True, validated_data)


def validate_json(schema: Dict[str, Dict]):
    """
    装饰器：验证JSON请求数据
    使用示例:
        @validate_json({
            'username': {'required': True, 'max_length': 50},
            'password': {'required': True, 'min_length': 6, 'max_length': 128},
            'email': {'pattern': r'^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$', 'required': False}
        })
    """

    def decorator(f: Callable):

        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return (jsonify({"success": False, "message": "请求必须是JSON格式"}), 400)
            data = request.get_json(silent=True)
            if data is None:
                return (jsonify({"success": False, "message": "无效的JSON数据"}), 400)
            validator = SchemaValidator(schema)
            is_valid, result = validator.validate(data)
            if not is_valid:
                return (
                    jsonify({"success": False, "message": "数据验证失败", "errors": result}),
                    400,
                )
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def validate_query(schema: Dict[str, Dict]):
    """
    装饰器：验证查询参数
    使用示例:
        @validate_query({
            'page': {'type': 'int', 'min': 1},
            'per_page': {'type': 'int', 'min': 1, 'max': 100}
        })
    """

    def decorator(f: Callable):

        @wraps(f)
        def decorated_function(*args, **kwargs):
            validator = SchemaValidator(schema)
            is_valid, result = validator.validate(dict(request.args))
            if not is_valid:
                return (
                    jsonify({"success": False, "message": "查询参数验证失败", "errors": result}),
                    400,
                )
            return f(*args, **kwargs)

        return decorated_function

    return decorator


USER_SCHEMA = {
    "name": {
        "required": True,
        "min_length": 2,
        "max_length": 50,
        "pattern": "^[\\u4e00-\\u9fa5a-zA-Z\\s]+$",
        "pattern_message": "姓名只能包含中文、英文字母和空格",
    },
    "card_id": {"required": True, "min_length": 6, "max_length": 20},
}  # noqa: E501
ADMIN_LOGIN_SCHEMA = {
    "username": {"required": True, "min_length": 3, "max_length": 50},
    "password": {"required": True, "min_length": 6, "max_length": 128},
}
SCORE_RULE_SCHEMA = {
    "name": {"required": True, "min_length": 2, "max_length": 100},
    "description": {"required": False, "max_length": 500},
    "category_id": {"required": True, "type": "int", "min": 1},
    "score": {"required": True, "type": "float", "min": 0, "max": 100},
}  # noqa: E501

# 中国大陆手机号正则（与前端 frontend/src/constants/enums.ts.PHONE_PATTERN 对齐）
PHONE_PATTERN = r"^1[3-9]\d{9}$"


def validate_chinese_phone(value: str, field_name: str = "手机号") -> None:
    """验证中国大陆手机号；空值视为合法（由 required 控制必填）。

    统一全项目手机号格式校验（User.phone / ParentContact.father_phone / mother_phone / Admin.phone），
    消除此前无校验导致的前后不一致。端点接线见 Phase 2。
    """
    if value is None or (isinstance(value, str) and not value.strip()):
        return
    Validator.pattern(
        value, PHONE_PATTERN, field_name, message=f"{field_name}格式不正确（应为 11 位手机号）"
    )


PHONE_SCHEMA = {
    "phone": {
        "required": False,
        "pattern": PHONE_PATTERN,
        "pattern_message": "手机号格式不正确（应为 11 位手机号）",
    },
}
