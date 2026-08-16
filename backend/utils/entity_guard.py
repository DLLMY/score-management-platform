"""实体存在性校验辅助（统一引用型字段的 404 语义）。

背景：字段统一化后 culture/activity/study_guide 三个服务各自内联
`get_by_id(ClassInfo, ...)` + 统一错误返回，重复三份。本模块收敛，
后续新增实体引用校验（学生/科目等）同样在此扩展。
"""
from models import ClassInfo, User, get_by_id


def require_class(class_id):
    """校验班级存在性，返回 ClassInfo 或 None（不存在/为空）。"""
    if not class_id:
        return None
    return get_by_id(ClassInfo, class_id)


def class_not_found_response(action="执行操作"):
    """统一"班级不存在"错误响应（与 services 返回约定一致：(dict, status_code)）。"""
    return {"success": False, "message": f"班级不存在，无法{action}"}, 400


def require_student(student_id):
    """校验学生存在性，返回 User 或 None（不存在/为空）。"""
    if not student_id:
        return None
    return get_by_id(User, student_id)


def student_not_found_response(action="执行操作"):
    """统一"学生不存在"错误响应（与 services 返回约定一致：(dict, status_code)）。"""
    return {"success": False, "message": f"学生不存在，无法{action}"}, 400
