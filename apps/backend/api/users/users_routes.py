from flask import request
from utils.response import APIResponse
from utils.pagination import get_pagination
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config
from models import User, ClassInfo, get_by_id
from utils.permission import (
    requires_permission,
    get_current_admin,
    get_allowed_classes,
    can_access_student,
)
from utils.logger import log_operation
from utils.validation import (
    ValidationRules,
    validate_card_id,
    validate_phone,
    validate_score,
    validate_student_id,
    validate_name,
    validation_error_response,
)
from services.redis_cache_service import get_cache_service
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.class_time_checker import ClassTimeChecker
from services.user_service import user_service
from services.user_list_service import get_user_list_view
from datetime import datetime
import io
import csv
import re
import logging
from flask_restx import Namespace, Resource, fields

logger = logging.getLogger(__name__)

limiter = Limiter(get_remote_address, storage_uri=config.RATELIMIT_STORAGE_URI)
ns_users = Namespace("users", description="学生管理相关操作")

# User 响应字段子集（B3 扩展 2026-08-23，对应原各端点内联 dict；role 为端点硬编码常量由路由补）
USER_CREATE_FIELDS = [
    "id",
    "name",
    "gender",
    "class_name",
    "phone",
    "father_name",
    "father_phone",
    "mother_name",
    "mother_phone",
    "guardian_name",
    "guardian_phone",
    "guardian_relation",
    "card_id",
    "current_score",
    "created_at",
]
USER_DETAIL_FIELDS = [
    "id",
    "name",
    "gender",
    "class_name",
    "phone",
    "father_name",
    "father_phone",
    "mother_name",
    "mother_phone",
    "guardian_name",
    "guardian_phone",
    "guardian_relation",
    "card_id",
    "current_score",
    "is_active",
    "is_blacklisted",
    "created_at",
    "updated_at",
]
USER_BY_CARD_FIELDS = ["id", "name", "gender", "class_name", "phone", "card_id", "current_score"]
login_model = ns_users.model(
    "StudentLogin",
    {
        "username": fields.String(required=True, description="用户名"),
        "password": fields.String(required=True, description="密码"),
    },
)
user_model = ns_users.model(
    "User",
    {
        "id": fields.Integer(readOnly=True, description="学生ID"),
        "name": fields.String(required=True, description="学生姓名"),
        "gender": fields.String(description="性别"),
        "class_name": fields.String(description="班级"),
        "phone": fields.String(description="联系电话"),
        "father_name": fields.String(description="父亲姓名"),
        "father_phone": fields.String(description="父亲电话"),
        "mother_name": fields.String(description="母亲姓名"),
        "mother_phone": fields.String(description="母亲电话"),
        "guardian_name": fields.String(description="监护人姓名"),
        "guardian_phone": fields.String(description="监护人电话"),
        "guardian_relation": fields.String(description="监护关系"),
        "card_id": fields.String(description="卡片ID"),
        "current_score": fields.Float(description="当前积分"),
        "is_active": fields.Boolean(description="账号是否启用"),
        "is_blacklisted": fields.Boolean(description="是否黑名单"),
    },
)
user_list_response = ns_users.model(
    "UserListResponse",
    {
        "users": fields.List(fields.Nested(user_model), description="用户列表"),
        "total": fields.Integer(description="总记录数"),
        "page": fields.Integer(description="当前页码"),
        "per_page": fields.Integer(description="每页数量"),
        "pages": fields.Integer(description="总页数"),
    },
)
batch_score_model = ns_users.model(
    "BatchScoreRequest",
    {
        "ids": fields.List(fields.Integer, required=True, description="用户ID列表"),
        "score_change": fields.Float(required=True, description="积分变化量"),
        "description": fields.String(description="操作描述"),
    },
)

def detect_encoding(content_bytes):
    encodings = ["utf-8-sig", "utf-8", "gbk", "gb2312", "gb18030"]
    for encoding in encodings:
        try:
            content = content_bytes.decode(encoding)
            return content, encoding
        except UnicodeDecodeError:
            continue
    return None, None

def _check_user_create_class_scope(data):
    class_name = data.get("class_name")
    if class_name:
        admin = get_current_admin()
        if admin:
            allowed_classes = get_allowed_classes(admin.id)
            if allowed_classes is not None and class_name not in allowed_classes:
                return APIResponse.error(message="无权为该班级创建学生", status_code=403)
    return None

def _validate_create_user_fields(data):
    errors = []
    errors.extend(_validate_create_user_name(data))
    errors.extend(_validate_create_user_card_id(data))
    errors.extend(_validate_create_user_phones(data))
    errors.extend(_validate_create_user_score(data))
    errors.extend(_validate_create_user_card_unique(data))
    return errors

