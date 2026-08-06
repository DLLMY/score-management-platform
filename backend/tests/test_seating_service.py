import pytest
from models import db
from models.seating import SeatingChart, SeatingSeat
from services.seating_service import seating_service


class TestSeatingService:
    def test_create_chart(self, app, db_session):
        result = seating_service.create_chart({
            "class_id": 1,
            "name": "2026年春季排座",
            "rows": 8,
            "columns": 8,
        })
        assert result[0]["success"] is True
        assert result[1] == 201
        data = result[0]["data"]
        assert data["rows"] == 8
        assert data["columns"] == 8
        assert len(data["seats"]) == 64

    def test_list_charts(self, app, db_session):
        seating_service.create_chart({
            "class_id": 1, "name": "测试排座", "rows": 6, "columns": 6
        })
        result = seating_service.list_charts(class_id=1)
        assert result["success"] is True
        assert len(result["data"]) >= 1

    def test_get_chart(self, app, db_session):
        create_result = seating_service.create_chart({
            "class_id": 1, "name": "获取测试", "rows": 4, "columns": 4
        })
        chart_id = create_result[0]["data"]["id"]
        result = seating_service.get_chart(chart_id)
        assert result["success"] is True
        assert result["data"]["id"] == chart_id

    def test_get_chart_not_found(self, app, db_session):
        result = seating_service.get_chart(99999)
        assert result[0]["success"] is False
        assert result[1] == 404

    def test_update_seat(self, app, db_session):
        create_result = seating_service.create_chart({
            "class_id": 1, "name": "座位更新测试", "rows": 4, "columns": 4
        })
        chart_id = create_result[0]["data"]["id"]
        result = seating_service.update_seat(chart_id, 0, 0, 10)
        assert result["success"] is True
        assert result["data"]["student_id"] == 10

    def test_auto_arrange(self, app, db_session):
        create_result = seating_service.create_chart({
            "class_id": 1, "name": "自动排列测试", "rows": 4, "columns": 4
        })
        chart_id = create_result[0]["data"]["id"]
        result = seating_service.auto_arrange(chart_id, "score_tier", 1)
        assert result["success"] is True

    def test_delete_chart(self, app, db_session):
        create_result = seating_service.create_chart({
            "class_id": 1, "name": "删除测试", "rows": 3, "columns": 3
        })
        chart_id = create_result[0]["data"]["id"]
        result = seating_service.delete_chart(chart_id)
        assert result["success"] is True
        verify = seating_service.get_chart(chart_id)
        assert verify[0]["success"] is False
