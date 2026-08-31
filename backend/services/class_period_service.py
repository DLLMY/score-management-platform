"""课程节次（class-periods）写入逻辑服务层。

F17 防腐层：收口原 class_periods_routes.py 中的 db.session 写入/事务路径
（create / update / delete / batch / reset）。读取、to_dict 序列化、响应构造
仍留在路由层；重复编号校验保留在路由层（其返回 bad_request 属路由契约）。
"""

from datetime import datetime

from models import db, ClassPeriod, get_by_id

# 重置为默认值所用的 12 节次（与路由原逻辑一致）
DEFAULT_PERIODS = [
    {
        "name": "第一节课",
        "period_number": 1,
        "start_hour": 8,
        "start_minute": 0,
        "end_hour": 8,
        "end_minute": 40,
        "description": "上午第一节",
        "sort_order": 1,
    },
    {
        "name": "第二节课",
        "period_number": 2,
        "start_hour": 8,
        "start_minute": 50,
        "end_hour": 9,
        "end_minute": 30,
        "description": "上午第二节",
        "sort_order": 2,
    },
    {
        "name": "第三节课",
        "period_number": 3,
        "start_hour": 9,
        "start_minute": 40,
        "end_hour": 10,
        "end_minute": 20,
        "description": "上午第三节",
        "sort_order": 3,
    },
    {
        "name": "第四节课",
        "period_number": 4,
        "start_hour": 10,
        "start_minute": 30,
        "end_hour": 11,
        "end_minute": 10,
        "description": "上午第四节",
        "sort_order": 4,
    },
    {
        "name": "第五节课",
        "period_number": 5,
        "start_hour": 11,
        "start_minute": 20,
        "end_hour": 12,
        "end_minute": 0,
        "description": "上午第五节",
        "sort_order": 5,
    },
    {
        "name": "第六节课",
        "period_number": 6,
        "start_hour": 14,
        "start_minute": 0,
        "end_hour": 14,
        "end_minute": 40,
        "description": "下午第一节",
        "sort_order": 6,
    },
    {
        "name": "第七节课",
        "period_number": 7,
        "start_hour": 14,
        "start_minute": 50,
        "end_hour": 15,
        "end_minute": 30,
        "description": "下午第二节",
        "sort_order": 7,
    },
    {
        "name": "第八节课",
        "period_number": 8,
        "start_hour": 15,
        "start_minute": 40,
        "end_hour": 16,
        "end_minute": 20,
        "description": "下午第三节",
        "sort_order": 8,
    },
    {
        "name": "第九节课",
        "period_number": 9,
        "start_hour": 16,
        "start_minute": 30,
        "end_hour": 17,
        "end_minute": 10,
        "description": "下午第四节",
        "sort_order": 9,
    },
    {
        "name": "晚自习一",
        "period_number": 10,
        "start_hour": 19,
        "start_minute": 0,
        "end_hour": 19,
        "end_minute": 40,
        "description": "晚自习第一节",
        "sort_order": 10,
    },
    {
        "name": "晚自习二",
        "period_number": 11,
        "start_hour": 19,
        "start_minute": 50,
        "end_hour": 20,
        "end_minute": 30,
        "description": "晚自习第二节",
        "sort_order": 11,
    },
    {
        "name": "晚自习三",
        "period_number": 12,
        "start_hour": 20,
        "start_minute": 40,
        "end_hour": 21,
        "end_minute": 20,
        "description": "晚自习第三节",
        "sort_order": 12,
    },
]


def create_class_period(data):
    """创建课程节次，返回新建的 ClassPeriod 实例。"""
    period = ClassPeriod(
        name=data.get("name"),
        period_number=data.get("period_number"),
        start_hour=data.get("start_hour"),
        start_minute=data.get("start_minute"),
        end_hour=data.get("end_hour"),
        end_minute=data.get("end_minute"),
        description=data.get("description"),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", 0),
    )
    db.session.add(period)
    db.session.commit()
    return period


def update_class_period(period, data):
    """更新给定节次实例的字段并提交。"""
    period.name = data.get("name", period.name)
    period.period_number = data.get("period_number", period.period_number)
    period.start_hour = data.get("start_hour", period.start_hour)
    period.start_minute = data.get("start_minute", period.start_minute)
    period.end_hour = data.get("end_hour", period.end_hour)
    period.end_minute = data.get("end_minute", period.end_minute)
    period.description = data.get("description", period.description)
    period.is_active = data.get("is_active", period.is_active)
    period.sort_order = data.get("sort_order", period.sort_order)
    period.updated_at = datetime.now()
    db.session.commit()
    return period


def delete_class_period(period):
    """删除给定节次实例。"""
    db.session.delete(period)
    db.session.commit()


def batch_update_class_periods(periods_data):
    """批量更新节次（按 id 匹配）。"""
    for period_data in periods_data:
        if "id" in period_data:
            period = get_by_id(ClassPeriod, period_data["id"])
            if period:
                period.name = period_data.get("name", period.name)
                period.start_hour = period_data.get("start_hour", period.start_hour)
                period.start_minute = period_data.get("start_minute", period.start_minute)
                period.end_hour = period_data.get("end_hour", period.end_hour)
                period.end_minute = period_data.get("end_minute", period.end_minute)
                period.description = period_data.get("description", period.description)
                period.is_active = period_data.get("is_active", period.is_active)
                period.sort_order = period_data.get("sort_order", period.sort_order)
                period.updated_at = datetime.now()
    db.session.commit()


def reset_class_periods():
    """清空并重建默认 12 节次。"""
    ClassPeriod.query.delete()
    for data in DEFAULT_PERIODS:
        period = ClassPeriod(**data)
        db.session.add(period)
    db.session.commit()
