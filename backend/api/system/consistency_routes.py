from flask_restx import Namespace, Resource, fields
from services.data_consistency_checker import DataConsistencyChecker
from services.class_migration_service import ClassMigrationService
from utils.permission import requires_permission
from utils.response import APIResponse
import logging

"""数据一致性校验 API"""
logger = logging.getLogger(__name__)
ns_consistency = Namespace("consistency", description="Data Consistency Check")
issue_model = ns_consistency.model(
    "Issue",
    {
        "type": fields.String(description="Issue type"),
        "severity": fields.String(description="Severity level"),
        "model": fields.String(description="Related model"),
        "id": fields.Integer(description="Record ID"),
        "message": fields.String(description="Issue description"),
    },
)
stats_model = ns_consistency.model(
    "Stats",
    {
        "total": fields.Integer(description="Total count"),
        "linked": fields.Integer(description="Linked count"),
        "unlinked": fields.Integer(description="Unlinked count"),
        "link_rate": fields.String(description="Link rate"),
    },
)


@ns_consistency.route("/check")
class ConsistencyCheck(Resource):
    @ns_consistency.doc("check_data_consistency", description="Run data consistency check")
    @requires_permission("system.settings")
    def get(self):
        """Execute consistency check"""
        try:
            checker = DataConsistencyChecker()
            result = checker.check_all()  # noqa: F841
            return APIResponse.success(
                data={
                    "timestamp": result["timestamp"],
                    "total_issues": result["total_issues"],
                    "healthy": result["healthy"],
                    "issues": result["issues"][:100],
                    "stats": result["stats"],
                }
            )
        except Exception as e:
            logger.error(f"Consistency check failed: {e}")
            return APIResponse.error(message=str(e), status_code=500)


@ns_consistency.route("/report")
class ConsistencyReport(Resource):
    @ns_consistency.doc("get_consistency_report", description="Get consistency report")
    @requires_permission("system.settings")
    def get(self):
        """Get consistency report"""
        try:
            checker = DataConsistencyChecker()
            report = checker.generate_report()
            return APIResponse.success(data={"report": report})
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            return APIResponse.error(message=str(e), status_code=500)


@ns_consistency.route("/fix", methods=["POST"])
class ConsistencyFix(Resource):
    @ns_consistency.doc("fix_data_consistency", description="Fix data consistency issues")
    @requires_permission("system.settings")
    def post(self):
        """Execute data fix"""
        try:
            service = ClassMigrationService()
            result = service.run_full_migration()  # noqa: F841
            return APIResponse.success(
                data={"stats": result["stats"]}, message="Data fix completed"
            )
        except Exception as e:
            logger.error(f"Data fix failed: {e}")
            return APIResponse.error(message=str(e), status_code=500)


@ns_consistency.route("/status")
class ConsistencyStatus(Resource):
    @ns_consistency.doc("get_consistency_status", description="Get migration status")
    @requires_permission("system.settings")
    def get(self):
        """Get migration status"""
        try:
            service = ClassMigrationService()
            status = service.get_migration_status()
            return APIResponse.success(data={"status": status})
        except Exception as e:
            logger.error(f"Get status failed: {e}")
            return APIResponse.error(message=str(e), status_code=500)
