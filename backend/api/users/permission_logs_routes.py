from flask import request
from flask_restx import Namespace, Resource
from models import PermissionLog
from utils.permission import requires_permission

ns_permission_logs = Namespace("permission-logs", description="权限操作日志相关操作")


@ns_permission_logs.route("/")
class PermissionLogList(Resource):

    @ns_permission_logs.doc("list_permission_logs")
    @requires_permission("user.view")
    def get(self):
        operator_id = request.args.get("operator_id")
        operator_type = request.args.get("operator_type")
        action = request.args.get("action")

        query = PermissionLog.query.order_by(PermissionLog.created_at.desc())

        if operator_id:
            query = query.filter(PermissionLog.operator_id == operator_id)
        if operator_type:
            query = query.filter(PermissionLog.operator_type == operator_type)
        if action:
            query = query.filter(PermissionLog.action == action)

        logs = query.all()
        return [
            {
                "id": log.id,
                "operator_id": log.operator_id,
                "operator_type": log.operator_type,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "description": log.description,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
