from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload
from sqlalchemy import func, distinct, case
from models import db, User, ScoreRecord


class AnalysisService:

    @staticmethod
    def get_user_analysis(user_id):
        user = User.query.get_or_404(user_id)

        stats = (
            db.session.query(
                func.count(ScoreRecord.id).label("count"),
                func.coalesce(
                    func.sum(
                        case(
                            (ScoreRecord.score_change > 0, ScoreRecord.score_change),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_add"),
                func.coalesce(
                    func.sum(
                        case(
                            (ScoreRecord.score_change < 0, func.abs(ScoreRecord.score_change)),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_subtract"),
            )
            .filter(ScoreRecord.student_id == user_id)
            .first()
        )

        last_30_days = datetime.now() - timedelta(days=30)
        recent_records = (
            ScoreRecord.query.filter(
                ScoreRecord.student_id == user_id,
                ScoreRecord.created_at >= last_30_days,
            )
            .order_by(ScoreRecord.created_at.desc())
            .limit(20)
            .all()
        )

        return {
            "user_id": user.id,
            "user_name": user.name,
            "class_name": user.class_name,
            "current_score": user.current_score,
            "total_add_score": float(stats.total_add) if stats else 0,
            "total_subtract_score": (float(stats.total_subtract) if stats else 0),
            "record_count": stats.count if stats else 0,
            "recent_30_days_count": len(recent_records),
            "recent_records": [
                {
                    "id": r.id,
                    "score_change": r.score_change,
                    "description": r.description,
                    "created_at": (r.created_at.isoformat() if r.created_at else None),
                }
                for r in recent_records
            ],
        }

    @staticmethod
    def get_class_analysis(class_name):
        stats = (
            db.session.query(
                func.count(User.id).label("count"),
                func.coalesce(func.sum(User.current_score), 0).label("total_score"),
                func.coalesce(func.avg(User.current_score), 0).label("avg_score"),
                func.coalesce(func.max(User.current_score), 0).label("max_score"),
                func.coalesce(func.min(User.current_score), 0).label("min_score"),
            )
            .filter(User.class_name == class_name)
            .first()
        )

        top_students = (
            User.query.filter_by(class_name=class_name)
            .order_by(User.current_score.desc())
            .limit(5)
            .all()
        )

        last_7_days = datetime.now() - timedelta(days=7)

        weekly_stats = (
            db.session.query(
                func.count(ScoreRecord.id).label("count"),
                func.coalesce(func.sum(ScoreRecord.score_change), 0).label("total_change"),
            )
            .join(User)
            .filter(
                User.class_name == class_name,
                ScoreRecord.created_at >= last_7_days,
            )
            .first()
        )

        return {
            "class_name": class_name,
            "student_count": stats.count if stats else 0,
            "total_score": float(stats.total_score) if stats else 0,
            "avg_score": round(float(stats.avg_score), 2) if stats else 0,
            "max_score": float(stats.max_score) if stats else 0,
            "min_score": float(stats.min_score) if stats else 0,
            "weekly_record_count": weekly_stats.count if weekly_stats else 0,
            "weekly_total_change": (float(weekly_stats.total_change) if weekly_stats else 0),
            "top_students": [
                {"id": u.id, "name": u.name, "current_score": u.current_score} for u in top_students
            ],
        }

    @staticmethod
    def get_unlock_stats(start_date=None, end_date=None, device_id=None, class_name=None):
        query = ScoreRecord.query.options(joinedload(ScoreRecord.user)).filter(
            ScoreRecord.description.like("%开锁%")
        )

        if start_date:
            query = query.filter(ScoreRecord.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(
                ScoreRecord.created_at <= datetime.fromisoformat(end_date) + timedelta(days=1)
            )

        if class_name:
            query = query.join(User).filter(User.class_name == class_name)

        records = query.all()

        total_unlock_count = len(records)
        total_cost = abs(sum(r.score_change for r in records if r.score_change < 0))

        daily_stats = {}
        for record in records:
            date_key = record.created_at.strftime("%Y-%m-%d")
            if date_key not in daily_stats:
                daily_stats[date_key] = {"count": 0, "cost": 0}
            daily_stats[date_key]["count"] += 1
            if record.score_change < 0:
                daily_stats[date_key]["cost"] += abs(record.score_change)

        peak_hour = {}
        for record in records:
            hour = record.created_at.hour
            peak_hour[hour] = peak_hour.get(hour, 0) + 1

        peak_hour_sorted = sorted(peak_hour.items(), key=lambda x: x[1], reverse=True)
        peak_hours = [h[0] for h in peak_hour_sorted[:3]]

        # 日均开锁：分母用日历天数（含零开锁日），避免虚高
        if start_date and end_date:
            cal_days = (
                datetime.fromisoformat(end_date).date()
                - datetime.fromisoformat(start_date).date()
            ).days + 1
        elif start_date:
            cal_days = (datetime.now().date() - datetime.fromisoformat(start_date).date()).days + 1
        else:
            cal_days = len(daily_stats)
        cal_days = max(1, cal_days)

        return {
            "total_unlock_count": total_unlock_count,
            "total_cost": total_cost,
            "daily_stats": [{"date": k, **v} for k, v in sorted(daily_stats.items())],
            "peak_hours": peak_hours,
            "avg_daily": round(total_unlock_count / cal_days, 1),
        }

    @staticmethod
    def get_class_ranking(sort_by="total_score", order="desc", limit=20):
        last_30_days = datetime.now() - timedelta(days=30)

        class_stats = (
            db.session.query(
                User.class_name,
                func.count(User.id).label("student_count"),
                func.sum(User.current_score).label("total_score"),
                func.avg(User.current_score).label("avg_score"),
            )
            .filter(User.class_name.isnot(None))
            .group_by(User.class_name)
            .all()
        )

        ranking_data = []
        for stat in class_stats:
            unlock_count = (
                ScoreRecord.query.join(User)
                .filter(
                    User.class_name == stat.class_name,
                    ScoreRecord.description.like("%开锁%"),
                    ScoreRecord.created_at >= last_30_days,
                )
                .count()
            )

            ranking_data.append(
                {
                    "class_name": stat.class_name,
                    "student_count": stat.student_count,
                    "total_score": stat.total_score or 0,
                    "avg_score": round(stat.avg_score or 0, 2),
                    "unlock_count_30d": unlock_count,
                    "unlock_cost_30d": abs(
                        sum(
                            r.score_change
                            for r in ScoreRecord.query.join(User)
                            .filter(
                                User.class_name == stat.class_name,
                                ScoreRecord.description.like("%开锁%"),
                                ScoreRecord.created_at >= last_30_days,
                            )
                            .all()
                            if r.score_change < 0
                        )
                    ),
                }
            )

        if sort_by == "total_score":
            ranking_data.sort(key=lambda x: x["total_score"], reverse=(order == "desc"))
        elif sort_by == "avg_score":
            ranking_data.sort(key=lambda x: x["avg_score"], reverse=(order == "desc"))
        elif sort_by == "unlock_count":
            ranking_data.sort(key=lambda x: x["unlock_count_30d"], reverse=(order == "desc"))
        elif sort_by == "unlock_cost":
            ranking_data.sort(key=lambda x: x["unlock_cost_30d"], reverse=(order == "desc"))
        elif sort_by == "student_count":
            ranking_data.sort(key=lambda x: x["student_count"], reverse=(order == "desc"))

        return {
            "ranking": ranking_data[:limit],
            "total_classes": len(ranking_data),
        }

    @staticmethod
    def get_student_ranking(class_name=None, sort_by="score", order="desc", limit=50):
        last_30_days = datetime.now() - timedelta(days=30)

        unlock_subquery = (
            db.session.query(
                ScoreRecord.student_id,
                func.count(ScoreRecord.id).label("unlock_count"),
            )
            .filter(
                ScoreRecord.description.like("%开锁%"),
                ScoreRecord.created_at >= last_30_days,
            )
            .group_by(ScoreRecord.student_id)
            .subquery()
        )

        query = User.query.filter(User.is_active)

        if class_name:
            query = query.filter(User.class_name == class_name)

        users = (
            query.outerjoin(unlock_subquery, User.id == unlock_subquery.c.student_id)
            .add_columns(func.coalesce(unlock_subquery.c.unlock_count, 0).label("unlock_count_30d"))
            .all()
        )

        ranking_data = []
        for user, unlock_count_30d in users:
            ranking_data.append(
                {
                    "user_id": user.id,
                    "name": user.name,
                    "class_name": user.class_name,
                    "current_score": user.current_score,
                    "unlock_count_30d": unlock_count_30d,
                    "daily_unlock_limit": user.daily_unlock_limit,
                    "remaining_unlock": max(0, user.daily_unlock_limit - user.today_unlock_count),
                }
            )

        if sort_by == "score":
            ranking_data.sort(key=lambda x: x["current_score"], reverse=(order == "desc"))
        elif sort_by == "unlock_count":
            ranking_data.sort(key=lambda x: x["unlock_count_30d"], reverse=(order == "desc"))

        return {
            "ranking": ranking_data[:limit],
            "total_students": len(ranking_data),
            "class_name": class_name or "全部",
        }

    @staticmethod
    def get_class_compare(class_names, period="30d"):
        if not class_names:
            raise ValueError("请至少选择一个班级")

        period_map = {"7d": 7, "30d": 30, "90d": 90}
        days = period_map.get(period, 30)
        start_date = datetime.now() - timedelta(days=days)

        compare_data = []
        for class_name in class_names:
            class_stats = (
                db.session.query(
                    func.count(User.id).label("student_count"),
                    func.coalesce(func.sum(User.current_score), 0).label("total_score"),
                    func.coalesce(func.avg(User.current_score), 0).label("avg_score"),
                    func.max(User.current_score).label("max_score"),
                    func.min(User.current_score).label("min_score"),
                )
                .filter(User.class_name == class_name)
                .first()
            )

            period_records = (
                db.session.query(
                    func.count(ScoreRecord.id).label("total_records"),
                    func.coalesce(func.sum(ScoreRecord.score_change), 0).label("total_change"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    ScoreRecord.score_change > 0,
                                    ScoreRecord.score_change,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("total_add"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    ScoreRecord.score_change < 0,
                                    ScoreRecord.score_change,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("total_subtract"),
                    func.count(distinct(ScoreRecord.student_id)).label("active_students"),
                )
                .join(User)
                .filter(
                    User.class_name == class_name,
                    ScoreRecord.created_at >= start_date,
                )
                .first()
            )

            unlock_stats = (
                db.session.query(
                    func.count(ScoreRecord.id).label("unlock_count"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    ScoreRecord.score_change < 0,
                                    ScoreRecord.score_change,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("unlock_cost"),
                )
                .join(User)
                .filter(
                    User.class_name == class_name,
                    ScoreRecord.description.like("%开锁%"),
                    ScoreRecord.created_at >= start_date,
                )
                .first()
            )

            daily_trend = (
                db.session.query(
                    func.date(ScoreRecord.created_at).label("date"),
                    func.count(ScoreRecord.id).label("record_count"),
                    func.coalesce(func.sum(ScoreRecord.score_change), 0).label("score_change"),
                )
                .join(User)
                .filter(
                    User.class_name == class_name,
                    ScoreRecord.created_at >= start_date,
                )
                .group_by(func.date(ScoreRecord.created_at))
                .order_by(func.date(ScoreRecord.created_at))
            )

            top_students = (
                User.query.filter_by(class_name=class_name)
                .order_by(User.current_score.desc())
                .limit(5)
                .all()
            )

            compare_data.append(
                {
                    "class_name": class_name,
                    "student_count": (class_stats.student_count if class_stats else 0),
                    "total_score": (float(class_stats.total_score) if class_stats else 0),
                    "avg_score": (
                        round(float(class_stats.avg_score), 2)
                        if class_stats and class_stats.avg_score is not None
                        else 0
                    ),
                    "max_score": (
                        float(class_stats.max_score)
                        if class_stats and class_stats.max_score is not None
                        else 0
                    ),
                    "min_score": (
                        float(class_stats.min_score)
                        if class_stats and class_stats.min_score is not None
                        else 0
                    ),
                    "period_records": (period_records.total_records if period_records else 0),
                    "period_total_change": (
                        float(period_records.total_change) if period_records else 0
                    ),
                    "period_total_add": (float(period_records.total_add) if period_records else 0),
                    "period_total_subtract": (
                        abs(float(period_records.total_subtract)) if period_records else 0
                    ),
                    "period_active_students": (
                        period_records.active_students if period_records else 0
                    ),
                    "unlock_count": (unlock_stats.unlock_count if unlock_stats else 0),
                    "unlock_cost": (abs(float(unlock_stats.unlock_cost)) if unlock_stats else 0),
                    "avg_daily_records": round(
                        ((period_records.total_records / days) if period_records else 0),
                        1,
                    ),
                    "daily_trend": [
                        {
                            "date": str(d.date),
                            "record_count": d.record_count,
                            "score_change": float(d.score_change),
                        }
                        for d in daily_trend
                    ],
                    "top_students": [
                        {
                            "id": u.id,
                            "name": u.name,
                            "current_score": u.current_score,
                        }
                        for u in top_students
                    ],
                }
            )

        return {
            "success": True,
            "period": period,
            "days": days,
            "data": compare_data,
        }

    @staticmethod
    def get_dashboard_summary():
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        week_start = today_start - timedelta(days=today.weekday())
        month_start = today_start.replace(day=1)

        total_users = User.query.filter_by(is_active=True).count()
        total_students = User.query.filter(User.is_active, User.class_name.isnot(None)).count()

        today_stats = (
            db.session.query(
                func.count(ScoreRecord.id).label("total_records"),
                func.count(distinct(ScoreRecord.student_id)).label("active_users"),
                func.sum(
                    case(
                        (ScoreRecord.description.contains("开锁"), 1),
                        else_=0,
                    )
                ).label("unlock_count"),
            )
            .filter(ScoreRecord.created_at >= today_start)
            .first()
        )

        today_unlock = today_stats.unlock_count or 0
        today_active_users = today_stats.active_users or 0
        today_new_records = today_stats.total_records or 0

        week_stats = (
            db.session.query(
                func.sum(
                    case(
                        (ScoreRecord.description.contains("开锁"), 1),
                        else_=0,
                    )
                ).label("unlock_count")
            )
            .filter(ScoreRecord.created_at >= week_start)
            .first()
        )

        week_unlock = week_stats.unlock_count or 0

        month_stats = (
            db.session.query(
                func.sum(
                    case(
                        (ScoreRecord.description.contains("开锁"), 1),
                        else_=0,
                    )
                ).label("unlock_count"),
                func.sum(
                    case(
                        (
                            ScoreRecord.score_change < 0,
                            ScoreRecord.score_change,
                        ),
                        else_=0,
                    )
                ).label("total_cost"),
            )
            .filter(ScoreRecord.created_at >= month_start)
            .first()
        )

        month_unlock = month_stats.unlock_count or 0
        month_cost = abs(month_stats.total_cost or 0)

        class_list = (
            db.session.query(User.class_name, func.count(User.id).label("count"))
            .filter(User.class_name.isnot(None), User.is_active)
            .all()
        )

        top_classes = sorted(class_list, key=lambda x: x.count, reverse=True)[:5]

        return {
            "today": {
                "active_users": today_active_users,
                "unlock_count": today_unlock,
                "new_records": today_new_records,
            },
            "week": {
                "unlock_count": week_unlock,
                "avg_daily": round(week_unlock / max(1, today.weekday() + 1), 1),
            },
            "month": {
                "unlock_count": month_unlock,
                "total_cost": month_cost,
                "avg_daily": round(month_unlock / max(1, today.day), 1),
            },
            "totals": {
                "users": total_users,
                "students": total_students,
                "classes": len(class_list),
            },
            "top_classes": [{"name": c.class_name, "count": c.count} for c in top_classes],
        }


analysis_service = AnalysisService()
