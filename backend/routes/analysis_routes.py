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


from flask import request
from utils.permission import requires_admin
from sqlalchemy import func


@ns_analysis.route('/unlock-stats')
class UnlockStats(Resource):
    @ns_analysis.doc('get_unlock_stats', description='获取开锁统计数据')
    @ns_analysis.param('start_date', '开始日期(YYYY-MM-DD)')
    @ns_analysis.param('end_date', '结束日期(YYYY-MM-DD)')
    @ns_analysis.param('device_id', '设备ID')
    @ns_analysis.param('class_name', '班级名称')
    @ns_analysis.response(200, '成功')
    @requires_admin
    def get(self):
        """
        获取开锁统计数据

        支持按日期范围、设备、班级进行筛选。
        """
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        device_id = request.args.get('device_id')
        class_name = request.args.get('class_name')

        query = ScoreRecord.query.filter(
            ScoreRecord.description.like('%开锁%')
        )

        if start_date:
            query = query.filter(ScoreRecord.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(ScoreRecord.created_at <= datetime.fromisoformat(end_date) + timedelta(days=1))

        records = query.all()

        if class_name:
            records = [r for r in records if r.user and r.user.class_name == class_name]

        total_unlock_count = len(records)
        total_cost = abs(sum(r.score_change for r in records if r.score_change < 0))

        daily_stats = {}
        for record in records:
            date_key = record.created_at.strftime('%Y-%m-%d')
            if date_key not in daily_stats:
                daily_stats[date_key] = {'count': 0, 'cost': 0}
            daily_stats[date_key]['count'] += 1
            if record.score_change < 0:
                daily_stats[date_key]['cost'] += abs(record.score_change)

        peak_hour = {}
        for record in records:
            hour = record.created_at.hour
            peak_hour[hour] = peak_hour.get(hour, 0) + 1

        peak_hour_sorted = sorted(peak_hour.items(), key=lambda x: x[1], reverse=True)
        peak_hours = [h[0] for h in peak_hour_sorted[:3]]

        return {
            'total_unlock_count': total_unlock_count,
            'total_cost': total_cost,
            'daily_stats': [{'date': k, **v} for k, v in sorted(daily_stats.items())],
            'peak_hours': peak_hours,
            'avg_daily': round(total_unlock_count / max(1, len(daily_stats)), 1)
        }


@ns_analysis.route('/class-ranking')
class ClassRanking(Resource):
    @ns_analysis.doc('get_class_ranking', description='获取班级排名')
    @ns_analysis.param('sort_by', '排序字段(score/unlock_count/avg_score)')
    @ns_analysis.param('order', '排序方向(desc/asc)')
    @ns_analysis.param('limit', '返回数量限制')
    @ns_analysis.response(200, '成功')
    @requires_admin
    def get(self):
        """
        获取班级排名

        按积分总额、开锁次数、平均积分等指标进行排名。
        """
        sort_by = request.args.get('sort_by', 'total_score')
        order = request.args.get('order', 'desc')
        limit = int(request.args.get('limit', 20))

        last_30_days = datetime.now() - timedelta(days=30)

        class_stats = db.session.query(
            User.class_name,
            func.count(User.id).label('student_count'),
            func.sum(User.current_score).label('total_score'),
            func.avg(User.current_score).label('avg_score')
        ).filter(
            User.class_name.isnot(None)
        ).group_by(User.class_name).all()

        ranking_data = []
        for stat in class_stats:
            unlock_count = ScoreRecord.query.join(User).filter(
                User.class_name == stat.class_name,
                ScoreRecord.description.like('%开锁%'),
                ScoreRecord.created_at >= last_30_days
            ).count()

            ranking_data.append({
                'class_name': stat.class_name,
                'student_count': stat.student_count,
                'total_score': stat.total_score or 0,
                'avg_score': round(stat.avg_score or 0, 2),
                'unlock_count_30d': unlock_count,
                'unlock_cost_30d': abs(sum(
                    r.score_change for r in ScoreRecord.query.join(User).filter(
                        User.class_name == stat.class_name,
                        ScoreRecord.description.like('%开锁%'),
                        ScoreRecord.created_at >= last_30_days
                    ).all() if r.score_change < 0
                ))
            })

        if sort_by == 'total_score':
            ranking_data.sort(key=lambda x: x['total_score'], reverse=(order == 'desc'))
        elif sort_by == 'avg_score':
            ranking_data.sort(key=lambda x: x['avg_score'], reverse=(order == 'desc'))
        elif sort_by == 'unlock_count':
            ranking_data.sort(key=lambda x: x['unlock_count_30d'], reverse=(order == 'desc'))

        return {
            'ranking': ranking_data[:limit],
            'total_classes': len(ranking_data)
        }


@ns_analysis.route('/student-ranking')
class StudentRanking(Resource):
    @ns_analysis.doc('get_student_ranking', description='获取学生排名')
    @ns_analysis.param('class_name', '班级名称(可选)')
    @ns_analysis.param('sort_by', '排序字段(score/unlock_count)')
    @ns_analysis.param('order', '排序方向(desc/asc)')
    @ns_analysis.param('limit', '返回数量限制')
    @ns_analysis.response(200, '成功')
    @requires_admin
    def get(self):
        """
        获取学生排名

        按积分、开锁次数等指标进行排名。
        """
        class_name = request.args.get('class_name')
        sort_by = request.args.get('sort_by', 'score')
        order = request.args.get('order', 'desc')
        limit = int(request.args.get('limit', 50))

        query = User.query.filter(User.is_active == True)

        if class_name:
            query = query.filter(User.class_name == class_name)

        users = query.all()

        last_30_days = datetime.now() - timedelta(days=30)

        ranking_data = []
        for user in users:
            unlock_count = ScoreRecord.query.filter(
                ScoreRecord.user_id == user.id,
                ScoreRecord.description.like('%开锁%'),
                ScoreRecord.created_at >= last_30_days
            ).count()

            ranking_data.append({
                'user_id': user.id,
                'name': user.name,
                'class_name': user.class_name,
                'current_score': user.current_score,
                'unlock_count_30d': unlock_count,
                'daily_unlock_limit': user.daily_unlock_limit,
                'remaining_unlock': max(0, user.daily_unlock_limit - user.today_unlock_count)
            })

        if sort_by == 'score':
            ranking_data.sort(key=lambda x: x['current_score'], reverse=(order == 'desc'))
        elif sort_by == 'unlock_count':
            ranking_data.sort(key=lambda x: x['unlock_count_30d'], reverse=(order == 'desc'))

        return {
            'ranking': ranking_data[:limit],
            'total_students': len(ranking_data),
            'class_name': class_name or '全部'
        }


@ns_analysis.route('/dashboard-summary')
class DashboardSummary(Resource):
    @ns_analysis.doc('get_dashboard_summary', description='获取仪表盘汇总数据')
    @ns_analysis.response(200, '成功')
    @requires_admin
    def get(self):
        """
        获取仪表盘汇总数据

        提供整体运营数据的快速概览。
        """
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        week_start = today_start - timedelta(days=today.weekday())
        month_start = today_start.replace(day=1)

        total_users = User.query.filter_by(is_active=True).count()
        total_students = User.query.filter(
            User.is_active == True,
            User.class_name.isnot(None)
        ).count()

        total_devices = db.session.query(func.count(db.func.distinct(db.column('device_id')))).scalar() or 0

        today_records = ScoreRecord.query.filter(ScoreRecord.created_at >= today_start).all()
        today_unlock = len([r for r in today_records if '开锁' in (r.description or '')])

        week_records = ScoreRecord.query.filter(ScoreRecord.created_at >= week_start).all()
        week_unlock = len([r for r in week_records if '开锁' in (r.description or '')])

        month_records = ScoreRecord.query.filter(ScoreRecord.created_at >= month_start).all()
        month_unlock = len([r for r in month_records if '开锁' in (r.description or '')])
        month_cost = abs(sum(r.score_change for r in month_records if r.score_change < 0))

        class_list = db.session.query(
            User.class_name,
            func.count(User.id).label('count')
        ).filter(
            User.class_name.isnot(None),
            User.is_active == True
        ).group_by(User.class_name).all()

        top_classes = sorted(class_list, key=lambda x: x.count, reverse=True)[:5]

        return {
            'today': {
                'active_users': len(set(r.user_id for r in today_records if r.user_id)),
                'unlock_count': today_unlock,
                'new_records': len(today_records)
            },
            'week': {
                'unlock_count': week_unlock,
                'avg_daily': round(week_unlock / max(1, today.weekday() + 1), 1)
            },
            'month': {
                'unlock_count': month_unlock,
                'total_cost': month_cost,
                'avg_daily': round(month_unlock / max(1, today.day), 1)
            },
            'totals': {
                'users': total_users,
                'students': total_students,
                'classes': len(class_list)
            },
            'top_classes': [{'name': c.class_name, 'count': c.count} for c in top_classes]
        }