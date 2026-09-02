from models import db, User
from models.teacher_comment import TeacherComment
from utils.permission import get_current_admin, get_admin_class_ids
from services.entity_names import names


class TeacherCommentService:
    def list_comments(self, class_id=None, student_id=None, term=None, page=None, per_page=None):
        query = TeacherComment.query
        # 隐私隔离：非超管（班主任）只能看自己关联班级学生的评语，口径与 parent/mental 一致。
        # 隔离过滤与显式 class_id 过滤都需 join User（评语无 class_id 字段），合并为单次 join。
        admin = get_current_admin()
        is_scoped = admin is not None and admin.role not in ("admin", "super_admin")
        if is_scoped or class_id:
            query = query.join(User, User.id == TeacherComment.student_id)
            if is_scoped:
                allowed_ids = get_admin_class_ids(admin.id)
                if allowed_ids:
                    query = query.filter(User.class_info_id.in_(allowed_ids))
                else:
                    query = query.filter(False)
            if class_id:
                query = query.filter(User.class_info_id == class_id)
        if student_id:
            query = query.filter_by(student_id=student_id)
        if term:
            query = query.filter_by(term=term)
        query = query.order_by(TeacherComment.created_at.desc())
        if page is not None and per_page is not None:
            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            return {
                "success": True,
                "data": {
                    "comments": [self._build_response(c) for c in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        comments = query.all()
        return {"success": True, "data": [self._build_response(c) for c in comments]}

    def get_comment(self, comment_id):
        comment = TeacherComment.query.get(comment_id)
        if not comment:
            return {"success": False, "message": "评语不存在"}, 404
        denied = self._ensure_access(comment)
        if denied:
            return denied
        return {"success": True, "data": self._build_response(comment)}

    def create_comment(self, data):
        admin = get_current_admin()
        if not data.get("student_id"):
            return {"success": False, "message": "缺少必填字段: student_id"}, 400
        if not data.get("content", "").strip():
            return {"success": False, "message": "评语内容不能为空"}, 400
        comment = TeacherComment(
            student_id=data["student_id"],
            term=data.get("term"),
            comment_type=data.get("comment_type", "term"),
            rating=data.get("rating"),
            content=data["content"],
            created_by=admin.id if admin else None,
        )
        db.session.add(comment)
        db.session.commit()
        return {"success": True, "data": self._build_response(comment)}, 201

    def update_comment(self, comment_id, data):
        comment = TeacherComment.query.get(comment_id)
        if not comment:
            return {"success": False, "message": "评语不存在"}, 404
        denied = self._ensure_access(comment)
        if denied:
            return denied
        for key, value in data.items():
            if hasattr(comment, key) and key not in ("id", "student_id", "created_by", "created_at"):
                setattr(comment, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_response(comment)}

    def delete_comment(self, comment_id):
        comment = TeacherComment.query.get(comment_id)
        if not comment:
            return {"success": False, "message": "评语不存在"}, 404
        denied = self._ensure_access(comment)
        if denied:
            return denied
        db.session.delete(comment)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def _ensure_access(self, comment):
        """隐私隔离：非超管只能操作自己关联班级学生的评语。"""
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            student = User.query.get(comment.student_id)
            if not allowed_ids or not (student and student.class_info_id in allowed_ids):
                return {"success": False, "message": "无权操作该学生的评语"}, 403
        return None

    def _build_response(self, c):
        return {
            "id": c.id,
            "student_id": c.student_id,
            "student_name": names.student(c.student_id),
            "term": c.term,
            "comment_type": c.comment_type,
            "rating": c.rating,
            "content": c.content,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }


teacher_comment_service = TeacherCommentService()
