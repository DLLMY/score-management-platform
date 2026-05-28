from flask_restx import Namespace, Resource, fields
from models import db, User, ScoreRecord, ScoreRule
from datetime import datetime, timedelta

ns_analysis = Namespace('analysis', description='数据分析相关操作')

@ns_analysis.route('/user/<int:user_id>')
@ns_analysis.param('user_id', '用户ID')
class UserAnalysis(Resource):
    @ns_analysis.doc('get_user_analysis')
    def get(self, user_id):
        user = User.query.get_or_404(user_id)
        
        records = ScoreRecord.query.filter_by(user_id=user_id).order_by(ScoreRecord.created_at.desc()).all()
        
        total_add = sum(r.score_change for r in records if r.score_change > 0)
        total_subtract = sum(r.score_change for r in records if r.score_change < 0)
        
        last_30_days = datetime.now() - timedelta(days=30)
        recent_records = ScoreRecord.query.filter(
            ScoreRecord.user_id == user_id,
            ScoreRecord.created_at >= last_30_days
        ).all()
        
        return {
            'user_id': user.id,
            'user_name': user.name,
            'class_name': user.class_name,
            'current_score': user.current_score,
            'total_add_score': total_add,
            'total_subtract_score': abs(total_subtract),
            'record_count': len(records),
            'recent_30_days_count': len(recent_records),
            'recent_records': [{
                'id': r.id,
                'score_change': r.score_change,
                'description': r.description,
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in recent_records[:20]]
        }

@ns_analysis.route('/class/<string:class_name>')
@ns_analysis.param('class_name', '班级名称')
class ClassAnalysis(Resource):
    @ns_analysis.doc('get_class_analysis')
    def get(self, class_name):
        users = User.query.filter_by(class_name=class_name).all()
        
        total_score = sum(u.current_score for u in users)
        avg_score = total_score / len(users) if users else 0
        max_score = max(u.current_score for u in users) if users else 0
        min_score = min(u.current_score for u in users) if users else 0
        
        last_7_days = datetime.now() - timedelta(days=7)
        weekly_records = ScoreRecord.query.join(User).filter(
            User.class_name == class_name,
            ScoreRecord.created_at >= last_7_days
        ).all()
        
        return {
            'class_name': class_name,
            'student_count': len(users),
            'total_score': total_score,
            'avg_score': round(avg_score, 2),
            'max_score': max_score,
            'min_score': min_score,
            'weekly_record_count': len(weekly_records),
            'weekly_total_change': sum(r.score_change for r in weekly_records),
            'top_students': [{
                'id': u.id,
                'name': u.name,
                'current_score': u.current_score
            } for u in sorted(users, key=lambda x: x.current_score, reverse=True)[:5]]
        }