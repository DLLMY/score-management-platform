from models import db, User
from models.parent import ParentContact, ContactLog
from utils.permission import get_current_admin, get_admin_class_ids
from services.entity_names import names


class ParentService:
    def list_contacts(self, class_id=None, keyword="", page=None, per_page=None):
        query = ParentContact.query
        # 隐私隔离：非超管（班主任）只能看自己关联班级的学生家长，口径与 attendance 一致。
        # 注意：隔离过滤与显式 class_id 过滤都需 join User（ParentContact 无 class_id 字段），
        # 必须合并为单次 join，否则 SQL 会 JOIN user 两次 → SQLite 报 ambiguous column。
        admin = get_current_admin()
        is_scoped = admin is not None and admin.role not in ("admin", "super_admin")
        if is_scoped or class_id:
            query = query.join(User, User.id == ParentContact.student_id)
            if is_scoped:
                allowed_ids = get_admin_class_ids(admin.id)
                if allowed_ids:
                    query = query.filter(User.class_info_id.in_(allowed_ids))
                else:
                    query = query.filter(False)
            if class_id:
                query = query.filter(User.class_info_id == class_id)
        if keyword:
            query = query.filter(
                db.or_(
                    ParentContact.father_name.ilike(f"%{keyword}%"),
                    ParentContact.mother_name.ilike(f"%{keyword}%"),
                    ParentContact.father_phone.ilike(f"%{keyword}%"),
                    ParentContact.mother_phone.ilike(f"%{keyword}%"),
                )
            )
        query = query.order_by(ParentContact.id)
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "contacts": [self._build_contact_response(c) for c in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        contacts = query.all()
        return {"success": True, "data": [self._build_contact_response(c) for c in contacts]}

    def get_contact(self, contact_id):
        contact = ParentContact.query.get(contact_id)
        if not contact:
            return {"success": False, "message": "家长信息不存在"}, 404
        # 隐私隔离：非超管仅能读自己关联班级的学生家长
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            student = User.query.get(contact.student_id)
            can_access = bool(allowed_ids and student and student.class_info_id in allowed_ids)
            if not can_access:
                return {"success": False, "message": "无权访问该家长信息"}, 403
        return {"success": True, "data": self._build_contact_response(contact)}

    def create_contact(self, data):
        contact = ParentContact(**{k: v for k, v in data.items() if hasattr(ParentContact, k)})
        db.session.add(contact)
        db.session.commit()
        return {"success": True, "data": self._build_contact_response(contact)}, 201

    def update_contact(self, contact_id, data):
        contact = ParentContact.query.get(contact_id)
        if not contact:
            return {"success": False, "message": "家长信息不存在"}, 404
        for key, value in data.items():
            if hasattr(contact, key) and key not in ("id", "created_at"):
                setattr(contact, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_contact_response(contact)}

    def delete_contact(self, contact_id):
        contact = ParentContact.query.get(contact_id)
        if not contact:
            return {"success": False, "message": "家长信息不存在"}, 404
        ContactLog.query.filter_by(parent_id=contact_id).delete()
        db.session.delete(contact)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def list_contact_logs(self, parent_id=None, is_resolved=None, page=None, per_page=None):
        query = ContactLog.query
        # 隐私隔离：日志经由其家长所属学生归属班级过滤，口径与 list_contacts 一致
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            if allowed_ids:
                query = query.join(
                    ParentContact, ParentContact.id == ContactLog.parent_id
                ).join(User, User.id == ParentContact.student_id).filter(
                    User.class_info_id.in_(allowed_ids)
                )
            else:
                query = query.filter(False)
        if parent_id:
            query = query.filter_by(parent_id=parent_id)
        if is_resolved is not None:
            query = query.filter_by(is_resolved=is_resolved)
        query = query.order_by(ContactLog.contact_time.desc())
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "logs": [self._build_log_response(log) for log in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        logs = query.all()
        return {"success": True, "data": [self._build_log_response(log) for log in logs]}

    def create_contact_log(self, data):
        admin = get_current_admin()
        log = ContactLog(
            parent_id=data["parent_id"],
            contact_type=data.get("contact_type", "phone"),
            content=data.get("content", ""),
            created_by=admin.id if admin else None,
            follow_up_needed=data.get("follow_up_needed", False),
        )
        db.session.add(log)
        db.session.commit()
        return {"success": True, "data": self._build_log_response(log)}, 201

    def resolve_log(self, log_id):
        log = ContactLog.query.get(log_id)
        if not log:
            return {"success": False, "message": "联系记录不存在"}, 404
        log.is_resolved = True
        db.session.commit()
        return {"success": True, "data": self._build_log_response(log)}

    def _build_contact_response(self, contact):
        return {
            "id": contact.id,
            "student_id": contact.student_id,
            "student_name": names.student(contact.student_id),
            "father_name": contact.father_name,
            "father_phone": contact.father_phone,
            "mother_name": contact.mother_name,
            "mother_phone": contact.mother_phone,
            "address": contact.address,
            "email": contact.email,
            "created_at": contact.created_at.isoformat() if contact.created_at else None,
        }

    def _build_log_response(self, log):
        return {
            "id": log.id,
            "parent_id": log.parent_id,
            "contact_type": log.contact_type,
            "content": log.content,
            "contact_time": log.contact_time.isoformat() if log.contact_time else None,
            "follow_up_needed": log.follow_up_needed,
            "is_resolved": log.is_resolved,
        }


parent_service = ParentService()
