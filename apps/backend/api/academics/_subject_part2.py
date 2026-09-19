# -*- coding: utf-8 -*-
# part of api/academics/subject_routes.py (D2 split)

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

from api.academics.subject_routes import logger, ns_subjects, subject_model, subject_response, subject_class_model, _resolve_subject_import_config, _build_subject_import_config, _parse_subject_multipart_file, _parse_subject_json_file, _parse_subject_excel_file, _map_subject_excel_rows, _map_subject_row

@ns_subjects.route("/template")
class SubjectTemplate(Resource):

    @ns_subjects.doc("download_subject_template", description="下载科目导入模板")
    @requires_permission("score.view")
    def get(self):
        """下载科目导入模板"""
        headers = [
            "科目名称",
            "科目代码",
            "年级",
            "描述",
            "颜色",
            "是否启用",
            "班级名称",
            "教师姓名",
        ]
        sample_data = [
            {
                "科目名称": "数学",
                "科目代码": "MATH001",
                "年级": "高一",
                "描述": "必修课程",
                "颜色": "#10B981",
                "是否启用": "是",
                "班级名称": "高一1班",
                "教师姓名": "张老师",
            }
        ]

        buf = excel_export_service.export_to_excel(
            data=sample_data,
            headers=headers,
            filename="subjects_template",
            sheet_name="科目导入模板",
        )

        filename = excel_export_service._sanitize_filename("subjects_import_template.xlsx")
        return send_file(
            buf,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=filename,
        )

@ns_subjects.route("/import")
class SubjectImport(Resource):

    @ns_subjects.doc("import_subjects", description="导入科目数据")
    @requires_permission("score.entry")
    def post(self):
        """从JSON或Excel文件导入科目数据（支持配置映射）"""
        content_type = request.content_type or ""
        config = _resolve_subject_import_config(request.args.get("config_id", type=int))
        (
            field_mappings,
            validation_rules,
            conflict_strategy,
            default_values,
        ) = _build_subject_import_config(config)
        import_list = []
        if "multipart/form-data" in content_type:
            import_list, err = _parse_subject_multipart_file(
                request.files, field_mappings, default_values
            )
            if err is not None:
                return err
        elif "application/json" in content_type:
            data = request.json
            if not data or "data" not in data:
                return APIResponse.error(message="导入数据格式错误", status_code=400)
            import_list = data["data"]
        else:
            return APIResponse.error(message="不支持的文件格式", status_code=400)
        result = academics_service.execute_subject_import(
            import_list=import_list,
            validation_rules=validation_rules,
            conflict_strategy=conflict_strategy,
        )
        invalidate_cache("api:/api/subjects/*")
        return result

@ns_subjects.route("/order")
class SubjectOrder(Resource):
    @ns_subjects.doc("update_subject_order", description="更新科目排列顺序")
    @requires_permission("score.manage")
    @safe_handle(message="操作失败，请稍后重试", default_status=400)
    def put(self):
        """批量更新科目排序"""
        data = request.get_json()
        if not data or not isinstance(data, list):
            return APIResponse.error(message="无效数据: 应为 [{id, order}] 列表", status_code=400)
        academics_service.update_subject_order(data)
        invalidate_cache("api:/api/subjects/*")
        return APIResponse.success(message="排序更新成功")
