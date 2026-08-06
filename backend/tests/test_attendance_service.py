import pytest
import uuid
from datetime import date, timedelta
from models import db
from models.attendance import Attendance, LeaveApplication
from services.attendance_service import attendance_service


class TestAttendanceService:
    def test_record_attendance(self, app, db_session):
        result = attendance_service.record_attendance({
            "class_id": 1, "student_id": 10, "status": "present"
        })
        assert result[0]["success"] is True
        assert result[1] == 201

    def test_list_attendance(self, app, db_session):
        attendance_service.record_attendance({"class_id": 1, "student_id": 10, "status": "present"})
        result = attendance_service.list_attendance(class_id=1)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_apply_leave(self, app, db_session):
        result = attendance_service.apply_leave({
            "student_id": 10, "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=2)).isoformat(),
            "leave_type": "sick", "reason": "感冒发烧"
        })
        assert result[0]["success"] is True

    def test_approve_leave(self, app, db_session):
        apply_result = attendance_service.apply_leave({
            "student_id": 10, "start_date": date.today().isoformat(),
            "end_date": date.today().isoformat(), "leave_type": "personal"
        })
        leave_id = apply_result[0]["data"]["id"]
        result = attendance_service.approve_leave(leave_id, approve=True)
        assert result["success"] is True
        assert result["data"]["status"] == "approved"

    def test_get_stats(self, app, db_session):
        # 使用唯一 class_id，避免与同文件其他用例（均使用 class_id=1）在共享
        # :memory: DB 中留下的考勤记录相互污染，使 total 断言稳定。
        class_id = abs(hash(uuid.uuid4())) % 1000000
        attendance_service.record_attendance({"class_id": class_id, "student_id": 10, "status": "present"})
        attendance_service.record_attendance({"class_id": class_id, "student_id": 11, "status": "absent"})
        result = attendance_service.get_attendance_stats(class_id=class_id)
        assert result["success"] is True
        assert result["data"]["total"] == 2
