from datetime import datetime, timedelta
from models import db, User, ScoreRecord, Device, ScoreRule, Admin
from services.redis_cache_service import get_cache_service


class DashboardService:

    @staticmethod
    def get_dashboard_data():
        cache_key = "dashboard_data"
        cached_result = get_cache_service().get(cache_key)
        if cached_result is not None:
            return cached_result

        now = datetime.now()
        today = now.date()
        last_7_days = now - timedelta(days=7)

        (
            total_users,
            avg_score,
        ) = db.session.query(
            db.func.count(User.id),
            db.func.avg(User.current_score),
        ).first()
        total_users = total_users or 0
        avg_score = round(avg_score or 0, 2)

        top_users = (
            db.session.query(User.id, User.name, User.class_name, User.current_score)
            .order_by(User.current_score.desc())
            .all()
        )

        total_devices = Device.query.count() or 0
        online_devices = sum(1 for d in Device.query.all() if d.is_online) or 0

        total_admins = Admin.query.count() or 0
        total_rules = ScoreRule.query.filter_by(is_active=True).count() or 0

        today_start = datetime.combine(today, datetime.min.time())
        today_records = ScoreRecord.query.filter(ScoreRecord.created_at >= today_start).count() or 0

        weekly_records = ScoreRecord.query.filter(ScoreRecord.created_at >= last_7_days).count() or 0

        category_stats = (
            db.session.query(
                ScoreRecord.rule_id,
                db.func.sum(ScoreRecord.score_change),
            )
            .filter(ScoreRecord.created_at >= last_7_days)
            .group_by(ScoreRecord.rule_id)
            .order_by(db.func.sum(ScoreRecord.score_change).desc())
            .all()
        )

        result = {  # noqa: F841
            "total_users": total_users,
            "total_admins": total_admins,
            "total_rules": total_rules,
            "total_devices": total_devices,
            "online_devices": online_devices,
            "today_records": today_records,
            "weekly_records": weekly_records,
            "avg_score": avg_score,
            "top_users": [
                {
                    "id": u[0],
                    "name": u[1],
                    "class_name": u[2],
                    "current_score": u[3],
                }
                for u in top_users
            ],
            "category_stats": [{"rule_id": r[0], "total_score": r[1]} for r in category_stats],
        }

        get_cache_service().set(cache_key, result, ttl=60)
        return result


dashboard_service = DashboardService()
