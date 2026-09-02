from datetime import datetime, date
from models import db
from models.activity import Activity, ActivityRegistration
from utils.permission import get_current_admin, get_admin_class_ids
from utils.entity_guard import require_class, class_not_found_response
from services.entity_names import names


class ActivityService:
    def _parse_date(self, value):
        """将字符串或date对象转换为date对象"""
        if value is None:
            return None
        if isinstance(value, (date, datetime)):
            return value if isinstance(value, date) else value.date()
        if isinstance(value, str):
            try:
                return datetime.strptime(value[:10], "%Y-%m-%d").date()
            except (ValueError, IndexError):
                return None
        return None

    def list_activities(self, class_id=None, is_published=None, page=None, per_page=None):
        query = Activity.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        else:
            admin = get_current_admin()
            if admin and admin.role not in ("admin", "super_admin"):
                allowed = get_admin_class_ids(admin.id)
                query = query.filter(Activity.class_id.in_(allowed))
        if is_published is not None:
            query = query.filter_by(is_published=is_published)
        query = query.order_by(Activity.start_date.desc())
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "activities": [self._build_activity_response(a) for a in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        activities = query.all()
        return {"success": True, "data": [self._build_activity_response(a) for a in activities]}

    def create_activity(self, data):
        admin = get_current_admin()
        if not require_class(data.get("class_id")):
            return class_not_found_response("创建活动")
        activity = Activity(
            class_id=data["class_id"],
            title=data["title"],
            description=data.get("description"),
            activity_type=data.get("activity_type"),
            start_date=self._parse_date(data.get("start_date")),
            end_date=self._parse_date(data.get("end_date")),
            location=data.get("location"),
            organizer=data.get("organizer"),
            created_by=admin.id if admin else None,
        )
        db.session.add(activity)
        db.session.commit()
        return {"success": True, "data": self._build_activity_response(activity)}, 201

    def update_activity(self, activity_id, data):
        activity = Activity.query.get(activity_id)
        if not activity:
            return {"success": False, "message": "活动不存在"}, 404
        denied = self._deny_if_class_blocked(activity.class_id)
        if denied:
            return denied
        date_fields = ("start_date", "end_date")
        for key, value in data.items():
            if hasattr(activity, key) and key not in ("id", "created_at"):
                if key in date_fields:
                    setattr(activity, key, self._parse_date(value))
                else:
                    setattr(activity, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_activity_response(activity)}

    def delete_activity(self, activity_id):
        activity = Activity.query.get(activity_id)
        if not activity:
            return {"success": False, "message": "活动不存在"}, 404
        denied = self._deny_if_class_blocked(activity.class_id)
        if denied:
            return denied
        ActivityRegistration.query.filter_by(activity_id=activity_id).delete()
        db.session.delete(activity)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def register_student(self, activity_id, student_id):
        activity = Activity.query.get(activity_id)
        if not activity:
            return {"success": False, "message": "活动不存在"}, 404
        denied = self._deny_if_class_blocked(activity.class_id)
        if denied:
            return denied
        existing = ActivityRegistration.query.filter_by(
            activity_id=activity_id, student_id=student_id
        ).first()
        if existing:
            return {"success": False, "message": "已报名"}, 400
        reg = ActivityRegistration(activity_id=activity_id, student_id=student_id)
        db.session.add(reg)
        db.session.commit()
        return {"success": True, "data": {"activity_id": activity_id, "student_id": student_id}}

    def cancel_registration(self, activity_id, student_id):
        reg = ActivityRegistration.query.filter_by(
            activity_id=activity_id, student_id=student_id
        ).first()
        if not reg:
            return {"success": False, "message": "报名记录不存在"}, 404
        activity = Activity.query.get(activity_id)
        if activity:
            denied = self._deny_if_class_blocked(activity.class_id)
            if denied:
                return denied
        reg.status = "cancelled"
        db.session.commit()
        return {"success": True, "message": "已取消"}

    def _deny_if_class_blocked(self, class_id):
        """隐私隔离：非超管只能操作自己关联班级的数据（detail-by-id 越权防护，对齐 teacher_comment/study_guide）。"""
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            if not allowed_ids or class_id not in allowed_ids:
                return {"success": False, "message": "无权操作该班级的数据"}, 403
        return None

    def _build_activity_response(self, a):
        reg_count = ActivityRegistration.query.filter_by(
            activity_id=a.id, status="registered"
        ).count()
        return {
            "id": a.id,
            "class_id": a.class_id,
            "class_name": names.klass(a.class_id),
            "title": a.title,
            "description": a.description,
            "activity_type": a.activity_type,
            "start_date": a.start_date.isoformat() if a.start_date else None,
            "end_date": a.end_date.isoformat() if a.end_date else None,
            "location": a.location,
            "organizer": a.organizer,
            "is_published": a.is_published,
            "registration_count": reg_count,
        }


activity_service = ActivityService()
