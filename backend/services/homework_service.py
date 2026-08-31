from datetime import datetime, date
from models import db
from models.homework import HomeworkAssignment, HomeworkSubmission
from utils.permission import get_current_admin, get_admin_class_ids
from services.entity_names import names


class HomeworkService:
    def list_assignments(self, class_id=None, subject_id=None, is_completed=None):
        query = HomeworkAssignment.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        else:
            admin = get_current_admin()
            if admin and admin.role not in ("admin", "super_admin"):
                allowed = get_admin_class_ids(admin.id)
                query = query.filter(HomeworkAssignment.class_id.in_(allowed))
        if subject_id:
            query = query.filter_by(subject_id=subject_id)
        if is_completed is not None:
            query = query.filter_by(is_completed=is_completed)
        assignments = query.order_by(HomeworkAssignment.due_date.desc()).all()
        return {"success": True, "data": [self._build_assignment_response(a) for a in assignments]}

    def _parse_date(self, value):
        """将字符串或date对象转换为date对象"""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.strptime(value[:10], "%Y-%m-%d").date()
            except (ValueError, IndexError):
                return None
        return None

    def create_assignment(self, data):
        admin = get_current_admin()
        assignment = HomeworkAssignment(
            class_id=data["class_id"],
            subject_id=data.get("subject_id"),
            title=data["title"],
            description=data.get("description"),
            assigned_date=self._parse_date(data.get("assigned_date")) or date.today(),
            due_date=self._parse_date(data.get("due_date")) or date.today(),
            assigned_by=admin.id if admin else None,
        )
        db.session.add(assignment)
        db.session.commit()
        return {"success": True, "data": self._build_assignment_response(assignment)}, 201

    def get_assignment(self, assignment_id):
        assignment = HomeworkAssignment.query.get(assignment_id)
        if not assignment:
            return {"success": False, "message": "作业不存在"}, 404
        submissions = HomeworkSubmission.query.filter_by(assignment_id=assignment_id).all()
        submitted = [s for s in submissions if s.is_submitted]
        return {
            "success": True,
            "data": {
                **self._build_assignment_response(assignment),
                "total_students": self._get_class_student_count(assignment.class_id),
                "submitted_count": len(submitted),
                "unsubmitted_count": len(submissions) - len(submitted),
                "submissions": [self._build_submission_response(s) for s in submissions],
            },
        }

    def update_assignment(self, assignment_id, data):
        assignment = HomeworkAssignment.query.get(assignment_id)
        if not assignment:
            return {"success": False, "message": "作业不存在"}, 404
        denied = self._deny_if_class_blocked(assignment.class_id)
        if denied:
            return denied
        date_fields = ("assigned_date", "due_date")
        for key, value in data.items():
            if hasattr(assignment, key) and key not in ("id", "created_at"):
                if key in date_fields:
                    setattr(assignment, key, self._parse_date(value))
                else:
                    setattr(assignment, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_assignment_response(assignment)}

    def mark_submitted(self, assignment_id, student_id):
        submission = HomeworkSubmission.query.filter_by(
            assignment_id=assignment_id, student_id=student_id
        ).first()
        if not submission:
            submission = HomeworkSubmission(assignment_id=assignment_id, student_id=student_id)
            db.session.add(submission)
        assignment = HomeworkAssignment.query.get(assignment_id)
        if assignment:
            denied = self._deny_if_class_blocked(assignment.class_id)
            if denied:
                return denied
        submission.is_submitted = True
        submission.submitted_at = datetime.now()
        assignment = HomeworkAssignment.query.get(assignment_id)
        if assignment and assignment.due_date and date.today() > assignment.due_date:
            submission.is_late = True
        db.session.commit()
        return {"success": True, "data": self._build_submission_response(submission)}

    def mark_checked(self, assignment_id, student_id, notes=""):
        submission = HomeworkSubmission.query.filter_by(
            assignment_id=assignment_id, student_id=student_id
        ).first()
        if not submission:
            return {"success": False, "message": "提交记录不存在"}, 404
        assignment = HomeworkAssignment.query.get(assignment_id)
        if assignment:
            denied = self._deny_if_class_blocked(assignment.class_id)
            if denied:
                return denied
        admin = get_current_admin()
        submission.checked_by = admin.id if admin else None
        submission.notes = notes
        db.session.commit()
        return {"success": True, "data": self._build_submission_response(submission)}

    def delete_assignment(self, assignment_id):
        assignment = HomeworkAssignment.query.get(assignment_id)
        if not assignment:
            return {"success": False, "message": "作业不存在"}, 404
        denied = self._deny_if_class_blocked(assignment.class_id)
        if denied:
            return denied
        HomeworkSubmission.query.filter_by(assignment_id=assignment_id).delete()
        db.session.delete(assignment)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def _deny_if_class_blocked(self, class_id):
        """隐私隔离：非超管只能操作自己关联班级的数据（detail-by-id 越权防护，对齐 teacher_comment/study_guide）。"""
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            if not allowed_ids or class_id not in allowed_ids:
                return {"success": False, "message": "无权操作该班级的数据"}, 403
        return None

    def _get_class_student_count(self, class_id):
        from models import User

        return User.query.filter_by(class_info_id=class_id, is_active=True).count()

    def _build_assignment_response(self, a):
        return {
            "id": a.id,
            "class_id": a.class_id,
            "class_name": names.klass(a.class_id),
            "subject_id": a.subject_id,
            "subject_name": names.subject(a.subject_id),
            "title": a.title,
            "description": a.description,
            "assigned_date": a.assigned_date.isoformat() if a.assigned_date else None,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "is_completed": a.is_completed,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }

    def _build_submission_response(self, s):
        return {
            "id": s.id,
            "assignment_id": s.assignment_id,
            "student_id": s.student_id,
            "student_name": names.student(s.student_id),
            "is_submitted": s.is_submitted,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "is_late": s.is_late,
            "notes": s.notes,
        }


homework_service = HomeworkService()
