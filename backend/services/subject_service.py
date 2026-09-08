"""科目只读查询服务层（薄路由下沉）。

仅承载路由层 GET 端点的只读编排（列表/详情/关联班级/导出数据准备）。
不触碰写操作（SubjectToggle.get 实为写，刻意不下沉）、不构造信封
（SubjectResource.get 返回裸 dict，原样保留）、不处理 send_file 等表现层细节。

SubjectExport.get 的 Excel/CSV/JSON 格式分派与 send_file 留在路由层，
本服务只准备纯数据 export_data（list of dict）。
"""

from models import db, Subject, SubjectClass, ClassInfo, Admin, get_by_id
from utils.pagination import get_pagination
from utils.query_optimizer import count_by_fk


def get_subject_list_view(include_inactive=False, search=None):
    """科目列表（分页 + 搜索 + 关联班级数）。返回 {items, pagination}。"""
    query = Subject.query
    if not include_inactive:
        query = query.filter_by(is_active=True)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                Subject.name.like(search_pattern),
                Subject.code.like(search_pattern),
                Subject.grade.like(search_pattern),
            )
        )
    page, per_page = get_pagination(default=20)
    pagination = query.order_by(Subject.sort_order, Subject.name).paginate(
        page=page, per_page=per_page, error_out=False
    )
    subjects = pagination.items
    # P3: in_ 聚合替代循环内 count（单查询 group by）
    subject_ids = [s.id for s in subjects]
    class_counts = count_by_fk(SubjectClass, SubjectClass.subject_id, subject_ids)
    items = [{**s.to_dict(), "class_count": class_counts.get(s.id, 0)} for s in subjects]
    return {
        "items": items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
    }


def get_subject_detail_view(subject_id):
    """科目详情（裸 dict + class_count）。返回 dict 或 None（None 由路由转 404）。

    注意：原路由返回裸 dict（非 APIResponse 信封）并依赖 get_or_404 的 404 契约，
    此处返回 None 由路由等价处理，保持响应形态不变。
    """
    subject = get_by_id(Subject, subject_id)
    if not subject:
        return None
    class_count = SubjectClass.query.filter_by(subject_id=subject_id).count()
    return {**subject.to_dict(), "class_count": class_count}


def get_subject_classes_view(subject_id):
    """科目关联班级列表。返回 {classes: [...]} 或 None（科目不存在）。"""
    subject = get_by_id(Subject, subject_id)
    if not subject:
        return None
    links = SubjectClass.query.filter_by(subject_id=subject_id).all()
    result = []
    for link in links:
        teacher = get_by_id(Admin, link.teacher_id) if link.teacher_id else None
        class_info = get_by_id(ClassInfo, link.class_info_id)
        result.append(
            {
                "id": link.id,
                "class_info_id": link.class_info_id,
                "class_name": class_info.name if class_info else "",
                "grade": class_info.grade if class_info else "",
                "teacher_id": link.teacher_id,
                "teacher_name": teacher.real_name if teacher else None,
                "created_at": link.created_at.isoformat() if link.created_at else None,
            }
        )
    return {"classes": result}


def get_subject_export_data_view(include_inactive=False, search=None):
    """科目导出数据准备（不含 Excel/CSV/JSON 格式分派与 send_file）。

    返回 export_data：list of dict，每个含 name/code/grade/.../classes 等字段。
    """
    query = Subject.query
    if not include_inactive:
        query = query.filter_by(is_active=True)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                Subject.name.like(search_pattern),
                Subject.code.like(search_pattern),
                Subject.grade.like(search_pattern),
            )
        )
    subjects = query.order_by(Subject.name).all()
    if not subjects:
        return []
    # 批量获取所有科目关联（1次查询）
    subject_ids = [s.id for s in subjects]
    class_links = SubjectClass.query.filter(SubjectClass.subject_id.in_(subject_ids)).all()

    # 批量获取所有班级信息（1次查询）
    class_info_ids = list(set(link.class_info_id for link in class_links if link.class_info_id))
    class_info_map = {}
    if class_info_ids:
        class_infos = ClassInfo.query.filter(ClassInfo.id.in_(class_info_ids)).all()
        class_info_map = {c.id: c for c in class_infos}

    # 批量获取所有教师信息（1次查询）
    teacher_ids = list(set(link.teacher_id for link in class_links if link.teacher_id))
    teacher_map = {}
    if teacher_ids:
        teachers = Admin.query.filter(Admin.id.in_(teacher_ids)).all()
        teacher_map = {t.id: t for t in teachers}

    # 构建科目关联映射
    subject_class_map = {}
    for link in class_links:
        subject_class_map.setdefault(link.subject_id, []).append(link)

    # 构建导出数据（无额外查询）
    export_data = []
    for s in subjects:
        classes = []
        for link in subject_class_map.get(s.id, []):
            class_info = class_info_map.get(link.class_info_id)
            teacher = teacher_map.get(link.teacher_id)
            classes.append(
                {
                    "class_info_id": link.class_info_id,
                    "class_name": class_info.name if class_info else "",
                    "grade": class_info.grade if class_info else "",
                    "teacher_id": link.teacher_id,
                    "teacher_name": teacher.real_name if teacher else None,
                }
            )
        export_data.append(
            {
                "name": s.name,
                "code": s.code,
                "grade": s.grade,
                "description": s.description,
                "color": s.color,
                "is_active": "是" if s.is_active else "否",
                "classes": classes,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
        )
    return export_data
