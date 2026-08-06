from models import db, cascade_delete_related_records
from models.seating import SeatingChart, SeatingSeat
from utils.permission import get_current_admin
from services.entity_names import names


class SeatingService:
    def list_charts(self, class_id=None, keyword=""):
        query = SeatingChart.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if keyword:
            query = query.filter(SeatingChart.name.ilike(f"%{keyword}%"))
        charts = query.order_by(SeatingChart.created_at.desc()).all()
        return {"success": True, "data": [self._build_chart_list_response(c) for c in charts]}

    def create_chart(self, data):
        admin = get_current_admin()
        chart = SeatingChart(
            class_id=data["class_id"],
            name=data["name"],
            rows=data.get("rows", 8),
            columns=data.get("columns", 8),
            strategy=data.get("strategy", "manual"),
            created_by=admin.id if admin else None,
        )
        db.session.add(chart)
        db.session.flush()

        for r in range(chart.rows):
            for c in range(chart.columns):
                aisle = c == chart.columns // 2 - 1 or c == chart.columns // 2
                seat = SeatingSeat(
                    chart_id=chart.id,
                    row=r,
                    col=c,
                    is_aisle=aisle,
                )
                db.session.add(seat)
        db.session.commit()
        return {"success": True, "data": self._build_chart_response(chart)}, 201

    def get_chart(self, chart_id):
        chart = SeatingChart.query.get(chart_id)
        if not chart:
            return {"success": False, "message": "座次表不存在"}, 404
        return {"success": True, "data": self._build_chart_response(chart)}

    def update_chart(self, chart_id, data):
        chart = SeatingChart.query.get(chart_id)
        if not chart:
            return {"success": False, "message": "座次表不存在"}, 404
        for key, value in data.items():
            if hasattr(chart, key) and key not in ("id", "created_at", "created_by"):
                setattr(chart, key, value)
        chart.version += 1
        db.session.commit()
        return {"success": True, "data": self._build_chart_response(chart)}

    def delete_chart(self, chart_id):
        chart = SeatingChart.query.get(chart_id)
        if not chart:
            return {"success": False, "message": "座次表不存在"}, 404
        # seating_seat.chart_id 为 NOT NULL 外键，先清理座位再删除座次表
        cascade_delete_related_records(SeatingChart, chart_id)
        db.session.delete(chart)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def auto_arrange(self, chart_id, strategy, class_id):
        chart = SeatingChart.query.get(chart_id)
        if not chart:
            return {"success": False, "message": "座次表不存在"}, 404

        from models import User

        students = User.query.filter_by(class_info_id=class_id, is_active=True).all()

        if strategy == "height_vision":
            sorted_students = sorted(
                students, key=lambda s: (getattr(s, "height", 150) or 150, -(getattr(s, "vision_score", 5) or 5))
            )
        elif strategy == "score_tier":
            sorted_students = sorted(students, key=lambda s: -(s.current_score or 0))
        else:
            sorted_students = students

        seats = (
            SeatingSeat.query.filter_by(chart_id=chart_id, is_student_seat=True)
            .order_by(SeatingSeat.row, SeatingSeat.col)
            .all()
        )

        for i, seat in enumerate(seats):
            seat.student_id = sorted_students[i].id if i < len(sorted_students) else None
        db.session.commit()
        return {"success": True, "data": self._build_chart_response(chart)}

    def update_seat(self, chart_id, seat_row, seat_col, student_id):
        seat = SeatingSeat.query.filter_by(chart_id=chart_id, row=seat_row, col=seat_col).first()
        if not seat:
            return {"success": False, "message": "座位不存在"}, 404
        seat.student_id = student_id
        db.session.commit()
        return {"success": True, "data": {"id": seat.id, "row": seat_row, "col": seat_col, "student_id": student_id}}

    def _build_chart_response(self, chart):
        seats = SeatingSeat.query.filter_by(chart_id=chart.id).order_by(SeatingSeat.row, SeatingSeat.col).all()
        return {
            "id": chart.id,
            "name": chart.name,
            "rows": chart.rows,
            "columns": chart.columns,
            "strategy": chart.strategy,
            "is_active": chart.is_active,
            "version": chart.version,
            "seats": [
                {
                    "row": s.row,
                    "col": s.col,
                    "student_id": s.student_id,
                    "student_name": names.student(s.student_id),
                    "is_aisle": s.is_aisle,
                }
                for s in seats
            ],
        }

    def _build_chart_list_response(self, chart):
        return {
            "id": chart.id,
            "name": chart.name,
            "rows": chart.rows,
            "columns": chart.columns,
            "strategy": chart.strategy,
            "is_active": chart.is_active,
            "created_at": chart.created_at.isoformat() if chart.created_at else None,
        }


seating_service = SeatingService()
