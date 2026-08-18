from celery_app import celery_app
from datetime import datetime

import os
from app import app
from models import User
from services.export_service import ExportService
from sqlalchemy import and_


@celery_app.task(bind=True, name="tasks.export_tasks.export_users", queue="export")
def export_users(self, user_ids=None):
    """
    导出用户数据（通过export_service）
    Args:
        user_ids: 用户ID列表（可选），为空则导出全部用户
    """
    try:
        from app import app
        from services.export_service import ExportService
        from models import User

        with app.app_context():
            query = User.query
            if user_ids:
                query = query.filter(User.id.in_(user_ids))
            users = query.all()
            users_data = []
            for user in users:
                users_data.append(
                    {
                        "id": user.id,
                        "name": user.name,
                        "card_id": user.card_id,
                        "class_name": user.class_name or "",
                        "score": user.score or 0,
                        "status": user.status,
                        "created_at": user.created_at.isoformat() if user.created_at else "",
                    }
                )
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"users_export_{timestamp}.csv"
        exports_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")
        filepath = os.path.join(exports_dir, filename)
        ExportService.export_users_to_csv(users_data, filepath)
        return {"success": True, "filename": filename, "path": filepath, "count": len(users_data)}
    except Exception as e:
        self.retry(exc=e, countdown=5, max_retries=2)
        return {"success": False, "error": str(e)}


@celery_app.task(bind=True, name="tasks.export_tasks.export_score_records", queue="export")
def export_score_records(self, user_id=None, start_date=None, end_date=None):
    """
    导出积分记录（通过export_service）
    Args:
        user_id: 用户ID（可选）
        start_date: 开始日期
        end_date: 结束日期
    """
    try:
        from models import ScoreRecord, ScoreRule
        from sqlalchemy import and_

        with app.app_context():
            query = ScoreRecord.query.join(User, ScoreRecord.student_id == User.id).outerjoin(
                ScoreRule, ScoreRecord.rule_id == ScoreRule.id
            )
            conditions = []
            if user_id:
                conditions.append(ScoreRecord.student_id == user_id)
            if start_date:
                conditions.append(ScoreRecord.created_at >= start_date)
            if end_date:
                conditions.append(ScoreRecord.created_at <= end_date)
            if conditions:
                query = query.filter(and_(*conditions))
            records = query.order_by(ScoreRecord.created_at.desc()).all()
            records_data = []
            for record in records:
                records_data.append(
                    {
                        "id": record.id,
                        "user_id": record.student_id,
                        "user_name": record.user.name if record.user else "",
                        "rule_id": record.rule_id or "",
                        "rule_name": record.rule.name if record.rule else "",
                        "score_change": record.score_change,
                        "description": record.description or "",
                        "created_at": record.created_at.isoformat() if record.created_at else "",
                    }
                )
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"score_records_export_{timestamp}.csv"
        exports_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")
        filepath = os.path.join(exports_dir, filename)
        ExportService.export_score_records_to_csv(records_data, filepath)
        return {"success": True, "filename": filename, "path": filepath, "count": len(records_data)}
    except Exception as e:
        self.retry(exc=e, countdown=5, max_retries=2)
        return {"success": False, "error": str(e)}


@celery_app.task(bind=True, name="tasks.export_tasks.export_exam_scores", queue="export")
def export_exam_scores(self, exam_id=None, class_id=None):
    """
    导出考试成绩（通过export_service）
    Args:
        exam_id: 考试ID（可选）
        class_id: 班级ID（可选）
    """
    try:
        from models import Score, Exam

        with app.app_context():
            query = Score.query.join(User, Score.student_id == User.id).outerjoin(
                Exam, Score.exam_id == Exam.id
            )
            conditions = []
            if exam_id:
                conditions.append(Score.exam_id == exam_id)
            if class_id:
                conditions.append(User.class_name == class_id)
            if conditions:
                query = query.filter(and_(*conditions))
            scores = query.all()
            scores_data = []
            for score in scores:
                scores_data.append(
                    {
                        "id": score.id,
                        "student_id": score.student_id,
                        "student_name": score.user.name if score.user else "",
                        "exam_id": score.exam_id or "",
                        "exam_name": score.exam.name if score.exam else "",
                        "subject": score.subject_rel.name if score.subject_rel else "",
                        "score": score.score or 0,
                        "created_at": score.created_at.isoformat() if score.created_at else "",
                    }
                )
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"exam_scores_export_{timestamp}.csv"
        exports_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")
        filepath = os.path.join(exports_dir, filename)
        ExportService.export_exam_scores_to_csv(scores_data, filepath)
        return {"success": True, "filename": filename, "path": filepath, "count": len(scores_data)}
    except Exception as e:
        self.retry(exc=e, countdown=5, max_retries=2)
        return {"success": False, "error": str(e)}
