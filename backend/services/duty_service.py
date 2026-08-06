from datetime import datetime, timedelta
from models import db
from models.duty import DutyGroup, DutyAssignment
from utils.datetime_utils import parse_date
from utils.permission import get_current_admin
from services.entity_names import names


class DutyService:
    def list_groups(self, class_id=None, keyword=""):
        query = DutyGroup.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if keyword:
            query = query.filter(DutyGroup.name.ilike(f"%{keyword}%"))
        groups = query.order_by(DutyGroup.day_of_week, DutyGroup.name).all()
        return {"success": True, "data": [self._build_group_response(g) for g in groups]}

    def create_group(self, data):
        group = DutyGroup(
            class_id=data["class_id"],
            name=data["name"],
            day_of_week=data.get("day_of_week"),
            area=data.get("area"),
        )
        db.session.add(group)
        db.session.commit()
        return {"success": True, "data": self._build_group_response(group)}, 201

    def update_group(self, group_id, data):
        group = DutyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "值日组不存在"}, 404
        for key, value in data.items():
            if hasattr(group, key) and key not in ("id", "created_at"):
                setattr(group, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_group_response(group)}

    def delete_group(self, group_id):
        group = DutyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "值日组不存在"}, 404
        DutyAssignment.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def list_assignments(self, group_id=None, student_id=None, date=None, is_completed=None):
        query = DutyAssignment.query
        if group_id:
            query = query.filter_by(group_id=group_id)
        if student_id:
            query = query.filter_by(student_id=student_id)
        if date:
            query = query.filter_by(date=date)
        if is_completed is not None:
            query = query.filter_by(is_completed=is_completed)
        assignments = query.order_by(DutyAssignment.date.desc()).all()
        return {"success": True, "data": [self._build_assignment_response(a) for a in assignments]}

    def create_assignment(self, data):
        assignment = DutyAssignment(
            group_id=data["group_id"],
            student_id=data["student_id"],
            date=parse_date(data["date"]),
            task=data.get("task"),
        )
        db.session.add(assignment)
        db.session.commit()
        return {"success": True, "data": self._build_assignment_response(assignment)}, 201

    def mark_complete(self, assignment_id):
        assignment = DutyAssignment.query.get(assignment_id)
        if not assignment:
            return {"success": False, "message": "值日任务不存在"}, 404
        assignment.is_completed = True
        assignment.completed_at = datetime.now()
        admin = get_current_admin()
        if admin:
            assignment.checked_by = admin.id
        db.session.commit()
        return {"success": True, "data": self._build_assignment_response(assignment)}

    def delete_assignment(self, assignment_id):
        assignment = DutyAssignment.query.get(assignment_id)
        if not assignment:
            return {"success": False, "message": "值日任务不存在"}, 404
        db.session.delete(assignment)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def rotate_assignments(self, class_id, period="weekly"):
        groups = DutyGroup.query.filter_by(class_id=class_id, is_active=True).all()
        if not groups:
            return {"success": False, "message": "没有值日组"}, 400

        today = datetime.now().date()
        assignments = DutyAssignment.query.filter(
            DutyAssignment.group_id.in_([g.id for g in groups]),
            DutyAssignment.date >= today - timedelta(days=7),
        ).all()

        for a in assignments:
            a.date = a.date + timedelta(weeks=1)
        db.session.commit()
        return {"success": True, "data": {"rotated_count": len(assignments)}}

    def _build_group_response(self, group):
        return {
            "id": group.id,
            "class_id": group.class_id,
            "class_name": names.klass(group.class_id),
            "name": group.name,
            "day_of_week": group.day_of_week,
            "area": group.area,
            "is_active": group.is_active,
            "created_at": group.created_at.isoformat() if group.created_at else None,
        }

    def _build_assignment_response(self, assignment):
        return {
            "id": assignment.id,
            "group_id": assignment.group_id,
            "student_id": assignment.student_id,
            "student_name": names.student(assignment.student_id),
            "date": assignment.date.isoformat() if assignment.date else None,
            "task": assignment.task,
            "is_completed": assignment.is_completed,
            "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
        }


duty_service = DutyService()
