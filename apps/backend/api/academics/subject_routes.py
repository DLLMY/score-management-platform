import logging

from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from models import Subject, SubjectClass, ClassInfo, Admin, ImportConfig, get_by_id
from utils.permission import requires_permission
from utils.decorators import safe_handle
from utils.response import APIResponse
from utils.api_cache_middleware import cached_api, invalidate_cache
from datetime import datetime
from services.excel_service import excel_export_service, excel_import_service
from services.academics_service import academics_service
from services.subject_service import (
    get_subject_list_view,
    get_subject_detail_view,
    get_subject_classes_view,
    get_subject_export_data_view,
)
import json
import io

logger = logging.getLogger(__name__)

ns_subjects = Namespace("subjects", description="科目管理")

subject_model = ns_subjects.model(
    "Subject",
    {
        "id": fields.Integer(readOnly=True, description="科目ID"),
        "name": fields.String(required=True, description="科目名称"),
        "code": fields.String(description="科目代码"),
        "grade": fields.String(description="所属年级"),
        "description": fields.String(description="科目描述"),
        "color": fields.String(description="科目颜色"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
        "updated_at": fields.DateTime(readOnly=True, description="更新时间"),
    },
)

subject_response = ns_subjects.model(
    "SubjectResponse",
    {
        "id": fields.Integer(description="科目ID"),
        "name": fields.String(description="科目名称"),
        "code": fields.String(description="科目代码"),
        "grade": fields.String(description="所属年级"),
        "description": fields.String(description="科目描述"),
        "color": fields.String(description="科目颜色"),
        "is_active": fields.Boolean(description="是否启用"),
        "class_count": fields.Integer(description="关联班级数量"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

subject_class_model = ns_subjects.model(
    "SubjectClass",
    {
        "subject_id": fields.Integer(required=True, description="科目ID"),
        "class_info_id": fields.Integer(required=True, description="班级ID"),
        "teacher_id": fields.Integer(description="授课教师ID"),
    },
)

def _resolve_subject_import_config(config_id):
    if config_id:
        return get_by_id(ImportConfig, config_id)
    return ImportConfig.query.filter(
        ImportConfig.import_type == "subjects", ImportConfig.is_active
    ).first()

def _build_subject_import_config(config):
    default_mappings = [
        {
            "source_field": "科目名称",
            "target_field": "name",
            "field_type": "string",
            "required": True,
        },
        {"source_field": "科目代码", "target_field": "code", "field_type": "string"},
        {"source_field": "年级", "target_field": "grade", "field_type": "string"},
        {"source_field": "描述", "target_field": "description", "field_type": "string"},
        {"source_field": "颜色", "target_field": "color", "field_type": "string"},
        {"source_field": "是否启用", "target_field": "is_active", "field_type": "boolean"},
        {
            "source_field": "班级名称",
            "target_field": "class_name",
            "field_type": "string",
            "relation": "class",
        },
        {
            "source_field": "班级ID",
            "target_field": "class_id",
            "field_type": "integer",
            "relation": "class",
        },
        {
            "source_field": "教师姓名",
            "target_field": "teacher_name",
            "field_type": "string",
            "relation": "admin",
        },
        {
            "source_field": "教师ID",
            "target_field": "teacher_id",
            "field_type": "integer",
            "relation": "admin",
        },
    ]
    config_data = config.config_data if config else {}
    field_mappings = (
        config_data.get("field_mappings", default_mappings) if config_data else default_mappings
    )
    validation_rules = config_data.get("validation_rules", []) if config_data else []
    conflict_strategy = config_data.get("conflict_strategy", "update") if config_data else "update"
    default_values = config_data.get("default_values", {}) if config_data else {}
    return (field_mappings, validation_rules, conflict_strategy, default_values)

def _parse_subject_multipart_file(files, field_mappings, default_values):
    if "file" not in files:
        return None, APIResponse.error(message="请上传文件", status_code=400)
    file = files["file"]
    if not file.filename:
        return None, APIResponse.error(message="请选择文件", status_code=400)
    filename = file.filename.lower()
    if filename.endswith(".json"):
        return _parse_subject_json_file(file)
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        return _parse_subject_excel_file(file, field_mappings, default_values)
    else:
        return None, APIResponse.error(message="仅支持 .xlsx、.xls 或 .json 格式", status_code=400)

def _parse_subject_json_file(file):
    file_content = file.read()
    try:
        json_data = json.loads(file_content.decode("utf-8"))
        if isinstance(json_data, list):
            return json_data, None
        elif isinstance(json_data, dict) and "data" in json_data:
            return json_data["data"], None
        else:
            return None, APIResponse.error(
                message="JSON格式错误：应为数组或包含data字段的对象", status_code=400
            )
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.error("%s: %s", "JSON解析失败", e)
        return None, APIResponse.error(message="JSON解析失败", status_code=400)

def _parse_subject_excel_file(file, field_mappings, default_values):
    file_content = file.read()
    parse_result = excel_import_service.parse_excel_file(file_content)
    if not parse_result.get("success"):
        return None, APIResponse.error(
            message=parse_result.get("error", "文件解析失败"), status_code=400
        )
    headers = parse_result.get("headers", [])
    parsed_rows = parse_result.get("data", [])
    import_list = _map_subject_excel_rows(parsed_rows, field_mappings, default_values)
    return import_list, None

def _map_subject_excel_rows(parsed_rows, field_mappings, default_values):
    import_list = []
    for row_idx, row_data in enumerate(parsed_rows):
        mapped_item, row_has_required = _map_subject_row(
            row_data, row_idx, field_mappings, default_values
        )
        if not row_has_required:
            import_list.append(
                {
                    "__error__": True,
                    "__message__": f'第{row_idx + 2}行: 缺少必填字段"科目名称"',
                }
            )
        elif mapped_item.get("name"):
            import_list.append(mapped_item)
    return import_list

def _map_subject_row(row_data, row_idx, field_mappings, default_values):
    mapped_item = {}
    row_has_required = True
    for mapping in field_mappings:
        source_val = row_data.get(mapping["source_field"])
        target_field = mapping["target_field"]
        field_type = mapping.get("field_type", "string")
        if source_val is None or source_val == "":
            if mapping.get("required"):
                row_has_required = False
                break
            source_val = mapping.get("default_value", default_values.get(target_field))
        if field_type == "boolean":
            if isinstance(source_val, str):
                mapped_item[target_field] = source_val in ["是", "true", "True", "1"]
            else:
                mapped_item[target_field] = bool(source_val)
        else:
            mapped_item[target_field] = source_val
    return mapped_item, row_has_required

import api.academics._subject_part1
import api.academics._subject_part2
