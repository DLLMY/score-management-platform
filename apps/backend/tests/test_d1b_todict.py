"""D1-b 对象级断言：NotifyHistory/Approval/ScheduledNotify/SystemMetric/RateLimitRecord to_dict。"""
from datetime import date, datetime

from models.notify_models import NotifyHistory, Approval, ScheduledNotify
from models.system_models import SystemMetric, RateLimitRecord


def test_notify_history_to_dict():
    h = NotifyHistory(text="hi", volume=0.5, urgent=True, send_mode="broadcast", status="sent")
    d = h.to_dict()
    assert d["text"] == "hi"
    assert d["volume"] == 0.5
    assert d["urgent"] is True
    assert d["status"] == "sent"
    assert d["id"] is None
    assert d["created_at"] is None
    d2 = h.to_dict(fields=["text", "status"])
    assert set(d2.keys()) == {"text", "status"}


def test_approval_to_dict():
    a = Approval(
        student_id=3,
        type="leave",
        title="请假",
        status="pending",
        leave_type="sick",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
    )
    d = a.to_dict()
    assert d["student_id"] == 3
    assert d["type"] == "leave"
    assert d["leave_type"] == "sick"
    assert d["start_date"] == "2026-09-01"
    assert d["end_date"] == "2026-09-03"
    assert d["approve_time"] is None


def test_scheduled_notify_to_dict():
    s = ScheduledNotify(text="x", urgent=False, repeat_type="daily", created_by=1)
    d = s.to_dict()
    assert d["text"] == "x"
    assert d["urgent"] is False
    assert d["repeat_type"] == "daily"
    assert d["created_by"] == 1
    assert "scheduled_at" in d and "repeat_end_at" in d


def test_system_metric_to_dict():
    m = SystemMetric(metric_name="cpu_percent", metric_value=42.5, unit="%", category="system")
    d = m.to_dict()
    assert d["metric_name"] == "cpu_percent"
    assert d["metric_value"] == 42.5
    assert d["unit"] == "%"
    assert d["category"] == "system"
    assert d["tags"] is None


def test_rate_limit_record_to_dict():
    r = RateLimitRecord(ip_address="1.2.3.4", endpoint="/api/x", request_count=5)
    d = r.to_dict()
    assert d["ip_address"] == "1.2.3.4"
    assert d["endpoint"] == "/api/x"
    assert d["request_count"] == 5
    assert d["window_start"] is None
