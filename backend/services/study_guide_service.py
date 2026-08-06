from models import db
from models.study_guide import StudyGuide, ImprovementPlan
from utils.permission import get_current_admin
from services.entity_names import names


class StudyGuideService:
    def list_guides(self, class_id=None, guide_type=None, is_published=True):
        query = StudyGuide.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if guide_type:
            query = query.filter_by(guide_type=guide_type)
        if is_published is not None:
            query = query.filter_by(is_published=is_published)
        guides = query.order_by(StudyGuide.created_at.desc()).all()
        return {"success": True, "data": [self._build_guide_response(g) for g in guides]}

    def create_guide(self, data):
        admin = get_current_admin()
        guide = StudyGuide(
            class_id=data["class_id"],
            title=data["title"],
            guide_type=data.get("guide_type"),
            content=data.get("content"),
            target_audience=data.get("target_audience"),
            created_by=admin.id if admin else None,
        )
        db.session.add(guide)
        db.session.commit()
        return {"success": True, "data": self._build_guide_response(guide)}, 201

    def update_guide(self, guide_id, data):
        guide = StudyGuide.query.get(guide_id)
        if not guide:
            return {"success": False, "message": "学法指导不存在"}, 404
        for key, value in data.items():
            if hasattr(guide, key) and key not in ("id", "created_at"):
                setattr(guide, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_guide_response(guide)}

    def delete_guide(self, guide_id):
        guide = StudyGuide.query.get(guide_id)
        if not guide:
            return {"success": False, "message": "学法指导不存在"}, 404
        db.session.delete(guide)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def list_plans(self, student_id=None, plan_type=None, is_completed=None):
        query = ImprovementPlan.query
        if student_id:
            query = query.filter_by(student_id=student_id)
        if plan_type:
            query = query.filter_by(plan_type=plan_type)
        if is_completed is not None:
            query = query.filter_by(is_completed=is_completed)
        plans = query.order_by(ImprovementPlan.start_date.desc()).all()
        return {"success": True, "data": [self._build_plan_response(p) for p in plans]}

    def create_plan(self, data):
        admin = get_current_admin()
        plan = ImprovementPlan(
            student_id=data["student_id"],
            plan_type=data.get("plan_type", "tutorial"),
            subject_id=data.get("subject_id"),
            target_score=data.get("target_score"),
            current_score=data.get("current_score"),
            plan_content=data.get("plan_content"),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            created_by=admin.id if admin else None,
        )
        db.session.add(plan)
        db.session.commit()
        return {"success": True, "data": self._build_plan_response(plan)}, 201

    def update_plan_progress(self, plan_id, progress):
        plan = ImprovementPlan.query.get(plan_id)
        if not plan:
            return {"success": False, "message": "计划不存在"}, 404
        plan.progress = min(progress, 100)
        if plan.progress >= 100:
            plan.is_completed = True
        db.session.commit()
        return {"success": True, "data": self._build_plan_response(plan)}

    def _build_guide_response(self, g):
        return {
            "id": g.id,
            "class_id": g.class_id,
            "title": g.title,
            "guide_type": g.guide_type,
            "content": g.content,
            "target_audience": g.target_audience,
            "is_published": g.is_published,
        }

    def _build_plan_response(self, p):
        return {
            "id": p.id,
            "student_id": p.student_id,
            "student_name": names.student(p.student_id),
            "plan_type": p.plan_type,
            "subject_id": p.subject_id,
            "subject_name": names.subject(p.subject_id),
            "target_score": p.target_score,
            "current_score": p.current_score,
            "plan_content": p.plan_content,
            "progress": p.progress,
            "is_completed": p.is_completed,
        }


study_guide_service = StudyGuideService()
