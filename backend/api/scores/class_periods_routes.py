from flask_restx import Namespace, Resource, fields
from models import ClassPeriod
from utils.permission import requires_permission

from utils.response import APIResponse
from services.class_period_service import (
    create_class_period,
    update_class_period,
    delete_class_period,
    batch_update_class_periods,
    reset_class_periods,
)

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
        periods = ClassPeriod.query.order_by(
            ClassPeriod.sort_order, ClassPeriod.period_number
        ).all()
        result = []  # noqa: F841
        for p in periods:
            item = p.to_dict()  # noqa: F841
            item["duration"] = (p.end_hour * 60 + p.end_minute) - (
                p.start_hour * 60 + p.start_minute
            )
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

        period = create_class_period(data)

        result = period.to_dict()  # noqa: F841
        result["duration"] = (period.end_hour * 60 + period.end_minute) - (
            period.start_hour * 60 + period.start_minute
        )
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
        result["duration"] = (period.end_hour * 60 + period.end_minute) - (
            period.start_hour * 60 + period.start_minute
        )
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

        update_class_period(period, data)

        result = period.to_dict()  # noqa: F841
        result["duration"] = (period.end_hour * 60 + period.end_minute) - (
            period.start_hour * 60 + period.start_minute
        )
        return APIResponse.success(data=result, message="更新成功")

    @ns_class_periods.doc("delete_class_period", description="删除课程节次", security="Bearer")
    @ns_class_periods.response(200, "删除成功")
    @ns_class_periods.response(404, "节次不存在")
    @requires_permission("timetable.rule.manage")
    def delete(self, id):
        period = ClassPeriod.query.get_or_404(id)
        delete_class_period(period)
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
            item["duration"] = (p.end_hour * 60 + p.end_minute) - (
                p.start_hour * 60 + p.start_minute
            )
            result.append(item)
        return {"periods": result, "total": len(result)}


@ns_class_periods.route("/batch")
class ClassPeriodBatch(Resource):
    @ns_class_periods.doc(
        "batch_update_class_periods", description="批量更新课程节次", security="Bearer"
    )
    @ns_class_periods.expect(
        ns_class_periods.model(
            "BatchUpdate",
            {"periods": fields.List(fields.Nested(class_period_model), required=True)},
        )
    )
    @ns_class_periods.response(200, "批量更新成功")
    @requires_permission("timetable.rule.manage")
    def put(self):
        data = ns_class_periods.payload
        periods_data = data.get("periods", [])
        batch_update_class_periods(periods_data)
        return APIResponse.success(message=f"批量更新成功，共更新 {len(periods_data)} 条记录")


@ns_class_periods.route("/reset")
class ClassPeriodReset(Resource):

    @ns_class_periods.doc(
        "reset_class_periods", description="重置课程节次为默认值", security="Bearer"
    )
    @ns_class_periods.response(200, "重置成功")
    @requires_permission("timetable.rule.manage")
    def post(self):
        reset_class_periods()
        return APIResponse.success(message="已重置为默认课程节次设置")
