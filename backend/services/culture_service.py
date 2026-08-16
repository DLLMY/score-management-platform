from models import db, ClassInfo, get_by_id
from models.culture import CultureRecord, CultureItem
from utils.permission import get_current_admin
from services.entity_names import names


class CultureService:
    def list_records(self, class_id=None, category=None, is_active=True):
        query = CultureRecord.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if category:
            query = query.filter_by(category=category)
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        records = query.order_by(CultureRecord.display_order, CultureRecord.created_at.desc()).all()
        return {"success": True, "data": [self._build_record_response(r) for r in records]}

    def create_record(self, data):
        admin = get_current_admin()
        class_info = get_by_id(ClassInfo, data.get("class_id"))
        if not class_info:
            return {"success": False, "message": "班级不存在，无法创建文化记录"}, 400
        record = CultureRecord(
            class_id=data["class_id"],
            category=data.get("category"),
            title=data.get("title"),
            content=data.get("content"),
            image_url=data.get("image_url"),
            display_order=data.get("display_order", 0),
            created_by=admin.id if admin else None,
        )
        db.session.add(record)
        db.session.commit()
        return {"success": True, "data": self._build_record_response(record)}, 201

    def update_record(self, record_id, data):
        record = CultureRecord.query.get(record_id)
        if not record:
            return {"success": False, "message": "文化记录不存在"}, 404
        for key, value in data.items():
            if hasattr(record, key) and key not in ("id", "created_at"):
                setattr(record, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_record_response(record)}

    def delete_record(self, record_id):
        record = CultureRecord.query.get(record_id)
        if not record:
            return {"success": False, "message": "文化记录不存在"}, 404
        CultureItem.query.filter_by(record_id=record_id).delete()
        db.session.delete(record)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def _build_record_response(self, r):
        return {
            "id": r.id,
            "class_id": r.class_id,
            "class_name": names.klass(r.class_id),
            "category": r.category,
            "title": r.title,
            "content": r.content,
            "image_url": r.image_url,
            "display_order": r.display_order,
            "is_active": r.is_active,
        }


culture_service = CultureService()
