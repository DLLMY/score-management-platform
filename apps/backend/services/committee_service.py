from datetime import datetime
from models import db
from models.committee import ClassCommittee, CommitteeTerm
from utils.datetime_utils import parse_date
from utils.entity_guard import require_class, require_student
from utils.permission import get_current_admin, get_admin_class_ids
from services.entity_names import names


class CommitteeService:
    def list_members(self, class_id=None, position=None, is_active=True):
        query = ClassCommittee.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        else:
            admin = get_current_admin()
            if admin and admin.role not in ("admin", "super_admin"):
                allowed = get_admin_class_ids(admin.id)
                query = query.filter(ClassCommittee.class_id.in_(allowed))
        if position:
            query = query.filter_by(position=position)
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        members = query.order_by(ClassCommittee.position).all()
        return {"success": True, "data": [self._build_member_response(m) for m in members]}

    def create_member(self, data):
        if not isinstance(data, dict):
            return {"success": False, "message": "请求体必须是 JSON 对象"}, 400
        missing = [k for k in ("class_id", "position", "student_id") if not data.get(k)]
        if missing:
            return {"success": False, "message": "缺少必填字段: " + ", ".join(missing)}, 400
        if not require_class(data["class_id"]) or not require_student(data["student_id"]):
            return {"success": False, "message": "班级或学生不存在，无法添加班委"}, 400
        member = ClassCommittee(
            class_id=data["class_id"],
            position=data["position"],
            student_id=data["student_id"],
            responsibilities=data.get("responsibilities"),
            rating=data.get("rating", 0),
            term_start=data.get("term_start"),
            term_end=data.get("term_end"),
        )
        db.session.add(member)
        db.session.commit()
        return {"success": True, "data": self._build_member_response(member)}, 201

    def update_member(self, member_id, data):
        member = ClassCommittee.query.get(member_id)
        if not member:
            return {"success": False, "message": "班委成员不存在"}, 404
        denied = self._ensure_class_access(member)
        if denied:
            return denied
        for key, value in data.items():
            if hasattr(member, key) and key not in ("id", "created_at"):
                setattr(member, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_member_response(member)}

    def delete_member(self, member_id):
        member = ClassCommittee.query.get(member_id)
        if not member:
            return {"success": False, "message": "班委成员不存在"}, 404
        denied = self._ensure_class_access(member)
        if denied:
            return denied
        member.is_active = False
        member.term_end = datetime.now().date()
        db.session.commit()
        return {"success": True, "message": "已解除班委职务"}

    def list_terms(self, class_id=None):
        query = CommitteeTerm.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        else:
            admin = get_current_admin()
            if admin and admin.role not in ("admin", "super_admin"):
                allowed = get_admin_class_ids(admin.id)
                query = query.filter(CommitteeTerm.class_id.in_(allowed))
        terms = query.order_by(CommitteeTerm.start_date.desc()).all()
        return {"success": True, "data": [self._build_term_response(t) for t in terms]}

    def create_term(self, data):
        if data.get("is_current"):
            CommitteeTerm.query.filter_by(class_id=data["class_id"], is_current=True).update(
                {"is_current": False}
            )
        term = CommitteeTerm(
            class_id=data["class_id"],
            term_name=data["term_name"],
            start_date=parse_date(data.get("start_date")),
            end_date=parse_date(data.get("end_date")),
            is_current=data.get("is_current", True),
        )
        db.session.add(term)
        db.session.commit()
        return {"success": True, "data": self._build_term_response(term)}, 201

    def _ensure_class_access(self, entity):
        """隐私隔离：非超管只能操作自己关联班级的数据（detail-by-id 越权防护，对齐 teacher_comment/study_guide）。"""
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            if not allowed_ids or entity.class_id not in allowed_ids:
                return {"success": False, "message": "无权操作该班级的数据"}, 403
        return None

    def _build_member_response(self, member):
        return {
            "id": member.id,
            "class_id": member.class_id,
            "class_name": names.klass(member.class_id),
            "position": member.position,
            "student_id": member.student_id,
            "student_name": names.student(member.student_id),
            "responsibilities": member.responsibilities,
            "rating": member.rating,
            "term_start": member.term_start.isoformat() if member.term_start else None,
            "term_end": member.term_end.isoformat() if member.term_end else None,
            "is_active": member.is_active,
        }

    def _build_term_response(self, term):
        return {
            "id": term.id,
            "class_id": term.class_id,
            "term_name": term.term_name,
            "start_date": term.start_date.isoformat() if term.start_date else None,
            "end_date": term.end_date.isoformat() if term.end_date else None,
            "is_current": term.is_current,
        }


committee_service = CommitteeService()
