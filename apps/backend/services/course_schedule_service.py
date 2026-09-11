"""课程表只读端点的业务逻辑编排层（薄路由下沉）。

将 ``api/academics/course_schedule_routes.py`` 中内联的读逻辑与序列化 helper 下沉到这里，
路由层仅负责参数解析、鉴权装饰器与 HTTP 信封，保持零契约漂移。

- ``*_view`` 系列返回纯数据（dict / tuple），由路由决定如何包装进 ``APIResponse``；
- 纯计算 / 查询 helper（``format_day_of_week`` / ``get_period_info`` / ``_schedule_dict`` /
  ``check_conflicts`` 等）集中于此，路由中的写端点（post/put/import）仍 ``from`` 此处引用，
  调用签名与迁移前完全一致。
"""

from datetime import datetime

from models import (
    ClassInfo,
    ClassPeriod,
    CourseSchedule,
    Subject,
    get_by_id,
)
from sqlalchemy.orm import joinedload
from services.class_time_checker import ClassTimeChecker
from utils.pagination import get_pagination
from utils.permission import get_allowed_classes, get_current_admin


def format_day_of_week(day):
    days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    return days[day] if 0 <= day <= 6 else "未知"


def get_period_info(period_number):
    period = ClassPeriod.query.filter_by(period_number=period_number).first()
    if period:
        return {
            "name": period.name,
            "time": (
                f"{period.start_hour:02d}:{period.start_minute:02d} - "
                f"{period.end_hour:02d}:{period.end_minute:02d}"
            ),
        }
    return {"name": f"第{period_number}节", "time": ""}


def _schedule_dict(schedule):
    """课程排班响应序列化（B3 扩展 2026-08-23）。

    收敛 list / detail 两处字段集一致的完整内联 dict；
    基础字段走 CourseSchedule.to_dict()，派生字段（关联名/时段文本）在此补充。
    """
    period_info = get_period_info(schedule.period_number)
    data = schedule.to_dict()
    data.update(
        {
            "class_name": schedule.class_info.name if schedule.class_info else "",
            "subject_name": schedule.subject.name if schedule.subject else "",
            "subject_color": (schedule.subject.color if schedule.subject else schedule.color),
            "day_of_week_text": format_day_of_week(schedule.day_of_week),
            "period_name": period_info["name"],
            "period_time": period_info["time"],
        }
    )
    return data


def check_conflicts(class_info_id, day_of_week, period_number, exclude_id=None):
    conflicts = []

    class_conflict = CourseSchedule.query.filter(
        CourseSchedule.id != (exclude_id or -1),
        CourseSchedule.class_info_id == class_info_id,
        CourseSchedule.day_of_week == day_of_week,
        CourseSchedule.period_number == period_number,
        CourseSchedule.is_active,
    ).first()

    if class_conflict:
        subject_name = class_conflict.subject.name if class_conflict.subject else ""
        conflicts.append(
            {
                "type": "class",
                "message": f"该班级此时段已有课程：{subject_name}",
                "schedule_id": class_conflict.id,
                "conflicting_class_name": (
                    class_conflict.class_info.name if class_conflict.class_info else ""
                ),
                "conflicting_subject_name": subject_name,
                "conflicting_teacher_name": class_conflict.teacher_name,
                "conflicting_classroom": class_conflict.classroom,
            }
        )

    return conflicts


def check_teacher_conflicts(
    teacher_name, day_of_week, period_number, exclude_id=None, exclude_class_id=None
):
    conflicts = []

    if not teacher_name:
        return conflicts

    teacher_conflicts = CourseSchedule.query.filter(
        CourseSchedule.id != (exclude_id or -1),
        CourseSchedule.teacher_name == teacher_name,
        CourseSchedule.day_of_week == day_of_week,
        CourseSchedule.period_number == period_number,
        CourseSchedule.is_active,
    ).all()

    for conflict in teacher_conflicts:
        if exclude_class_id and conflict.class_info_id == exclude_class_id:
            continue

        class_name = conflict.class_info.name if conflict.class_info else ""
        subject_name = conflict.subject.name if conflict.subject else ""
        conflicts.append(
            {
                "type": "teacher",
                "message": f"教师 {teacher_name} 此时段已有课程：{class_name} - {subject_name}",
                "schedule_id": conflict.id,
                "conflicting_class_name": class_name,
                "conflicting_subject_name": subject_name,
                "conflicting_teacher_name": conflict.teacher_name,
                "conflicting_classroom": conflict.classroom,
            }
        )

    return conflicts


