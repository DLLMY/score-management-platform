from datetime import datetime
from models import db
from models.mental_health import MentalHealthRecord, MentalHealthAlert
from utils.permission import get_current_admin
from services.entity_names import names


class MentalHealthService:
    def list_records(self, student_id=None):
        query = MentalHealthRecord.query
        if student_id:
            query = query.filter_by(student_id=student_id)
        records = query.order_by(MentalHealthRecord.created_at.desc()).all()
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

    def list_alerts(self, student_id=None, is_resolved=None):
        query = MentalHealthAlert.query
        if student_id:
            query = query.filter_by(student_id=student_id)
        if is_resolved is not None:
            query = query.filter_by(is_resolved=is_resolved)
        alerts = query.order_by(MentalHealthAlert.created_at.desc()).all()
        return {"success": True, "data": [self._build_alert_response(a) for a in alerts]}

    def resolve_alert(self, alert_id):
        alert = MentalHealthAlert.query.get(alert_id)
        if not alert:
            return {"success": False, "message": "预警不存在"}, 404
        alert.is_resolved = True
        alert.resolved_at = datetime.now()
        db.session.commit()
        return {"success": True, "data": self._build_alert_response(alert)}

    def _check_and_create_alerts(self, record):
        alerts = []
        if record.mood_level and record.mood_level <= 2:
            alerts.append(
                MentalHealthAlert(
                    student_id=record.student_id,
                    alert_type="low_mood",
                    severity=2,
                    message=f"学生心情指数较低({record.mood_level})，建议关注",
                )
            )
        if record.stress_level and record.stress_level >= 4:
            alerts.append(
                MentalHealthAlert(
                    student_id=record.student_id,
                    alert_type="high_stress",
                    severity=3,
                    message=f"学生压力指数较高({record.stress_level})，需重点关注",
                )
            )
        if record.sleep_hours and record.sleep_hours < 6:
            alerts.append(
                MentalHealthAlert(
                    student_id=record.student_id,
                    alert_type="poor_sleep",
                    severity=2,
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
        return {
            "id": a.id,
            "student_id": a.student_id,
            "student_name": names.student(a.student_id),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "message": a.message,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }


mental_health_service = MentalHealthService()
