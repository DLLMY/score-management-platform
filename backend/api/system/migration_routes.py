import os
import sys
from flask import Blueprint, request
from models import db
from utils.response import APIResponse
from utils.permission import requires_permission

"""
数据库迁移API路由
提供迁移状态查看、执行迁移和回滚等操作
"""
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
migration_bp = Blueprint("migration", __name__)


def get_migration_manager():
    from scripts.migration_manager import DatabaseMigrationManager

    return DatabaseMigrationManager()


@migration_bp.route("/api/migration/status")
@requires_permission("system.settings")
def get_migration_status():
    manager = get_migration_manager()
    return APIResponse.success(data={"migrations": manager.status()})


@migration_bp.route("/api/migration/pending")
@requires_permission("system.settings")
def get_pending_migrations():
    manager = get_migration_manager()
    pending = manager.pending_migrations()
    return APIResponse.success(data={"pending_count": len(pending), "pending": pending})


@migration_bp.route("/api/migration/migrate", methods=["POST"])
@requires_permission("system.settings")
def run_migration():
    data = request.get_json() or {}
    target_version = data.get("target_version")
    manager = get_migration_manager()
    success = manager.migrate(db.engine.raw_connection(), target_version)
    if success:
        return APIResponse.success(message="Migration executed successfully")
    else:
        return APIResponse.error(message="Migration failed", status_code=500)


@migration_bp.route("/api/migration/rollback", methods=["POST"])
@requires_permission("system.settings")
def run_rollback():
    data = request.get_json() or {}
    steps = data.get("steps", 1)
    manager = get_migration_manager()
    success = manager.rollback(db.engine.raw_connection(), steps)
    if success:
        return APIResponse.success(message=f"Rollback {steps} steps successful")
    else:
        return APIResponse.error(message="Rollback failed", status_code=500)


@migration_bp.route("/api/migration/seed", methods=["POST"])
@requires_permission("system.settings")
def run_seed():
    data = request.get_json() or {}
    seed_name = data.get("seed_name")
    manager = get_migration_manager()
    success = manager.seed(db.engine.raw_connection(), seed_name)
    if success:
        return APIResponse.success(message="Seed data imported successfully")
    else:
        return APIResponse.error(message="Seed data import failed", status_code=500)


@migration_bp.route("/api/migration/create", methods=["POST"])
@requires_permission("system.settings")
def create_migration():
    data = request.get_json()
    name = data.get("name")
    description = data.get("description", "")
    if not name:
        return APIResponse.error(message="Migration name cannot be empty", status_code=400)
    manager = get_migration_manager()
    version_id = manager.create_migration(name, description)
    return APIResponse.success(message=f"Migration {version_id}_{name} created", data={"version_id": version_id})