def _validate_create_user_name(data):
    errors = []
    name = data.get("name")
    if not name or not name.strip():
        errors.append("学生姓名不能为空")
    elif len(name) > ValidationRules.NAME_MAX_LEN:
        errors.append(f"学生姓名长度不能超过{ValidationRules.NAME_MAX_LEN}个字符")
    return errors

def _validate_create_user_card_id(data):
    errors = []
    card_id = data.get("card_id")
    if not card_id or not str(card_id).strip():
        errors.append("卡号不能为空")
    elif card_id:
        is_valid, error_msg = validate_card_id(card_id)
        if not is_valid:
            errors.append(f"卡号: {error_msg}")
    return errors

def _validate_create_user_phones(data):
    errors = []
    phone = data.get("phone")
    if phone:
        is_valid, error_msg = validate_phone(phone)
        if not is_valid:
            errors.append(f"联系电话: {error_msg}")
    father_phone = data.get("father_phone")
    if father_phone:
        is_valid, error_msg = validate_phone(father_phone)
        if not is_valid:
            errors.append(f"父亲电话: {error_msg}")
    mother_phone = data.get("mother_phone")
    if mother_phone:
        is_valid, error_msg = validate_phone(mother_phone)
        if not is_valid:
            errors.append(f"母亲电话: {error_msg}")
    return errors

def _validate_create_user_score(data):
    errors = []
    score = data.get("current_score", 0)
    is_valid, error_msg = validate_score(score)
    if not is_valid:
        errors.append(f"积分: {error_msg}")
    return errors

def _validate_create_user_card_unique(data):
    errors = []
    card_id = data.get("card_id")
    if card_id:
        existing_user = User.query.filter_by(card_id=card_id).first()
        if existing_user:
            errors.append(f"卡号 {card_id} 已被用户 {existing_user.name} 使用")
    return errors

def _validate_import_user(user_data, idx, seen_card_ids):
    row_errors = []
    row_data = user_data.copy()
    row_errors.extend(_validate_import_user_card_id(user_data, seen_card_ids))
    row_errors.extend(_validate_import_user_name(user_data))
    row_errors.extend(_validate_import_user_class(user_data))
    row_errors.extend(_validate_import_user_gender(user_data))
    row_errors.extend(_validate_import_user_phone(user_data))
    if row_errors:
        return None, row_errors, row_data
    card_id = user_data.get("card_id")
    user = _build_import_user(user_data, card_id)
    return user, None, row_data

def _validate_import_user_card_id(user_data, seen_card_ids):
    errors = []
    card_id = user_data.get("card_id")
    if not card_id:
        errors.append({"field": "card_id", "message": "学号不能为空"})
    elif not isinstance(card_id, (int, str)) or len(str(card_id).strip()) == 0:
        errors.append({"field": "card_id", "message": "学号格式无效"})
    elif len(str(card_id).strip()) > 50:
        errors.append({"field": "card_id", "message": "学号长度超过限制（最大50字符）"})
    else:
        card_id_str = str(card_id).strip()
        is_valid, msg = validate_student_id(card_id_str)
        if not is_valid:
            errors.append({"field": "card_id", "message": msg})
    if card_id:
        card_id_norm = str(card_id).strip()
        existing = User.query.filter_by(card_id=card_id_norm).first()
        if existing:
            errors.append({"field": "card_id", "message": f'学号 "{card_id_norm}" 已存在'})
        elif card_id_norm in seen_card_ids:
            errors.append({"field": "card_id", "message": f'学号 "{card_id_norm}" 在本批中重复'})
    return errors

def _validate_import_user_name(user_data):
    errors = []
    name = user_data.get("name")
    if not name:
        errors.append({"field": "name", "message": "姓名不能为空"})
    elif not isinstance(name, str) or len(name.strip()) == 0:
        errors.append({"field": "name", "message": "姓名格式无效，必须为非空字符串"})
    elif len(name.strip()) > 50:
        errors.append({"field": "name", "message": "姓名长度超过限制（最大50字符）"})
    else:
        is_valid, msg = validate_name(name.strip())
        if not is_valid:
            errors.append({"field": "name", "message": msg})
    return errors

def _validate_import_user_class(user_data):
    errors = []
    class_name = user_data.get("class_name")
    if class_name:
        if not isinstance(class_name, str) or len(class_name.strip()) == 0:
            errors.append({"field": "class_name", "message": "班级名称格式无效，必须为非空字符串"})
        elif len(class_name.strip()) > 100:
            errors.append({"field": "class_name", "message": "班级名称长度超过限制（最大100字符）"})
        else:
            class_info = ClassInfo.query.filter_by(name=class_name.strip()).first()
            if not class_info:
                errors.append(
                    {"field": "class_name", "message": f'班级 "{class_name}" 在系统中不存在'}
                )
    return errors

