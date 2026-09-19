# -*- coding: utf-8 -*-
# part of api/data/import_export_routes.py (D2 split)

from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from models import User, ScoreRule, ScoreCategory, ScoreRecord
from utils.permission import requires_permission
from utils.response import APIResponse
from utils.decorators import safe_handle
from utils.excel_utils import ExcelUtils, ExcelTemplateGenerator
from utils.backup_utils import BackupManager, BackupScheduler
from utils.transaction_retry import get_import_guard
from services.import_export_service import (
    bulk_import_users,
    bulk_import_rules,
    bulk_import_categories,
    ImportCommitError,
)
from datetime import datetime
import logging
import io
import os

from api.data.import_export_routes import logger, ns_import_export, export_response, import_response, backup_response, backup_list_response, backup_manager, backup_scheduler

@ns_import_export.route("/export/users")
class ExportUsers(Resource):

    @ns_import_export.doc("export_users", params={"format": "导出格式: excel 或 csv，默认excel"})
    @requires_permission("report.export")
    def get(self):
        """导出用户数据"""
        export_format = request.args.get("format", "excel").lower()

        users = User.query.all()
        headers = ["ID", "姓名", "性别", "班级", "联系电话", "饭卡号", "当前积分", "创建时间"]

        data = []
        for user in users:
            data.append(
                [
                    user.id,
                    user.name,
                    user.gender,
                    user.class_name,
                    user.phone,
                    user.card_id,
                    user.current_score,
                    user.created_at.strftime("%Y-%m-%d %H:%M:%S") if user.created_at else "",
                ]
            )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if export_format == "csv":
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype="text/csv",
                as_attachment=True,
                download_name=f"users_{timestamp}.csv",
            )
        sheets = [{"name": "用户数据", "headers": headers, "data": data}]
        content = ExcelUtils.export_to_excel(sheets)
        return send_file(
            io.BytesIO(content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"users_{timestamp}.xlsx",
        )

@ns_import_export.route("/export/records")
class ExportRecords(Resource):

    @ns_import_export.doc(
        "export_records", params={"format": "导出格式", "user_id": "按用户ID筛选"}
    )
    @requires_permission("report.export")
    def get(self):
        """导出积分记录"""
        export_format = request.args.get("format", "excel").lower()
        user_id = request.args.get("user_id")

        query = ScoreRecord.query
        if user_id:
            query = query.filter_by(student_id=int(user_id))
        # S3 修复: 班主任仅可导出本班记录（原全校 → 越权）
        from utils.permission import get_current_admin, get_allowed_classes
        from models import User as _U

        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed = get_allowed_classes(admin.id)
            if allowed:
                query = query.join(_U, ScoreRecord.student_id == _U.id).filter(
                    _U.class_name.in_(allowed)
                )
            else:
                query = query.filter(False)

        records = query.all()
        headers = [
            "ID",
            "学生ID",
            "学生姓名",
            "规则ID",
            "规则名称",
            "积分变化",
            "描述",
            "操作人",
            "创建时间",
        ]

        data = []
        for record in records:
            data.append(
                [
                    record.id,
                    record.student_id,
                    record.user.name if record.user else "",
                    record.rule_id,
                    record.rule.name if record.rule else "",
                    record.score_change,
                    record.description,
                    record.operator,
                    record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
                ]
            )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if export_format == "csv":
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype="text/csv",
                as_attachment=True,
                download_name=f"records_{timestamp}.csv",
            )
        sheets = [{"name": "积分记录", "headers": headers, "data": data}]
        content = ExcelUtils.export_to_excel(sheets)
        return send_file(
            io.BytesIO(content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"records_{timestamp}.xlsx",
        )

@ns_import_export.route("/export/rules")
class ExportRules(Resource):

    @ns_import_export.doc("export_rules", params={"format": "导出格式"})
    @requires_permission("report.export")
    def get(self):
        """导出规则数据"""
        export_format = request.args.get("format", "excel").lower()

        rules = ScoreRule.query.all()
        headers = [
            "ID",
            "规则名称",
            "描述",
            "分类ID",
            "分类名称",
            "分数",
            "是否启用",
            "每日上限",
            "最小间隔",
            "创建时间",
        ]

        data = []
        for rule in rules:
            data.append(
                [
                    rule.id,
                    rule.name,
                    rule.description,
                    rule.category_id,
                    rule.category.name if rule.category else "",
                    rule.score,
                    "是" if rule.is_active else "否",
                    rule.daily_limit,
                    rule.min_interval,
                    rule.created_at.strftime("%Y-%m-%d %H:%M:%S") if rule.created_at else "",
                ]
            )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if export_format == "csv":
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype="text/csv",
                as_attachment=True,
                download_name=f"rules_{timestamp}.csv",
            )
        sheets = [{"name": "积分规则", "headers": headers, "data": data}]
        content = ExcelUtils.export_to_excel(sheets)
        return send_file(
            io.BytesIO(content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"rules_{timestamp}.xlsx",
        )

@ns_import_export.route("/export/categories")
class ExportCategories(Resource):

    @ns_import_export.doc("export_categories", params={"format": "导出格式"})
    @requires_permission("report.export")
    def get(self):
        """导出分类数据"""
        export_format = request.args.get("format", "excel").lower()

        categories = ScoreCategory.query.all()
        headers = ["ID", "分类名称", "描述", "颜色", "创建时间"]

        data = []
        for category in categories:
            data.append(
                [
                    category.id,
                    category.name,
                    category.description,
                    category.color,
                    (
                        category.created_at.strftime("%Y-%m-%d %H:%M:%S")
                        if category.created_at
                        else ""
                    ),
                ]
            )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if export_format == "csv":
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype="text/csv",
                as_attachment=True,
                download_name=f"categories_{timestamp}.csv",
            )
        sheets = [{"name": "积分分类", "headers": headers, "data": data}]
        content = ExcelUtils.export_to_excel(sheets)
        return send_file(
            io.BytesIO(content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"categories_{timestamp}.xlsx",
        )

@ns_import_export.route("/template/user")
class DownloadUserTemplate(Resource):

    @ns_import_export.doc("download_user_template")
    @requires_permission("report.import")
    def get(self):
        """下载用户导入模板"""
        content = ExcelTemplateGenerator.generate_template("user")
        return send_file(
            io.BytesIO(content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="user_import_template.xlsx",
        )

@ns_import_export.route("/template/rule")
class DownloadRuleTemplate(Resource):

    @ns_import_export.doc("download_rule_template")
    @requires_permission("report.import")
    def get(self):
        """下载规则导入模板"""
        content = ExcelTemplateGenerator.generate_template("rule")
        return send_file(
            io.BytesIO(content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="rule_import_template.xlsx",
        )

@ns_import_export.route("/template/category")
class DownloadCategoryTemplate(Resource):

    @ns_import_export.doc("download_category_template")
    @requires_permission("report.import")
    def get(self):
        """下载分类导入模板"""
        content = ExcelTemplateGenerator.generate_template("category")
        return send_file(
            io.BytesIO(content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="category_import_template.xlsx",
        )