def check_classroom_conflicts(
    classroom, day_of_week, period_number, exclude_id=None, exclude_class_id=None
):
    conflicts = []

    if not classroom:
        return conflicts

    classroom_conflicts = CourseSchedule.query.filter(
        CourseSchedule.id != (exclude_id or -1),
        CourseSchedule.classroom == classroom,
        CourseSchedule.day_of_week == day_of_week,
        CourseSchedule.period_number == period_number,
        CourseSchedule.is_active,
    ).all()

    for conflict in classroom_conflicts:
        if exclude_class_id and conflict.class_info_id == exclude_class_id:
            continue

        class_name = conflict.class_info.name if conflict.class_info else ""
        subject_name = conflict.subject.name if conflict.subject else ""
        conflicts.append(
            {
                "type": "classroom",
                "message": f"教室 {classroom} 此时段已有课程：{class_name} - {subject_name}",
                "schedule_id": conflict.id,
                "conflicting_class_name": class_name,
                "conflicting_subject_name": subject_name,
                "conflicting_teacher_name": conflict.teacher_name,
                "conflicting_classroom": conflict.classroom,
            }
        )

    return conflicts


# ================= 只读视图（供路由薄壳调用） =================


def get_schedule_list_view(args):
    """课程表列表（分页 + 数据隔离 + 模糊过滤）。返回纯数据，不含信封。"""
    class_info_id = args.get("class_info_id")
    day_of_week = args.get("day_of_week")
    teacher_name = args.get("teacher_name")
    classroom = args.get("classroom")

    query = CourseSchedule.query.filter_by(is_active=True)

    admin = get_current_admin()
    allowed_classes = get_allowed_classes(admin.id) if admin else None
    if allowed_classes is not None:
        class_ids = [
            c.id for c in ClassInfo.query.filter(ClassInfo.name.in_(allowed_classes)).all()
        ]
        query = query.filter(CourseSchedule.class_info_id.in_(class_ids))

    if class_info_id:
        query = query.filter_by(class_info_id=class_info_id)
    if day_of_week is not None:
        query = query.filter_by(day_of_week=day_of_week)
    if teacher_name:
        query = query.filter(CourseSchedule.teacher_name.like(f"%{teacher_name}%"))
    if classroom:
        query = query.filter(CourseSchedule.classroom.like(f"%{classroom}%"))

    page, per_page = get_pagination(default=20)
    # N+1 修复：列表序列化循环内访问 class_info/subject 关联，预加载避免逐行查询
    query = query.options(joinedload(CourseSchedule.class_info), joinedload(CourseSchedule.subject))
    pagination = query.order_by(CourseSchedule.day_of_week, CourseSchedule.period_number).paginate(
        page=page, per_page=per_page, error_out=False
    )
    schedules = pagination.items

    result = [_schedule_dict(schedule) for schedule in schedules]

    return {
        "schedules": result,
        "page": page,
        "per_page": per_page,
        "total": pagination.total,
        "pages": pagination.pages,
    }


def get_schedule_by_class_view(class_info_id):
    """指定班级完整课程表。返回裸 dict（与原契约一致）；无权限时返回 None。"""
    admin = get_current_admin()
    allowed_classes = get_allowed_classes(admin.id) if admin else None
    if allowed_classes is not None:
        class_info = get_by_id(ClassInfo, class_info_id)
        if class_info and class_info.name not in allowed_classes:
            return None

    schedules = CourseSchedule.query.filter(
        CourseSchedule.class_info_id == class_info_id, CourseSchedule.is_active
    ).order_by(CourseSchedule.day_of_week, CourseSchedule.period_number)

    class_info = get_by_id(ClassInfo, class_info_id)
    periods = ClassPeriod.query.filter_by(is_active=True).order_by(ClassPeriod.sort_order).all()

    result = {
        "class_info_id": class_info_id,
        "class_name": class_info.name if class_info else "",
        "periods": [p.to_dict() for p in periods],
        "schedules": [],
    }

    for schedule in schedules:
        period_info = get_period_info(schedule.period_number)
        result["schedules"].append(
            {
                "id": schedule.id,
                "class_info_id": schedule.class_info_id,
                "class_name": schedule.class_info.name if schedule.class_info else "",
                "subject_id": schedule.subject_id,
                "subject_name": schedule.subject.name if schedule.subject else "",
                "subject_color": (schedule.subject.color if schedule.subject else schedule.color),
                "day_of_week": schedule.day_of_week,
                "day_of_week_text": format_day_of_week(schedule.day_of_week),
                "period_number": schedule.period_number,
                "period_name": period_info["name"],
                "period_time": period_info["time"],
                "teacher_name": schedule.teacher_name,
                "classroom": schedule.classroom,
                "description": schedule.description,
                "color": schedule.color,
                "is_active": schedule.is_active,
            }
        )

    return result


