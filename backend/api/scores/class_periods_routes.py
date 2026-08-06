from flask_restx import Namespace, Resource, fields
from models import db, ClassPeriod, get_by_id
from utils.permission import requires_permission
from datetime import datetime

from utils.response import APIResponse

ns_class_periods = Namespace("class-periods", description="课程节次管理")

class_period_model = ns_class_periods.model(
    "ClassPeriod",
    {
        "id": fields.Integer(readOnly=True, description="节次ID"),
        "name": fields.String(required=True, description="节次名称"),
        "period_number": fields.Integer(required=True, description="节次编号"),
        "start_hour": fields.Integer(required=True, description="开始小时"),
        "start_minute": fields.Integer(required=True, description="开始分钟"),
        "end_hour": fields.Integer(required=True, description="结束小时"),
        "end_minute": fields.Integer(required=True, description="结束分钟"),
        "description": fields.String(description="节次描述"),
        "is_active": fields.Boolean(description="是否启用"),
        "sort_order": fields.Integer(description="排序顺序"),
    },
)

class_period_response = ns_class_periods.model(
    "ClassPeriodResponse",
    {
        "id": fields.Integer(description="节次ID"),
        "name": fields.String(description="节次名称"),
        "period_number": fields.Integer(description="节次编号"),
        "start_hour": fields.Integer(description="开始小时"),
        "start_minute": fields.Integer(description="开始分钟"),
        "end_hour": fields.Integer(description="结束小时"),
        "end_minute": fields.Integer(description="结束分钟"),
        "duration": fields.Integer(description="时长（分钟）"),
        "description": fields.String(description="节次描述"),
        "is_active": fields.Boolean(description="是否启用"),
        "sort_order": fields.Integer(description="排序顺序"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

class_period_list_response = ns_class_periods.model(
    "ClassPeriodListResponse",
    {
        "periods": fields.List(fields.Nested(class_period_response), description="节次列表"),
        "total": fields.Integer(description="总数"),
    },
)


@ns_class_periods.route("/")
class ClassPeriodList(Resource):

    @ns_class_periods.doc("list_class_periods", description="获取课程节次列表")
    @ns_class_periods.response(200, "成功", class_period_list_response)
    @requires_permission("timetable.rule.manage")
    def get(self):
        periods = ClassPeriod.query.order_by(ClassPeriod.sort_order, ClassPeriod.period_number).all()
        result = []  # noqa: F841
        for p in periods:
            item = p.to_dict()  # noqa: F841
            item["duration"] = (p.end_hour * 60 + p.end_minute) - (p.start_hour * 60 + p.start_minute)
            result.append(item)
        return {"periods": result, "total": len(result)}

    @ns_class_periods.doc("create_class_period", description="创建课程节次", security="Bearer")
    @ns_class_periods.expect(class_period_model)
    @ns_class_periods.response(201, "创建成功", class_period_response)
    @requires_permission("timetable.rule.manage")
    def post(self):
        data = ns_class_periods.payload

        existing = ClassPeriod.query.filter_by(period_number=data.get("period_number")).first()
        if existing:
            return APIResponse.bad_request(message=f'节次编号 {data.get("period_number")} 已存在')

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

        result = period.to_dict()  # noqa: F841
        result["duration"] = (period.end_hour * 60 + period.end_minute) - (period.start_hour * 60 + period.start_minute)
        return APIResponse.success(data=result, message="创建成功", status_code=201)


@ns_class_periods.route("/<int:id>")
@ns_class_periods.param("id", "节次ID")
class ClassPeriodResource(Resource):

    @ns_class_periods.doc("get_class_period", description="获取课程节次详情")
    @ns_class_periods.response(200, "成功", class_period_response)
    @ns_class_periods.response(404, "节次不存在")
    @requires_permission("timetable.rule.manage")
    def get(self, id):
        period = ClassPeriod.query.get_or_404(id)
        result = period.to_dict()  # noqa: F841
        result["duration"] = (period.end_hour * 60 + period.end_minute) - (period.start_hour * 60 + period.start_minute)
        return result

    @ns_class_periods.doc("update_class_period", description="更新课程节次", security="Bearer")
    @ns_class_periods.expect(class_period_model)
    @ns_class_periods.response(200, "更新成功")
    @ns_class_periods.response(404, "节次不存在")
    @requires_permission("timetable.rule.manage")
    def put(self, id):
        period = ClassPeriod.query.get_or_404(id)
        data = ns_class_periods.payload

        if "period_number" in data and data["period_number"] != period.period_number:
            existing = ClassPeriod.query.filter_by(period_number=data["period_number"]).first()
            if existing and existing.id != id:
                return APIResponse.bad_request(message=f'节次编号 {data["period_number"]} 已存在')

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

        result = period.to_dict()  # noqa: F841
        result["duration"] = (period.end_hour * 60 + period.end_minute) - (period.start_hour * 60 + period.start_minute)
        return APIResponse.success(data=result, message="更新成功")

    @ns_class_periods.doc("delete_class_period", description="删除课程节次", security="Bearer")
    @ns_class_periods.response(200, "删除成功")
    @ns_class_periods.response(404, "节次不存在")
    @requires_permission("timetable.rule.manage")
    def delete(self, id):
        period = ClassPeriod.query.get_or_404(id)
        db.session.delete(period)
        db.session.commit()
        return APIResponse.success(message="课程节次删除成功")


@ns_class_periods.route("/active")
class ClassPeriodActiveList(Resource):

    @ns_class_periods.doc("list_active_class_periods", description="获取启用的课程节次列表")
    @ns_class_periods.response(200, "成功", class_period_list_response)
    @requires_permission("timetable.rule.manage")
    def get(self):
        periods = (
            ClassPeriod.query.filter_by(is_active=True)
            .order_by(ClassPeriod.sort_order, ClassPeriod.period_number)
            .order_by(ClassPeriod.sort_order, ClassPeriod.period_number)
        )
        result = []  # noqa: F841
        for p in periods:
            item = p.to_dict()  # noqa: F841
            item["duration"] = (p.end_hour * 60 + p.end_minute) - (p.start_hour * 60 + p.start_minute)
            result.append(item)
        return {"periods": result, "total": len(result)}


@ns_class_periods.route("/batch")
class ClassPeriodBatch(Resource):
    @ns_class_periods.doc("batch_update_class_periods", description="批量更新课程节次", security="Bearer")
    @ns_class_periods.expect(
        ns_class_periods.model(
            "BatchUpdate", {"periods": fields.List(fields.Nested(class_period_model), required=True)}
        )
    )
    @ns_class_periods.response(200, "批量更新成功")
    @requires_permission("timetable.rule.manage")
    def put(self):
        data = ns_class_periods.payload
        periods_data = data.get("periods", [])

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
        return APIResponse.success(message=f"批量更新成功，共更新 {len(periods_data)} 条记录")


@ns_class_periods.route("/reset")
class ClassPeriodReset(Resource):

    @ns_class_periods.doc("reset_class_periods", description="重置课程节次为默认值", security="Bearer")
    @ns_class_periods.response(200, "重置成功")
    @requires_permission("timetable.rule.manage")
    def post(self):
        default_periods = [
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

        ClassPeriod.query.delete()

        for data in default_periods:
            period = ClassPeriod(**data)
            db.session.add(period)

        db.session.commit()
        return APIResponse.success(message="已重置为默认课程节次设置")
