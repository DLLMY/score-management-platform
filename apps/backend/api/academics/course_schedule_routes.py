import json
import io
from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from models import CourseSchedule, ClassInfo, Subject, ClassPeriod, Admin, ImportConfig, get_by_id
from services.academics_service import academics_service
from services.course_schedule_service import (
    get_schedule_list_view,
    get_schedule_by_class_view,
    get_schedule_now_view,
    get_schedule_options_view,
    check_schedule_conflict_view,
    build_schedule_export_data,
    _schedule_dict,
    format_day_of_week,
    get_period_info,
    check_conflicts,
    check_teacher_conflicts,
    check_classroom_conflicts,
)
from utils.permission import requires_permission, get_allowed_classes, get_current_admin
from utils.response import APIResponse
from utils.api_cache_middleware import cached_api, invalidate_cache
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
import logging
logger = logging.getLogger(__name__)

ns_course_schedule = Namespace("course-schedules", description="课程表相关操作")

ns_course_schedule.parser = ns_course_schedule.parser()
ns_course_schedule.parser.add_argument(
    "class_info_id", type=int, location="args", required=False, help="班级ID"
)
ns_course_schedule.parser.add_argument(
    "day_of_week", type=int, location="args", required=False, help="星期"
)
ns_course_schedule.parser.add_argument(
    "period_number", type=int, location="args", required=False, help="节次编号"
)
ns_course_schedule.parser.add_argument(
    "is_active", type=bool, location="args", required=False, help="是否启用"
)
ns_course_schedule.parser.add_argument(
    "teacher_name", type=str, location="args", required=False, help="教师姓名"
)
ns_course_schedule.parser.add_argument(
    "classroom", type=str, location="args", required=False, help="教室"
)

course_schedule_model = ns_course_schedule.model(
    "CourseSchedule",
    {
        "id": fields.Integer(readOnly=True, description="课程ID"),
        "class_info_id": fields.Integer(required=True, description="班级ID"),
        "subject_id": fields.Integer(required=True, description="科目ID"),
        "day_of_week": fields.Integer(required=True, description="星期(0=周一~6=周日)"),
        "period_number": fields.Integer(required=True, description="节次编号"),
        "teacher_id": fields.Integer(description="教师ID"),
        "teacher_name": fields.String(description="教师姓名"),
        "classroom": fields.String(description="教室"),
        "description": fields.String(description="描述"),
        "color": fields.String(description="颜色"),
        "is_active": fields.Boolean(description="是否启用"),
    },
)

