# -*- coding: utf-8 -*-
# part of api/users/users_routes.py (D2 split)

from flask import request
from utils.response import APIResponse
from utils.pagination import get_pagination
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
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

from api.users.users_routes import logger, limiter, ns_users, USER_CREATE_FIELDS, USER_DETAIL_FIELDS, USER_BY_CARD_FIELDS, login_model, user_model, user_list_response, batch_score_model, detect_encoding, _check_user_create_class_scope, _validate_create_user_fields, _validate_create_user_name, _validate_create_user_card_id, _validate_create_user_phones, _validate_create_user_score, _validate_create_user_card_unique, _validate_import_user, _validate_import_user_card_id, _validate_import_user_name, _validate_import_user_class, _validate_import_user_gender, _validate_import_user_phone, _build_import_user, _CSV_USER_HEADER_MAPPING, _check_csv_upload_file, _read_and_parse_csv, _build_csv_row_dict, _validate_csv_row, _csv_validate_card_id, _csv_validate_name, _csv_validate_class_name, _csv_validate_gender, _csv_validate_phones, _csv_validate_score, _build_csv_user, _build_csv_user_updates

@ns_users.route("/template/download")
class UserTemplate(Resource):
    @ns_users.doc("download_user_template", description="下载导入模板", security="Bearer")
    @requires_permission("student.view")
    def get(self):
        """
        下载CSV导入模板
        下载学生批量导入的CSV模板文件。
        """
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "姓名",
                "性别",
                "班级",
                "联系电话",
                "卡片ID",
                "父亲姓名",
                "父亲电话",
                "母亲姓名",
                "母亲电话",
                "监护人姓名",
                "监护人电话",
                "监护关系",
                "初始积分",
            ]
        )
        writer.writerow(
            [
                "张三",
                "男",
                "一年一班",
                "13800138000",
                "CARD001",
                "张父",
                "13900139000",
                "张母",
                "13700137000",
                "",
                "",
                "",
                "60",
            ]
        )
        output.seek(0)
        from flask import send_file

        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name="user_import_template.csv",
        )

@ns_users.route("/import-file", methods=["POST"])
class UserImportFile(Resource):
    @ns_users.doc("import_users_file", description="通过CSV文件批量导入学生", security="Bearer")
    @ns_users.response(200, "导入完成")
    @ns_users.response(400, "文件错误")
    @requires_permission("student.create")
    def post(self):
        """
        通过CSV文件批量导入学生
        上传CSV文件批量导入学生数据。支持UTF-8和GBK编码。
        非管理员用户只能为关联班级导入学生。
        请求：multipart/form-data
        - file: CSV文件
        CSV文件格式：
        姓名,性别,班级,联系电话,卡片ID,父亲姓名,父亲电话,母亲姓名,母亲电话,监护人姓名,监护人电话,监护关系,初始积分
        返回导入结果，包含新增、更新数量和错误信息。
        """
        admin = get_current_admin()
        allowed_classes = get_allowed_classes(admin.id) if admin else None
        file, err = _check_csv_upload_file(request)
        if err is not None:
            return err
        rows, headers, err = _read_and_parse_csv(file)
        if err is not None:
            return err
        mapping = _CSV_USER_HEADER_MAPPING
        imported = 0
        updated = 0
        errors = []
        messages = []
        pending_users = []
        pending_updates = []
        try:
            for idx, row in enumerate(rows[1:]):
                try:
                    row_dict, row_data = _build_csv_row_dict(row, headers, mapping)
                    row_errors = _validate_csv_row(row_dict, allowed_classes)
                    if row_errors:
                        error_count = len(errors)
                        error_msg = "; ".join(
                            [f'{err2["field"]}: {err2["message"]}' for err2 in row_errors]
                        )
                        errors.append(
                            {
                                "row": idx + 2,
                                "message": error_msg,
                                "row_data": row_data,
                                "error_fields": [err2["field"] for err2 in row_errors],
                            }
                        )
                        messages.append(
                            {
                                "name": row_dict.get("name", "")
                                or row_dict.get("card_id", "")
                                or "未知",
                                "action": "failed",
                                "message": error_msg,
                                "row_data": row_data,
                                "error_fields": [err2["field"] for err2 in row_errors],
                            }
                        )
                        continue
                    name = row_dict.get("name", "").strip()
                    card_id = row_dict.get("card_id", "").strip()
                    class_name = row_dict.get("class_name", "").strip()
                    gender = row_dict.get("gender", "").strip()
                    phone = row_dict.get("phone", "").strip()
                    score_str = row_dict.get("current_score", "0").strip()
                    current_score_int = int(score_str) if score_str else 0
                    existing = User.query.filter_by(card_id=card_id).first()
                    if existing:
                        updates = _build_csv_user_updates(row_dict, current_score_int)
                        pending_updates.append((existing.id, updates))
                        updated += 1
                        messages.append(
                            {
                                "name": name,
                                "action": "updated",
                                "message": f'学生"{name}"信息更新成功',
                            }
                        )
                    else:
                        user = _build_csv_user(row_dict, current_score_int)
                        pending_users.append(user)
                        imported += 1
                        messages.append(
                            {"name": name, "action": "created", "message": f'学生"{name}"导入成功'}
                        )
                except Exception as e:
                    error_count = len(errors)
                    error_msg = str(e)
                    errors.append(
                        {
                            "row": idx + 2,
                            "message": error_msg,
                            "row_data": row_data if "row_data" in locals() else None,
                            "error_fields": ["system"],
                        }
                    )
                    messages.append(
                        {
                            "name": (
                                row_dict.get("name", "") or row_dict.get("card_id", "") or "未知"
                                if "row_dict" in locals()
                                else "未知"
                            ),
                            "action": "failed",
                            "message": error_msg,
                            "row_data": row_data if "row_data" in locals() else None,
                            "error_fields": ["system"],
                        }
                    )
        except Exception as e:
            logger.error("%s: %s", "导入失败", e, exc_info=True)
            return APIResponse.error(message="导入失败", status_code=500)
        user_service.apply_csv_import(pending_users, pending_updates)
        failed_count = len(errors)
        invalidate_cache("api:/api/users/*")
        return APIResponse.success(
            data={
                "total": imported + updated + failed_count,
                "success_count": imported + updated,
                "failed_count": failed_count,
                "imported": imported,
                "updated": updated,
                "errors": errors,
                "messages": messages,
            },
            message=f"导入完成: 新增{imported}条, 更新{updated}条, 失败{failed_count}条",
        )
