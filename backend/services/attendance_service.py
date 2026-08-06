from datetime import datetime, date, timedelta
from models import db
from models.attendance import Attendance, LeaveApplication
from utils.permission import get_current_admin
from utils.datetime_utils import parse_date, parse_datetime
from services.entity_names import names


class AttendanceService:
    def list_attendance(self, class_id=None, student_id=None, date=None, status=None):
        query = Attendance.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if student_id:
            query = query.filter_by(student_id=student_id)
        if date:
            query = query.filter_by(date=date)
        if status:
            query = query.filter_by(status=status)
        records = query.order_by(Attendance.date.desc()).all()
        return {"success": True, "data": [self._build_attendance_response(r) for r in records]}

    def record_attendance(self, data):
        if not isinstance(data, dict):
            return {"success": False, "message": "请求体必须是 JSON 对象"}, 400
        missing = [k for k in ("class_id", "student_id") if not data.get(k)]
        if missing:
            return {"success": False, "message": "缺少必填字段: " + ", ".join(missing)}, 400
        admin = get_current_admin()
        record = Attendance(
            class_id=data["class_id"],
            student_id=data["student_id"],
            date=parse_date(data.get("date", date.today())),
            period=data.get("period", "morning"),
            status=data.get("status", "present"),
            arrive_time=parse_datetime(data.get("arrive_time")),
            leave_time=parse_datetime(data.get("leave_time")),
            recorded_by=admin.id if admin else None,
            notes=data.get("notes"),
        )
        db.session.add(record)
        db.session.commit()
        return {"success": True, "data": self._build_attendance_response(record)}, 201

    def batch_record(self, records_data):
        if not isinstance(records_data, list):
            return {"success": False, "message": "请求体必须是记录数组"}, 400
        for i, data in enumerate(records_data):
            if not isinstance(data, dict):
                return {"success": False, "message": f"第 {i+1} 条记录格式错误"}, 400
            missing = [k for k in ("class_id", "student_id") if not data.get(k)]
            if missing:
                return {"success": False, "message": f"第 {i+1} 条记录缺少必填字段: " + ", ".join(missing)}, 400
        admin = get_current_admin()
        created = []
        for data in records_data:
            record = Attendance(
                class_id=data["class_id"],
                student_id=data["student_id"],
                date=parse_date(data.get("date", date.today())),
                period=data.get("period", "morning"),
                status=data.get("status", "present"),
                arrive_time=parse_datetime(data.get("arrive_time")),
                leave_time=parse_datetime(data.get("leave_time")),
                recorded_by=admin.id if admin else None,
            )
            db.session.add(record)
            created.append(record)
        db.session.commit()
        return {"success": True, "data": {"count": len(created)}}

    def list_leaves(self, student_id=None, status=None):
        query = LeaveApplication.query
        if student_id:
            query = query.filter_by(student_id=student_id)
        if status:
            query = query.filter_by(status=status)
        leaves = query.order_by(LeaveApplication.start_date.desc()).all()
        return {"success": True, "data": [self._build_leave_response(leave) for leave in leaves]}

    def apply_leave(self, data):
        leave = LeaveApplication(
            student_id=data["student_id"],
            leave_type=data.get("leave_type", "personal"),
            start_date=parse_date(data["start_date"]),
            end_date=parse_date(data["end_date"]),
            reason=data.get("reason"),
        )
        db.session.add(leave)
        db.session.commit()
        return {"success": True, "data": self._build_leave_response(leave)}, 201

    def approve_leave(self, leave_id, approve=True):
        leave = LeaveApplication.query.get(leave_id)
        if not leave:
            return {"success": False, "message": "请假申请不存在"}, 404
        admin = get_current_admin()
        leave.status = "approved" if approve else "rejected"
        leave.approved_by = admin.id if admin else None
        leave.approved_at = datetime.now()
        db.session.commit()
        return {"success": True, "data": self._build_leave_response(leave)}

    def get_attendance_stats(self, class_id, start_date=None, end_date=None):
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()

        records = Attendance.query.filter(
            Attendance.class_id == class_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date,
        ).all()

        total = len(records)
        present = len([r for r in records if r.status == "present"])
        absent = len([r for r in records if r.status == "absent"])
        late = len([r for r in records if r.status == "late"])
        leave = len([r for r in records if r.status == "leave"])

        return {
            "success": True,
            "data": {
                "total": total,
                "present": present,
                "absent": absent,
                "late": late,
                "leave": leave,
                "attendance_rate": round(present / max(total, 1) * 100, 1),
            },
        }

    def _build_attendance_response(self, r):
        return {
            "id": r.id,
            "class_id": r.class_id,
            "class_name": names.klass(r.class_id),
            "student_id": r.student_id,
            "student_name": names.student(r.student_id),
            "date": r.date.isoformat() if r.date else None,
            "period": r.period,
            "status": r.status,
            "arrive_time": r.arrive_time.isoformat() if r.arrive_time else None,
            "leave_time": r.leave_time.isoformat() if r.leave_time else None,
            "notes": r.notes,
        }

    def _build_leave_response(self, leave):
        return {
            "id": leave.id,
            "student_id": leave.student_id,
            "student_name": names.student(leave.student_id),
            "leave_type": leave.leave_type,
            "start_date": leave.start_date.isoformat() if leave.start_date else None,
            "end_date": leave.end_date.isoformat() if leave.end_date else None,
            "reason": leave.reason,
            "status": leave.status,
            "approved_at": leave.approved_at.isoformat() if leave.approved_at else None,
        }


attendance_service = AttendanceService()
