from datetime import datetime
from models import db, Alert, User
from models.mental_health import MentalHealthRecord
from utils.permission import get_current_admin, get_admin_class_ids
from services.entity_names import names


class MentalHealthService:
    def list_records(self, student_id=None, class_id=None, page=None, per_page=None):
        query = MentalHealthRecord.query
        # 隐私隔离：非超管（班主任）只能看自己关联班级学生的心理记录，口径与 attendance 一致。
        # 隔离与显式 class_id 过滤合并为单次 join（MentalHealthRecord 无 class_id 字段），
        # 否则 JOIN user 两次 → SQLite 报 ambiguous column。
        admin = get_current_admin()
        is_scoped = admin is not None and admin.role not in ("admin", "super_admin")
        if is_scoped or class_id:
            query = query.join(User, User.id == MentalHealthRecord.student_id)
            if is_scoped:
                allowed_ids = get_admin_class_ids(admin.id)
                if allowed_ids:
                    query = query.filter(User.class_info_id.in_(allowed_ids))
                else:
                    query = query.filter(False)
            if class_id:
                query = query.filter(User.class_info_id == class_id)
        if student_id:
            query = query.filter_by(student_id=student_id)
        query = query.order_by(MentalHealthRecord.created_at.desc())
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "records": [self._build_record_response(r) for r in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        records = query.all()
        return {"success": True, "data": [self._build_record_response(r) for r in records]}

    def create_record(self, data):
        admin = get_current_admin()
        record = MentalHealthRecord(
            student_id=data["student_id"],
            mood_level=data.get("mood_level"),
            stress_level=data.get("stress_level"),
            sleep_hours=data.get("sleep_hours"),
            notes=data.get("notes"),
            recorded_by=admin.id if admin else None,
        )
        db.session.add(record)
        db.session.commit()
        self._check_and_create_alerts(record)
        return {"success": True, "data": self._build_record_response(record)}, 201

    def list_alerts(self, student_id=None, is_resolved=None, class_id=None, page=None, per_page=None):
        query = Alert.query.filter_by(source="mental")
        # 隐私隔离：非超管只能看自己关联班级学生的心理预警；隔离与 class_id 合并单次 join
        admin = get_current_admin()
        is_scoped = admin is not None and admin.role not in ("admin", "super_admin")
        if is_scoped or class_id:
            query = query.join(User, User.id == Alert.student_id)
            if is_scoped:
                allowed_ids = get_admin_class_ids(admin.id)
                if allowed_ids:
                    query = query.filter(User.class_info_id.in_(allowed_ids))
                else:
                    query = query.filter(False)
            if class_id:
                query = query.filter(User.class_info_id == class_id)
        if student_id:
            query = query.filter_by(student_id=student_id)
        if is_resolved is not None:
            query = query.filter_by(is_resolved=is_resolved)
        query = query.order_by(Alert.created_at.desc())
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "alerts": [self._build_alert_response(a) for a in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        alerts = query.all()
        return {"success": True, "data": [self._build_alert_response(a) for a in alerts]}

    def resolve_alert(self, alert_id):
        alert = Alert.query.get(alert_id)
        if not alert or alert.source != "mental":
            return {"success": False, "message": "预警不存在"}, 404
        alert.is_resolved = True
        alert.resolved_at = datetime.now()
        db.session.commit()
        return {"success": True, "data": self._build_alert_response(alert)}

    def _check_and_create_alerts(self, record):
        alerts = []
        if record.mood_level and record.mood_level <= 2:
            alerts.append(
                Alert(
                    source="mental",
                    student_id=record.student_id,
                    alert_type="low_mood",
                    severity=str(2),
                    message=f"学生心情指数较低({record.mood_level})，建议关注",
                )
            )
        if record.stress_level and record.stress_level >= 4:
            alerts.append(
                Alert(
                    source="mental",
                    student_id=record.student_id,
                    alert_type="high_stress",
                    severity=str(3),
                    message=f"学生压力指数较高({record.stress_level})，需重点关注",
                )
            )
        if record.sleep_hours and record.sleep_hours < 6:
            alerts.append(
                Alert(
                    source="mental",
                    student_id=record.student_id,
                    alert_type="poor_sleep",
                    severity=str(2),
                    message=f"学生睡眠不足({record.sleep_hours}小时)，建议关注",
                )
            )
        if alerts:
            db.session.add_all(alerts)
            db.session.commit()

    def _build_record_response(self, r):
        return {
            "id": r.id,
            "student_id": r.student_id,
            "student_name": names.student(r.student_id),
            "mood_level": r.mood_level,
            "stress_level": r.stress_level,
            "sleep_hours": r.sleep_hours,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }

    def _build_alert_response(self, a):
        # P0-6: 心理预警 severity 在库中存为字符串化整数（兼容 device 告警的字符串 severity），
        # 前端 MentalHealth.tsx 需要整数契约，故此处还原为 int。
        sev = a.severity
        try:
            sev_int = int(sev) if sev is not None else None
        except (ValueError, TypeError):
            sev_int = None
        return {
            "id": a.id,
            "student_id": a.student_id,
            "student_name": names.student(a.student_id),
            "alert_type": a.alert_type,
            "severity": sev_int,
            "message": a.message,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }


mental_health_service = MentalHealthService()