def get_schedule_now_view(class_info_id=None):
    """当前时刻班级上课状态。返回纯 data dict，不含信封。

    class_info_id 由路由层解析（含 device_id 反查）后传入；未指定时仅返回全局上课状态。
    """
    is_class_time, rule_info = ClassTimeChecker.is_during_class_time()
    period = ClassTimeChecker._current_period(datetime.now())
    data = {
        "is_during_class_time": is_class_time,
        "global_rule": rule_info,
        "period": None,
        "in_session": False,
        # 是否有任意班级此刻在上课——广播类下发的拦截依据，供前端徽章与后端 is_broadcast_blocked 保持一致
        "any_in_session": ClassTimeChecker.any_class_in_session(),
        "class_info_id": class_info_id,
        "class_name": "",
        "subject_name": "",
        "now": datetime.now().isoformat(),
    }
    if period:
        data["period"] = {
            "period_number": period.period_number,
            "name": period.name,
            "start": f"{period.start_hour:02d}:{period.start_minute:02d}",
            "end": f"{period.end_hour:02d}:{period.end_minute:02d}",
        }
    if class_info_id:
        in_session, info = ClassTimeChecker.check_class_in_session(class_info_id)
        data["in_session"] = in_session
        if in_session and info:
            data["class_name"] = info.get("class_name", "")
            data["subject_name"] = info.get("subject_name", "")
    return data


def get_schedule_options_view():
    """课程表选项（班级、科目、节次）。返回纯 data dict，不含信封。"""
    classes = ClassInfo.query.filter_by(is_active=True).order_by(ClassInfo.name).all()
    subjects = Subject.query.filter_by(is_active=True).order_by(Subject.name).all()
    periods = ClassPeriod.query.filter_by(is_active=True).order_by(ClassPeriod.sort_order).all()

    return {
        "classes": [{"id": c.id, "name": c.name, "grade": c.grade} for c in classes],
        "subjects": [
            {
                "id": s.id,
                "name": s.name,
                "color": s.color,
                "description": s.description,
            }
            for s in subjects
        ],
        "periods": [
            {
                "number": p.period_number,
                "name": p.name,
                "start_time": f"{p.start_hour:02d}:{p.start_minute:02d}",
                "end_time": f"{p.end_hour:02d}:{p.end_minute:02d}",
            }
            for p in periods
        ],
    }


def check_schedule_conflict_view(args):
    """按班级 / 教师 / 教室维度检测课程时间冲突。返回纯 data dict，不含信封。"""
    class_info_id = args.get("class_info_id")
    day_of_week = args.get("day_of_week")
    period_number = args.get("period_number")
    teacher_name = args.get("teacher_name")
    classroom = args.get("classroom")
    exclude_id = args.get("exclude_id")

    conflicts = []

    if class_info_id and day_of_week is not None and period_number:
        conflicts.extend(
            check_conflicts(class_info_id, day_of_week, period_number, exclude_id=exclude_id)
        )

    if teacher_name and day_of_week is not None and period_number:
        conflicts.extend(
            check_teacher_conflicts(teacher_name, day_of_week, period_number, exclude_id=exclude_id)
        )

    if classroom and day_of_week is not None and period_number:
        conflicts.extend(
            check_classroom_conflicts(classroom, day_of_week, period_number, exclude_id=exclude_id)
        )

    return {"has_conflict": len(conflicts) > 0, "conflicts": conflicts}


def build_schedule_export_data(class_info_id):
    """导出课程表数据：返回 (export_data 列表, filename_prefix)。不含文件生成（留路由层）。"""
    query = CourseSchedule.query.filter_by(is_active=True)
    if class_info_id:
        query = query.filter_by(class_info_id=class_info_id)

    schedules = query.order_by(
        CourseSchedule.class_info_id,
        CourseSchedule.day_of_week,
        CourseSchedule.period_number,
    ).all()

    export_data = []
    class_info = None
    for schedule in schedules:
        class_info = get_by_id(ClassInfo, schedule.class_info_id)
        subject = get_by_id(Subject, schedule.subject_id)

        export_data.append(
            {
                "class_info_id": schedule.class_info_id,
                "class_name": class_info.name if class_info else "",
                "class_grade": class_info.grade if class_info else "",
                "subject_id": schedule.subject_id,
                "subject_name": subject.name if subject else "",
                "subject_color": subject.color if subject else "",
                "day_of_week": schedule.day_of_week,
                "day_of_week_text": format_day_of_week(schedule.day_of_week),
                "period_number": schedule.period_number,
                "period_name": get_period_info(schedule.period_number)["name"],
                "teacher_name": schedule.teacher_name,
                "classroom": schedule.classroom,
                "description": schedule.description,
                "color": schedule.color,
                "is_active": "是" if schedule.is_active else "否",
                "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
                "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
            }
        )

    filename_prefix = f'course_schedules_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    if class_info_id and class_info:
        filename_prefix = (
            f'course_schedule_{class_info.name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
        )

    return export_data, filename_prefix