def _validate_import_user_gender(user_data):
    errors = []
    gender = user_data.get("gender")
    if gender and gender not in ["男", "女", "male", "female", "m", "f"]:
        errors.append({"field": "gender", "message": '性别值无效，只能是"男"或"女"'})
    return errors

def _validate_import_user_phone(user_data):
    errors = []
    phone = user_data.get("phone")
    if phone:
        is_valid, msg = validate_phone(str(phone))
        if not is_valid:
            errors.append({"field": "phone", "message": msg})
        else:
            if not re.match(r"^1[3-9]\d{9}$", str(phone).strip()):
                errors.append({"field": "phone", "message": "联系电话格式无效，请输入11位手机号"})
    return errors

def _build_import_user(user_data, card_id):
    return User(
        name=user_data.get("name"),
        gender=user_data.get("gender") or "",
        class_name=user_data.get("class_name") or "",
        phone=user_data.get("phone") or "",
        father_name=user_data.get("father_name", ""),
        father_phone=user_data.get("father_phone", ""),
        mother_name=user_data.get("mother_name", ""),
        mother_phone=user_data.get("mother_phone", ""),
        guardian_name=user_data.get("guardian_name", ""),
        guardian_phone=user_data.get("guardian_phone", ""),
        guardian_relation=user_data.get("guardian_relation", ""),
        card_id=str(card_id),
        current_score=user_data.get("current_score", 0),
    )

_CSV_USER_HEADER_MAPPING = {
    "姓名": "name",
    "性别": "gender",
    "班级": "class_name",
    "电话": "phone",
    "联系电话": "phone",
    "家长信息": "parent_info",
    "父亲姓名": "father_name",
    "父亲电话": "father_phone",
    "母亲姓名": "mother_name",
    "母亲电话": "mother_phone",
    "监护人姓名": "guardian_name",
    "监护人电话": "guardian_phone",
    "监护关系": "guardian_relation",
    "卡片ID": "card_id",
    "饭卡号": "card_id",
    "学号": "card_id",
    "初始积分": "current_score",
    "积分": "current_score",
}

def _check_csv_upload_file(request):
    if "file" not in request.files:
        return None, APIResponse.error(message="请选择文件", status_code=400)
    file = request.files["file"]
    if file.filename == "":
        return None, APIResponse.error(message="请选择文件", status_code=400)
    if not file.filename.lower().endswith(".csv"):
        return None, APIResponse.error(message="请选择CSV格式的文件", status_code=400)
    return file, None

def _read_and_parse_csv(file):
    content_bytes = file.read()
    content, encoding = detect_encoding(content_bytes)
    if content is None:
        return (
            None,
            None,
            APIResponse.error(
                message="无法识别文件编码，请使用UTF-8或GBK编码保存文件", status_code=400
            ),
        )
    lines = content.split("\n")
    if len(lines) == 0:
        return None, None, APIResponse.error(message="文件为空", status_code=400)
    reader = csv.reader(lines)
    rows = list(reader)
    if len(rows) < 2:
        return None, None, APIResponse.error(message="文件没有数据", status_code=400)
    return rows, [h.strip() for h in rows[0]], None

def _build_csv_row_dict(row, headers, mapping):
    row_dict = {}
    row_data = {}
    for i, header in enumerate(headers):
        if header in mapping and i < len(row):
            value = row[i].strip() if row[i] else ""
            row_dict[mapping[header]] = value
            row_data[header] = value
    return row_dict, row_data

def _validate_csv_row(row_dict, allowed_classes):
    row_errors = []
    row_errors.extend(_csv_validate_card_id(row_dict))
    row_errors.extend(_csv_validate_name(row_dict))
    row_errors.extend(_csv_validate_class_name(row_dict, allowed_classes))
    row_errors.extend(_csv_validate_gender(row_dict))
    row_errors.extend(_csv_validate_phones(row_dict))
    row_errors.extend(_csv_validate_score(row_dict))
    return row_errors

def _csv_validate_card_id(row_dict):
    errors = []
    card_id = row_dict.get("card_id", "").strip()
    if not card_id:
        errors.append({"field": "card_id", "message": "学号不能为空"})
    elif not isinstance(card_id, (int, str)) or len(str(card_id).strip()) == 0:
        errors.append({"field": "card_id", "message": "学号格式无效"})
    elif len(str(card_id).strip()) > 50:
        errors.append({"field": "card_id", "message": "学号长度超过限制（最大50字符）"})
    return errors

