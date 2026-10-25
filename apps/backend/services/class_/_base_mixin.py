from services.class_ import _shared
"""班级私有助手与初始化（__init__ + 4 个内部判定/构造助手）。"""

from models import (
    User,
)


class _ClassBaseMixin:
    def __init__(self):
        pass

    def _can_access_class(self, class_name, admin=None):
        if admin is None:
            return False
        allowed_classes = _shared.get_allowed_classes(admin.id)
        if allowed_classes is None:
            return True
        return class_name in allowed_classes

    def _get_head_teacher_name(self, head_teacher_id):
        if not head_teacher_id:
            return None
        admin = _shared.get_by_id(_shared.Admin, head_teacher_id)
        return admin.real_name if admin else None

    def _get_student_count(self, class_info):
        return User.query.filter(
            User.class_name == class_info.name,
            User.is_active,
        ).count()

    def _build_class_response(self, class_info, teachers=None, counts=None):
        # B3 收敛：基础列走 _shared.ClassInfo.to_dict，计算字段叠加（2026-08-30）
        # teachers/counts 为批量预取字典（R13 消除 N+1）；None 时回退逐班查询以兼容详情页
        data = class_info.to_dict()
        if teachers is not None:
            data["head_teacher_name"] = teachers.get(class_info.head_teacher_id)
        else:
            data["head_teacher_name"] = self._get_head_teacher_name(class_info.head_teacher_id)
        if counts is not None:
            data["student_count"] = counts.get(class_info.name, 0)
        else:
            data["student_count"] = self._get_student_count(class_info)
        return data
