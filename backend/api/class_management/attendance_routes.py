from flask_restx import Namespace, Resource, fields
from flask import request
from services.attendance_service import attendance_service
from utils.permission import requires_permission

ns_attendance = Namespace("attendance", description="考勤管理")

attendance_model = ns_attendance.model(
    "AttendanceInput",
    {
        "class_id": fields.Integer(required=True),
        "student_id": fields.Integer(required=True),
        "date": fields.String(),
        "period": fields.String(default="morning"),
        "status": fields.String(default="present"),
        "arrive_time": fields.String(),
        "leave_time": fields.String(),
        "notes": fields.String(),
    },
)

batch_model = ns_attendance.model(
    "BatchAttendanceInput",
    {
        "records": fields.List(fields.Nested(attendance_model)),
    },
)

leave_model = ns_attendance.model(
    "LeaveInput",
    {
        "student_id": fields.Integer(required=True),
        "leave_type": fields.String(default="personal"),
        "start_date": fields.String(required=True),
        "end_date": fields.String(required=True),
        "reason": fields.String(),
    },
)


@ns_attendance.route("/records")
class AttendanceList(Resource):
    @ns_attendance.doc(
        "list_attendance",
        params={
            "class_id": {"description": "班级ID", "type": int},
            "student_id": {"description": "学生ID", "type": int},
            "date": {"description": "日期"},
            "status": {"description": "状态"},
        },
    )
    @requires_permission("attendance.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        student_id = request.args.get("student_id", type=int)
        date = request.args.get("date")
        status = request.args.get("status")
        return attendance_service.list_attendance(
            class_id=class_id,
            student_id=student_id,
            date=date,
            status=status,
        )

    @ns_attendance.expect(attendance_model)
    @requires_permission("attendance.edit")
    def post(self):
        data = request.get_json()
        return attendance_service.record_attendance(data)


@ns_attendance.route("/batch")
class BatchAttendance(Resource):
    @ns_attendance.expect(batch_model)
    @requires_permission("attendance.edit")
    def post(self):
        data = request.get_json()
        return attendance_service.batch_record(data.get("records", []))


@ns_attendance.route("/leaves")
class LeaveList(Resource):
    @ns_attendance.doc(
        "list_leaves",
        params={
            "student_id": {"description": "学生ID", "type": int},
            "status": {"description": "状态"},
        },
    )
    @requires_permission("attendance.view")
    def get(self):
        student_id = request.args.get("student_id", type=int)
        status = request.args.get("status")
        return attendance_service.list_leaves(
            student_id=student_id,
            status=status,
        )

    @ns_attendance.expect(leave_model)
    @requires_permission("attendance.edit")
    def post(self):
        data = request.get_json()
        return attendance_service.apply_leave(data)


@ns_attendance.route("/leaves/<int:leave_id>/approve")
class LeaveApprove(Resource):
    @requires_permission("attendance.approve")
    def post(self, leave_id):
        data = request.get_json() or {}
        approve = data.get("approve", True)
        return attendance_service.approve_leave(leave_id, approve)


@ns_attendance.route("/stats")
class AttendanceStats(Resource):
    @ns_attendance.doc(
        "attendance_stats",
        params={
            "class_id": {"description": "班级ID", "type": int},
            "start_date": {"description": "开始日期"},
            "end_date": {"description": "结束日期"},
        },
    )
    @requires_permission("attendance.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        return attendance_service.get_attendance_stats(
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
        )
