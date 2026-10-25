from services.class_ import _shared
"""班级 CRUD：列表/创建/查询/更新/删除。"""

from datetime import datetime
from sqlalchemy import func
from models import (
    User,
    cascade_delete_related_records,
)


class _ClassCrudMixin:
    def get_class_list(self, page=1, per_page=10, keyword=None, admin=None):
        try:
            allowed_classes = _shared.get_allowed_classes(admin.id) if admin else None

            query = _shared.ClassInfo.query
            if allowed_classes is not None:
                query = query.filter(_shared.ClassInfo.name.in_(allowed_classes))

            if keyword:
                query = query.filter(
                    _shared.db.or_(
                        _shared.ClassInfo.name.like(f"%{keyword}%"),
                        _shared.ClassInfo.grade.like(f"%{keyword}%"),
                        _shared.ClassInfo.description.like(f"%{keyword}%"),
                    )
                )

            total = query.count()

            classes = query.order_by(_shared.ClassInfo.name).paginate(
                page=page, per_page=per_page, error_out=False
            )
            items = classes.items

            # R13：批量预取，消除 N+1（原每班各查 Admin + User.count，10 班≈20 次查询 → 2 次）
            teacher_ids = {c.head_teacher_id for c in items if c.head_teacher_id}
            teachers = (
                {a.id: a.real_name for a in _shared.Admin.query.filter(_shared.Admin.id.in_(teacher_ids)).all()}
                if teacher_ids
                else {}
            )
            class_names = {c.name for c in items}
            counts = (
                {
                    r[0]: r[1]
                    for r in User.query.filter(
                        User.class_name.in_(class_names), User.is_active
                    ).with_entities(User.class_name, func.count()).group_by(User.class_name).all()
                }
                if class_names
                else {}
            )

            return {
                "classes": [self._build_class_response(c, teachers, counts) for c in items],
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "pages": (total + per_page - 1) // per_page,
                },
            }
        except Exception:
            raise

    def create_class(self, data):
        if _shared.ClassInfo.query.filter_by(name=data.get("name")).first():
            return {"success": False, "message": "班级名称已存在"}, 400

        class_info = _shared.ClassInfo(
            name=data.get("name"),
            grade=data.get("grade"),
            description=data.get("description"),
            head_teacher_id=data.get("head_teacher_id"),
            is_active=data.get("is_active", True),
        )

        with _shared.db_session_scope(detach=False):
            _shared.db.session.add(class_info)
            _shared.db.session.flush()

            if class_info.head_teacher_id:
                admin_link = _shared.AdminClass(
                    admin_id=class_info.head_teacher_id,
                    class_info_id=class_info.id,
                    is_primary=True,
                    assigned_at=datetime.now(),
                )
                _shared.db.session.add(admin_link)

            response = self._build_class_response(class_info)

        return response, 201

    def get_class(self, class_id, admin=None):
        class_info = _shared.ClassInfo.query.get_or_404(class_id)
        if not self._can_access_class(class_info.name, admin=admin):
            return {"success": False, "message": "无权查看该班级"}, 403
        return self._build_class_response(class_info)

    def update_class(self, class_id, data, admin=None):
        class_info = _shared.ClassInfo.query.get_or_404(class_id)
        if not self._can_access_class(class_info.name, admin=admin):
            return {"success": False, "message": "无权修改该班级"}, 403

        old_name = class_info.name
        new_name = data.get("name", class_info.name)

        if new_name != old_name and not self._can_access_class(new_name, admin=admin):
            return {
                "success": False,
                "message": "无权将班级重命名为该名称",
            }, 403

        if new_name != old_name and _shared.ClassInfo.query.filter_by(name=new_name).first():
            return {"success": False, "message": "班级名称已存在"}, 400

        with _shared.db_session_scope(detach=False):
            class_info.name = new_name
            class_info.grade = data.get("grade", class_info.grade)
            class_info.description = data.get("description", class_info.description)
            class_info.is_active = data.get("is_active", class_info.is_active)
            class_info.updated_at = datetime.now()

            new_head_teacher_id = data.get("head_teacher_id", class_info.head_teacher_id)
            if new_head_teacher_id != class_info.head_teacher_id:
                if class_info.head_teacher_id:
                    prev_link = _shared.AdminClass.query.filter_by(
                        admin_id=class_info.head_teacher_id,
                        class_info_id=class_info.id,
                    ).first()
                    if prev_link:
                        prev_link.is_primary = False

                if new_head_teacher_id:
                    admin_link = _shared.AdminClass.query.filter_by(
                        admin_id=new_head_teacher_id,
                        class_info_id=class_info.id,
                    ).first()
                    if admin_link:
                        admin_link.is_primary = True
                    else:
                        admin_link = _shared.AdminClass(
                            admin_id=new_head_teacher_id,
                            class_info_id=class_info.id,
                            is_primary=True,
                            assigned_at=datetime.now(),
                        )
                        _shared.db.session.add(admin_link)

                class_info.head_teacher_id = new_head_teacher_id

            if old_name != class_info.name:
                User.query.filter_by(class_name=old_name).update({"class_name": class_info.name})

            # Build response inside session to avoid DetachedInstanceError
            return self._build_class_response(class_info)

    def delete_class(self, class_id, admin=None):
        class_info = _shared.ClassInfo.query.get_or_404(class_id)
        if not self._can_access_class(class_info.name, admin=admin):
            return {"success": False, "message": "无权删除该班级"}, 403

        with _shared.db_session_scope(detach=False):
            _shared.AdminClass.query.filter_by(class_info_id=class_id).delete()
            # 班级存在多级子表依赖（如 class_info -> seating_chart -> seating_seat、
            # class_info -> duty_group -> duty_assignment），需递归清理；
            # user.class_info_id 等可空外键只解除引用，不会删除学生
            cascade_delete_related_records(_shared.ClassInfo, class_id)
            _shared.db.session.delete(class_info)

        return {"success": True, "message": "班级删除成功"}