def _csv_validate_name(row_dict):
    errors = []
    name = row_dict.get("name", "").strip()
    if not name:
        errors.append({"field": "name", "message": "姓名不能为空"})
    elif not isinstance(name, str) or len(name.strip()) == 0:
        errors.append({"field": "name", "message": "姓名格式无效，必须为非空字符串"})
    elif len(name.strip()) > 50:
        errors.append({"field": "name", "message": "姓名长度超过限制（最大50字符）"})
    return errors

def _csv_validate_class_name(row_dict, allowed_classes):
    errors = []
    class_name = row_dict.get("class_name", "").strip()
    if class_name:
        if not isinstance(class_name, str) or len(class_name.strip()) == 0:
            errors.append({"field": "class_name", "message": "班级名称格式无效"})
        elif len(class_name.strip()) > 100:
            errors.append({"field": "class_name", "message": "班级名称长度超过限制（最大100字符）"})
        else:
            class_info = ClassInfo.query.filter_by(name=class_name.strip()).first()
            if not class_info:
                errors.append(
                    {"field": "class_name", "message": f'班级 "{class_name}" 在系统中不存在'}
                )
        if allowed_classes is not None and class_name not in allowed_classes:
            errors.append({"field": "class_name", "message": f'无权为班级 "{class_name}" 导入学生'})
    return errors

def _csv_validate_gender(row_dict):
    errors = []
    gender = row_dict.get("gender", "").strip()
    if gender and gender not in ["男", "女", "male", "female", "m", "f"]:
        errors.append({"field": "gender", "message": '性别格式无效，只能是"男"或"女"'})
    return errors

def _csv_validate_phones(row_dict):
    errors = []
    phone = row_dict.get("phone", "").strip()
    if phone and not re.match(r"^1[3-9]\d{9}$", phone):
        errors.append({"field": "phone", "message": "联系电话格式无效，请输入11位手机号"})
    father_phone = row_dict.get("father_phone", "").strip()
    if father_phone and not re.match(r"^1[3-9]\d{9}$", father_phone):
        errors.append({"field": "father_phone", "message": "父亲电话格式无效，请输入11位手机号"})
    mother_phone = row_dict.get("mother_phone", "").strip()
    if mother_phone and not re.match(r"^1[3-9]\d{9}$", mother_phone):
        errors.append({"field": "mother_phone", "message": "母亲电话格式无效，请输入11位手机号"})
    guardian_phone = row_dict.get("guardian_phone", "").strip()
    if guardian_phone and not re.match(r"^1[3-9]\d{9}$", guardian_phone):
        errors.append(
            {"field": "guardian_phone", "message": "监护人电话格式无效，请输入11位手机号"}
        )
    return errors

def _csv_validate_score(row_dict):
    errors = []
    current_score = row_dict.get("current_score", "0").strip()
    if current_score:
        try:
            current_score_int = int(current_score)
            if current_score_int < 0:
                errors.append({"field": "current_score", "message": "初始积分不能为负数"})
        except ValueError:
            errors.append({"field": "current_score", "message": "初始积分格式无效，必须为整数"})
    return errors

def _build_csv_user(row_dict, current_score_int):
    return User(
        name=row_dict.get("name", "").strip(),
        gender=row_dict.get("gender", "").strip(),
        class_name=row_dict.get("class_name", "").strip(),
        phone=row_dict.get("phone", "").strip(),
        parent_info=row_dict.get("parent_info", ""),
        father_name=row_dict.get("father_name", ""),
        father_phone=row_dict.get("father_phone", ""),
        mother_name=row_dict.get("mother_name", ""),
        mother_phone=row_dict.get("mother_phone", ""),
        guardian_name=row_dict.get("guardian_name", ""),
        guardian_phone=row_dict.get("guardian_phone", ""),
        guardian_relation=row_dict.get("guardian_relation", ""),
        card_id=row_dict.get("card_id", "").strip(),
        current_score=current_score_int,
    )

def _build_csv_user_updates(row_dict, current_score_int):
    spec = [
        ("name", "name"),
        ("gender", "gender"),
        ("class_name", "class_name"),
        ("phone", "phone"),
        ("parent_info", "parent_info"),
        ("father_name", "father_name"),
        ("father_phone", "father_phone"),
        ("mother_name", "mother_name"),
        ("mother_phone", "mother_phone"),
        ("guardian_name", "guardian_name"),
        ("guardian_phone", "guardian_phone"),
        ("guardian_relation", "guardian_relation"),
    ]
    updates = {}
    for src, dst in spec:
        val = row_dict.get(src, "")
        if val:
            updates[dst] = val
    updates["current_score"] = current_score_int
    return updates

import api.users._users_part1
import api.users._users_part2
