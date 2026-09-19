from datetime import datetime
from models import db


class SeatingChart(db.Model):
    __tablename__ = "seating_chart"

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    rows = db.Column(db.Integer, default=8)
    columns = db.Column(db.Integer, default=8)
    strategy = db.Column(db.String(50), default="manual")
    is_active = db.Column(db.Boolean, default=True)
    version = db.Column(db.Integer, default=1)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    seats = db.relationship("SeatingSeat", backref="chart", cascade="all, delete-orphan")



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "class_id": self.class_id,
            "name": self.name,
            "rows": self.rows,
            "columns": self.columns,
            "strategy": self.strategy,
            "is_active": self.is_active,
            "version": self.version,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class SeatingSeat(db.Model):
    __tablename__ = "seating_seat"

    id = db.Column(db.Integer, primary_key=True)
    chart_id = db.Column(db.Integer, db.ForeignKey("seating_chart.id"), nullable=False, index=True)
    row = db.Column(db.Integer, nullable=False)
    col = db.Column(db.Integer, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True, nullable=True)
    is_aisle = db.Column(db.Boolean, default=False)
    is_student_seat = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "chart_id": self.chart_id,
            "row": self.row,
            "col": self.col,
            "student_id": self.student_id,
            "is_aisle": self.is_aisle,
            "is_student_seat": self.is_student_seat,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data