course_schedule_response = ns_course_schedule.model(
    "CourseScheduleResponse",
    {
        "id": fields.Integer(description="课程ID"),
        "class_info_id": fields.Integer(description="班级ID"),
        "class_name": fields.String(description="班级名称"),
        "subject_id": fields.Integer(description="科目ID"),
        "subject_name": fields.String(description="科目名称"),
        "subject_color": fields.String(description="科目颜色"),
        "day_of_week": fields.Integer(description="星期"),
        "day_of_week_text": fields.String(description="星期文本"),
        "period_number": fields.Integer(description="节次编号"),
        "period_name": fields.String(description="节次名称"),
        "period_time": fields.String(description="节次时间"),
        "teacher_id": fields.Integer(description="教师ID"),
        "teacher_name": fields.String(description="教师姓名"),
        "classroom": fields.String(description="教室"),
        "description": fields.String(description="描述"),
        "color": fields.String(description="颜色"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

# ================= 课程表导入（M-十评：487 行 post 拆分） =================

_DAY_TEXT_MAP = {
    "周一": 0,
    "星期一": 0,
    "周二": 1,
    "星期二": 1,
    "周三": 2,
    "星期三": 2,
    "周四": 3,
    "星期四": 3,
    "周五": 4,
    "星期五": 4,
    "周六": 5,
    "星期六": 5,
    "周日": 6,
    "星期日": 6,
}

def _validate_text_field(value, field, max_len, empty_msg, invalid_msg, too_long_msg, required):
    if not value:
        if required:
            return {"field": field, "message": empty_msg}
        return None
    if not isinstance(value, str) or len(value.strip()) == 0:
        return {"field": field, "message": invalid_msg}
    if len(value.strip()) > max_len:
        return {"field": field, "message": too_long_msg}
    return None

def _validate_day_of_week(value, day_text_map):
    if value is None:
        return {"field": "day_of_week", "message": "星期不能为空"}
    if isinstance(value, str):
        if value not in day_text_map:
            return {
                "field": "day_of_week",
                "message": f'星期值 "{value}" 无效，只能是"周一"到"周日"',
            }
        return None
    if not isinstance(value, int) or value < 0 or value > 6:
        return {"field": "day_of_week", "message": "星期值无效，必须为0-6之间的整数"}
    return None

def _validate_period_number(value, max_period):
    if value is None:
        return {"field": "period_number", "message": "节次不能为空"}
    if not isinstance(value, int):
        return {"field": "period_number", "message": "节次格式无效，必须为整数"}
    if value < 1 or (max_period > 0 and value > max_period):
        return {
            "field": "period_number",
            "message": f"节次值无效，必须在1-{max_period}之间",
        }
    return None

def _validate_teacher_role(teacher_name):
    admin = Admin.query.filter(Admin.real_name == teacher_name.strip()).first()
    if not admin:
        admin = Admin.query.filter(Admin.username == teacher_name.strip()).first()
    if admin and admin.role not in ["admin", "teacher"]:
        return {
            "field": "teacher_name",
            "message": f'用户 "{teacher_name}" 的角色不是管理员或教师，无法担任授课教师',
        }
    return None

def _check_schedule_update_forbidden(schedule):
    """数据隔离：非管理员只能修改关联班级的课程；无权时返回 403 响应。"""
    admin = get_current_admin()
    allowed_classes = get_allowed_classes(admin.id) if admin else None
    if (
        allowed_classes is not None
        and schedule.class_info
        and schedule.class_info.name not in allowed_classes
    ):
        return APIResponse.forbidden(message="无权修改该课程")
    return None

def _resolve_schedule_update_fields(data, schedule):
    """解析更新后的字段值（缺省回退到原值）。"""
    return {
        "class_info_id": data.get("class_info_id", schedule.class_info_id),
        "day_of_week": data.get("day_of_week", schedule.day_of_week),
        "period_number": data.get("period_number", schedule.period_number),
        "teacher_id": data.get("teacher_id", schedule.teacher_id),
        "teacher_name": data.get("teacher_name", schedule.teacher_name),
        "classroom": data.get("classroom", schedule.classroom),
    }

def _resolve_teacher_name(new_teacher_id, current_name):
    """校验 teacher_id：存在则解析教师姓名，否则返回 400 错误响应。"""
    if not new_teacher_id:
        return None, current_name
    teacher = get_by_id(Admin, new_teacher_id)
    if not teacher:
        error = APIResponse.bad_request(message=f'教师ID "{new_teacher_id}" 在系统中不存在')
        return error, current_name
    return None, teacher.real_name or teacher.username

def _schedule_time_changed(new_fields, schedule):
    """时间/班级字段是否发生变化（保持原实现的重复比较项）。"""
    return any(
        [
            new_fields["class_info_id"] != schedule.class_info_id,
            new_fields["day_of_week"] != schedule.day_of_week,
            new_fields["day_of_week"] != schedule.day_of_week,
        ]
    )

def _collect_time_conflicts(
    new_class_info_id,
    new_day_of_week,
    new_period_number,
    new_teacher_name,
    new_classroom,
    schedule_id,
):
    """收集班级/教师/教室的时间冲突列表。"""
    conflicts = []
    conflicts.extend(
        check_conflicts(
            new_class_info_id, new_day_of_week, new_period_number, exclude_id=schedule_id
        )
    )

    if new_teacher_name:
        conflicts.extend(
            check_teacher_conflicts(
                new_teacher_name,
                new_day_of_week,
                new_period_number,
                exclude_id=schedule_id,
                exclude_class_id=new_class_info_id,
            )
        )

    if new_classroom:
        conflicts.extend(
            check_classroom_conflicts(
                new_classroom,
                new_day_of_week,
                new_period_number,
                exclude_id=schedule_id,
                exclude_class_id=new_class_info_id,
            )
        )
    return conflicts

def _check_change_conflicts(
    schedule,
    new_teacher_name,
    new_classroom,
    new_day_of_week,
    new_period_number,
    new_class_info_id,
    schedule_id,
):
    """教师/教室发生变化时检查冲突，返回首个 400 响应或 None。"""
    if new_teacher_name != schedule.teacher_name:
        teacher_conflicts = check_teacher_conflicts(
            new_teacher_name,
            new_day_of_week,
            new_period_number,
            exclude_id=schedule_id,
            exclude_class_id=new_class_info_id,
        )
        if teacher_conflicts:
            return APIResponse.bad_request(message="教师时间冲突", errors=teacher_conflicts)

    if new_classroom != schedule.classroom:
        classroom_conflicts = check_classroom_conflicts(
            new_classroom,
            new_day_of_week,
            new_period_number,
            exclude_id=schedule_id,
            exclude_class_id=new_class_info_id,
        )
        if classroom_conflicts:
            return APIResponse.bad_request(message="教室时间冲突", errors=classroom_conflicts)
    return None

def _resolve_final_color(data, new_subject_id):
    """颜色：显式传入优先，否则取科目颜色。"""
    if "color" in data:
        return data["color"]
    color_subject = get_by_id(Subject, new_subject_id)
    return color_subject.color if color_subject else None

def _schedule_update_response(schedule, period_info):
    """构造课程更新成功的响应体。"""
    return APIResponse.success(
        data={
            "success": True,
            "message": "课程安排更新成功",
            "schedule": {
                "id": schedule.id,
                "class_info_id": schedule.class_info_id,
                "class_name": schedule.class_info.name if schedule.class_info else "",
                "subject_id": schedule.subject_id,
                "subject_name": schedule.subject.name if schedule.subject else "",
                "day_of_week": schedule.day_of_week,
                "day_of_week_text": format_day_of_week(schedule.day_of_week),
                "period_number": schedule.period_number,
                "period_name": period_info["name"],
                "period_time": period_info["time"],
                "teacher_id": schedule.teacher_id,
                "teacher_name": schedule.teacher_name,
                "classroom": schedule.classroom,
                "color": schedule.color,
                "is_active": schedule.is_active,
                "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
            },
        }
    )

import api.academics._course_schedule_part1
import api.academics._course_schedule_part2
