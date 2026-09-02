from models import db, User
from models.study_guide import StudyGuide, ImprovementPlan
from utils.permission import get_current_admin, get_admin_class_ids
from utils.entity_guard import (
    require_class,
    class_not_found_response,
    require_student,
    student_not_found_response,
)
from services.entity_names import names


class StudyGuideService:
    def list_guides(self, class_id=None, guide_type=None, is_published=True, page=None, per_page=None):
        query = StudyGuide.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if guide_type:
            query = query.filter_by(guide_type=guide_type)
        if is_published is not None:
            query = query.filter_by(is_published=is_published)
        query = query.order_by(StudyGuide.created_at.desc())
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "guides": [self._build_guide_response(g) for g in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        guides = query.all()
        return {"success": True, "data": [self._build_guide_response(g) for g in guides]}

    def create_guide(self, data):
        admin = get_current_admin()
        if not require_class(data.get("class_id")):
            return class_not_found_response("创建学法指导")
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

    def list_plans(self, student_id=None, plan_type=None, is_completed=None, page=None, per_page=None):
        query = ImprovementPlan.query
        if student_id:
            query = query.filter_by(student_id=student_id)
        if plan_type:
            query = query.filter_by(plan_type=plan_type)
        if is_completed is not None:
            query = query.filter_by(is_completed=is_completed)
        query = query.order_by(ImprovementPlan.start_date.desc())
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "plans": [self._build_plan_response(p) for p in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        plans = query.all()
        return {"success": True, "data": [self._build_plan_response(p) for p in plans]}

    def create_plan(self, data):
        admin = get_current_admin()
        if not require_student(data.get("student_id")):
            return student_not_found_response("创建改进计划")
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
        denied = self._ensure_plan_access(plan)
        if denied:
            return denied
        # 进度收敛到 [0,100]：update_plan_progress 原实现仅 min(...,100) 防上界，未防负值
        plan.progress = max(0, min(int(progress), 100))
        plan.is_completed = plan.progress >= 100
        db.session.commit()
        return {"success": True, "data": self._build_plan_response(plan)}

    def update_plan(self, plan_id, data):
        plan = ImprovementPlan.query.get(plan_id)
        if not plan:
            return {"success": False, "message": "计划不存在"}, 404
        denied = self._ensure_plan_access(plan)
        if denied:
            return denied
        for key, value in data.items():
            if hasattr(plan, key) and key not in ("id", "student_id", "created_by", "created_at"):
                setattr(plan, key, value)
        if "progress" in data and data["progress"] is not None:
            plan.progress = max(0, min(int(data["progress"]), 100))
            plan.is_completed = plan.progress >= 100
        db.session.commit()
        return {"success": True, "data": self._build_plan_response(plan)}

    def delete_plan(self, plan_id):
        plan = ImprovementPlan.query.get(plan_id)
        if not plan:
            return {"success": False, "message": "计划不存在"}, 404
        denied = self._ensure_plan_access(plan)
        if denied:
            return denied
        db.session.delete(plan)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def _ensure_plan_access(self, plan):
        """隐私隔离：非超管只能操作自己关联班级学生的改进计划（口径与 parent/mental 一致）。"""
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            student = User.query.get(plan.student_id)
            if not allowed_ids or not (student and student.class_info_id in allowed_ids):
                return {"success": False, "message": "无权操作该学生的改进计划"}, 403
        return None

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
