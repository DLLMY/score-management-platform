#!/usr/bin/env python3
"""
数据库迁移API路由
提供迁移状态查看、执行迁移和回滚等操作
"""

from flask import Blueprint, request, jsonify
from models import db
from utils.permission import requires_admin
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

migration_bp = Blueprint("migration", __name__)


def get_migration_manager():
    from scripts.migration_manager import DatabaseMigrationManager

    return DatabaseMigrationManager()


@migration_bp.route("/api/migration/status")
@requires_admin
def get_migration_status():
    manager = get_migration_manager()
    return jsonify({"success": True, "migrations": manager.status()})


@migration_bp.route("/api/migration/pending")
@requires_admin
def get_pending_migrations():
    manager = get_migration_manager()
    pending = manager.pending_migrations()
    return jsonify({"success": True, "pending_count": len(pending), "pending": pending})


@migration_bp.route("/api/migration/migrate", methods=["POST"])
@requires_admin
def run_migration():
    data = request.get_json() or {}
    target_version = data.get("target_version")

    manager = get_migration_manager()
    success = manager.migrate(db.engine.raw_connection(), target_version)

    if success:
        return jsonify({"success": True, "message": "迁移执行成功"})
    else:
        return jsonify({"success": False, "message": "迁移执行失败"}), 500


@migration_bp.route("/api/migration/rollback", methods=["POST"])
@requires_admin
def run_rollback():
    data = request.get_json() or {}
    steps = data.get("steps", 1)

    manager = get_migration_manager()
    success = manager.rollback(db.engine.raw_connection(), steps)

    if success:
        return jsonify({"success": True, "message": f"回滚 {steps} 步成功"})
    else:
        return jsonify({"success": False, "message": "回滚执行失败"}), 500


@migration_bp.route("/api/migration/seed", methods=["POST"])
@requires_admin
def run_seed():
    data = request.get_json() or {}
    seed_name = data.get("seed_name")

    manager = get_migration_manager()
    success = manager.seed(db.engine.raw_connection(), seed_name)

    if success:
        return jsonify({"success": True, "message": "种子数据导入成功"})
    else:
        return jsonify({"success": False, "message": "种子数据导入失败"}), 500


@migration_bp.route("/api/migration/create", methods=["POST"])
@requires_admin
def create_migration():
    data = request.get_json()
    name = data.get("name")
    description = data.get("description", "")

    if not name:
        return jsonify({"success": False, "message": "迁移名称不能为空"}), 400

    manager = get_migration_manager()
    version_id = manager.create_migration(name, description)

    return jsonify({"success": True, "message": f"迁移 {version_id}_{name} 已创建", "version_id": version_id})
