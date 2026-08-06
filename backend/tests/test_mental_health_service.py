import pytest
from models import db
from models.mental_health import MentalHealthRecord, MentalHealthAlert
from services.mental_health_service import mental_health_service


class TestMentalHealthService:
    def test_create_record(self, app, db_session):
        result = mental_health_service.create_record({
            "student_id": 10, "mood_level": 4,
            "stress_level": 2, "sleep_hours": 8
        })
        assert result[0]["success"] is True

    def test_create_record_triggers_alert(self, app, db_session):
        mental_health_service.create_record({
            "student_id": 10, "mood_level": 1,
            "stress_level": 5, "sleep_hours": 5
        })
        alerts = MentalHealthAlert.query.filter_by(student_id=10, is_resolved=False).all()
        assert len(alerts) >= 2

    def test_list_records(self, app, db_session):
        mental_health_service.create_record({"student_id": 10, "mood_level": 3})
        result = mental_health_service.list_records(student_id=10)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_resolve_alert(self, app, db_session):
        mental_health_service.create_record({
            "student_id": 11, "mood_level": 1, "stress_level": 5
        })
        alert = MentalHealthAlert.query.filter_by(student_id=11).first()
        result = mental_health_service.resolve_alert(alert.id)
        assert result["success"] is True
        assert result["data"]["is_resolved"] is True