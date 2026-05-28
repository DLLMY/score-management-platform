from flask_restx import Namespace, Resource, fields
from models import db, User, ScoreRecord, Device, ScoreRule, Admin
from services.cache_service import cache_service
from datetime import datetime, timedelta

ns_dashboard = Namespace('dashboard', description='仪表板数据相关操作')

@ns_dashboard.route('/data')
class DashboardData(Resource):
    @ns_dashboard.doc('get_dashboard_data')
    def get(self):
        cache_key = "dashboard_data"
        cached_result = cache_service.get(cache_key)
        if cached_result is not None:
            return cached_result

        total_users = User.query.count()
        total_admins = Admin.query.count()
        total_rules = ScoreRule.query.filter_by(is_active=True).count()
        total_devices = Device.query.count()
        online_devices = Device.query.filter_by(status='online').count()
        
        today = datetime.now().date()
        today_records = ScoreRecord.query.filter(
            ScoreRecord.created_at >= datetime.combine(today, datetime.min.time())
        ).count()
        
        last_7_days = datetime.now() - timedelta(days=7)
        weekly_records = ScoreRecord.query.filter(
            ScoreRecord.created_at >= last_7_days
        ).count()
        
        avg_score = db.session.query(db.func.avg(User.current_score)).scalar() or 0
        
        top_users = User.query.order_by(User.current_score.desc()).limit(10).all()
        
        category_stats = db.session.query(
            ScoreRecord.rule_id,
            db.func.sum(ScoreRecord.score_change)
        ).group_by(ScoreRecord.rule_id).limit(10).all()
        
        result = {
            'total_users': total_users,
            'total_admins': total_admins,
            'total_rules': total_rules,
            'total_devices': total_devices,
            'online_devices': online_devices,
            'today_records': today_records,
            'weekly_records': weekly_records,
            'avg_score': round(avg_score, 2),
            'top_users': [{
                'id': u.id,
                'name': u.name,
                'class_name': u.class_name,
                'current_score': u.current_score
            } for u in top_users],
            'category_stats': [{
                'rule_id': r[0],
                'total_score': r[1]
            } for r in category_stats]
        }

        cache_service.set(cache_key, result, ttl=60)
        return result