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

logger = logging.getLogger(__name__)

ns_import_export = Namespace("import_export", description="数据导入导出相关操作")

# 响应模型
export_response = ns_import_export.model(
    "ExportResponse",
    {
        "success": fields.Boolean(required=True),
        "message": fields.String(required=True),
        "filename": fields.String(),
        "record_count": fields.Integer(),
    },
)

import_response = ns_import_export.model(
    "ImportResponse",
    {
        "success": fields.Boolean(required=True),
        "message": fields.String(required=True),
        "imported_count": fields.Integer(),
        "failed_count": fields.Integer(),
        "errors": fields.List(fields.String),
    },
)

backup_response = ns_import_export.model(
    "BackupResponse",
    {
        "success": fields.Boolean(required=True),
        "message": fields.String(required=True),
        "filename": fields.String(),
        "path": fields.String(),
        "size": fields.Integer(),
        "type": fields.String(),
        "timestamp": fields.String(),
    },
)

backup_list_response = ns_import_export.model(
    "BackupListResponse",
    {
        "filename": fields.String(),
        "path": fields.String(),
        "size": fields.Integer(),
        "created_at": fields.String(),
        "type": fields.String(),
    },
)

# 初始化备份管理器和调度器
backup_manager = BackupManager()
backup_scheduler = BackupScheduler(backup_manager)
# ==================== 导出API ====================

# ==================== 模板下载API ====================

# ==================== 导入API ====================

# ==================== 备份API ====================

import api.data._import_export_part1
import api.data._import_export_part2
