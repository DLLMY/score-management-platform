import pytest
import uuid
from datetime import date, timedelta
from models import db
from models import ClassInfo, User
from models.attendance import Attendance, LeaveApplication
from services.attendance_service import attendance_service


@pytest.fixture
def test_class(db_session):
    """真实班级（record_attendance 校验需要 class_id 存在）。"""
    c = ClassInfo(name=f"考勤班-{uuid.uuid4()}", grade="高一")
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture
def test_student(db_session):
    """真实学生（record/apply 校验需要 student_id 存在）。"""
    u = User(name=f"考勤生-{uuid.uuid4()}", card_id=f"KA{uuid.uuid4().hex[:12]}")
    db_session.add(u)
    db_session.commit()
    return u


class TestAttendanceService:
    def test_record_attendance(self, app, db_session, test_class, test_student):
        result = attendance_service.record_attendance({
            "class_id": test_class.id, "student_id": test_student.id, "status": "present"
        })
        assert result[0]["success"] is True
        assert result[1] == 201

    def test_list_attendance(self, app, db_session, test_class, test_student):
        attendance_service.record_attendance({"class_id": test_class.id, "student_id": test_student.id, "status": "present"})
        result = attendance_service.list_attendance(class_id=test_class.id)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_apply_leave(self, app, db_session, test_student):
        result = attendance_service.apply_leave({
            "student_id": test_student.id, "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=2)).isoformat(),
            "leave_type": "sick", "reason": "感冒发烧"
        })
        assert result[0]["success"] is True

    def test_approve_leave(self, app, db_session, test_student):
        apply_result = attendance_service.apply_leave({
            "student_id": test_student.id, "start_date": date.today().isoformat(),
            "end_date": date.today().isoformat(), "leave_type": "personal"
        })
        leave_id = apply_result[0]["data"]["id"]
        result = attendance_service.approve_leave(leave_id, approve=True)
        assert result["success"] is True
        assert result["data"]["status"] == "approved"

    def test_get_stats(self, app, db_session, test_class):
        # 每个测试类实例的 test_class fixture 独立，避免记录相互污染
        stu1 = User(name=f"考勤生1-{uuid.uuid4()}", card_id=f"KB{uuid.uuid4().hex[:12]}")
        stu2 = User(name=f"考勤生2-{uuid.uuid4()}", card_id=f"KC{uuid.uuid4().hex[:12]}")
        db_session.add_all([stu1, stu2])
        db_session.commit()
        attendance_service.record_attendance({"class_id": test_class.id, "student_id": stu1.id, "status": "present"})
        attendance_service.record_attendance({"class_id": test_class.id, "student_id": stu2.id, "status": "absent"})
        result = attendance_service.get_attendance_stats(class_id=test_class.id)
        assert result["success"] is True
        assert result["data"]["total"] == 2
