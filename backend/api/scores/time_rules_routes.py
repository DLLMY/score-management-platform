from flask_restx import Namespace, Resource, fields
from models import TimeRule
from utils.permission import requires_permission
from utils.response import APIResponse
from datetime import datetime
from services.time_rule_service import create_time_rule, update_time_rule, delete_time_rule

ns_time_rules = Namespace("time-rules", description="时间规则相关操作")

time_rule_model = ns_time_rules.model(
    "TimeRule",
    {
        "id": fields.Integer(readOnly=True, description="规则ID"),
        "name": fields.String(required=True, description="规则名称"),
        "description": fields.String(description="规则描述"),
        "day_of_week": fields.Integer(description="星期(-1=每天, 0=周一~6=周日)"),
        "start_hour": fields.Integer(required=True, description="开始小时"),
        "start_minute": fields.Integer(required=True, description="开始分钟"),
        "end_hour": fields.Integer(required=True, description="结束小时"),
        "end_minute": fields.Integer(required=True, description="结束分钟"),
        "is_active": fields.Boolean(description="是否启用"),
        "allow_unlock": fields.Boolean(description="是否允许开锁"),
    },
)

time_rule_response = ns_time_rules.model(
    "TimeRuleResponse",
    {
        "id": fields.Integer(description="规则ID"),
        "name": fields.String(description="规则名称"),
        "description": fields.String(description="规则描述"),
        "day_of_week": fields.Integer(description="星期"),
        "day_of_week_text": fields.String(description="星期文本"),
        "start_hour": fields.Integer(description="开始小时"),
        "start_minute": fields.Integer(description="开始分钟"),
        "end_hour": fields.Integer(description="结束小时"),
        "end_minute": fields.Integer(description="结束分钟"),
        "is_active": fields.Boolean(description="是否启用"),
        "allow_unlock": fields.Boolean(description="是否允许开锁"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

time_rule_list_response = ns_time_rules.model(
    "TimeRuleListResponse", {"rules": fields.List(fields.Nested(time_rule_response), description="时间规则列表")}
)

time_rule_check_response = ns_time_rules.model(
    "TimeRuleCheckResponse",
    {
        "allowed": fields.Boolean(description="是否允许操作"),
        "message": fields.String(description="消息"),
        "rule": fields.Nested(
            ns_time_rules.model(
                "ActiveRule",
                {
                    "id": fields.Integer(description="规则ID"),
                    "name": fields.String(description="规则名称"),
                    "allow_unlock": fields.Boolean(description="是否允许开锁"),
                },
            )
        ),
    },
)


def format_day_of_week(day):
    if day == -1:
        return "每天"
    days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    return days[day] if 0 <= day <= 6 else "未知"


@ns_time_rules.route("/")
class TimeRuleList(Resource):

    @ns_time_rules.doc("list_time_rules", description="获取时间规则列表")
    @ns_time_rules.response(200, "成功", time_rule_list_response)
    @requires_permission("timetable.rule.manage")
    def get(self):
        """
        获取时间规则列表

        获取系统中所有时间规则的列表。
        """
        rules = TimeRule.query.all()
        return {
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "day_of_week": r.day_of_week,
                    "day_of_week_text": format_day_of_week(r.day_of_week),
                    "start_hour": r.start_hour,
                    "start_minute": r.start_minute,
                    "end_hour": r.end_hour,
                    "end_minute": r.end_minute,
                    "is_active": r.is_active,
                    "allow_unlock": r.allow_unlock,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rules
            ]
        }

    @ns_time_rules.doc("create_time_rule", description="创建时间规则", security="Bearer")
    @ns_time_rules.expect(time_rule_model)
    @ns_time_rules.response(201, "创建成功", time_rule_response)
    @requires_permission("timetable.rule.manage")
    def post(self):
        """
        创建时间规则

        创建新的时间规则，需要管理员权限。

        请求体：
        - name: 规则名称（必填）
        - description: 规则描述（可选）
        - day_of_week: 星期（-1=每天, 0=周一~6=周日，默认-1）
        - start_hour: 开始小时（必填，0-23）
        - start_minute: 开始分钟（必填，0-59）
        - end_hour: 结束小时（必填，0-23）
        - end_minute: 结束分钟（必填，0-59）
        - is_active: 是否启用（可选，默认True）
        - allow_unlock: 是否允许开锁（可选，默认False）
        """
        data = ns_time_rules.payload
        rule = create_time_rule(data)
        return {
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "day_of_week": rule.day_of_week,
            "day_of_week_text": format_day_of_week(rule.day_of_week),
            "start_hour": rule.start_hour,
            "start_minute": rule.start_minute,
            "end_hour": rule.end_hour,
            "end_minute": rule.end_minute,
            "is_active": rule.is_active,
            "allow_unlock": rule.allow_unlock,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
        }, 201


@ns_time_rules.route("/<int:id>")
@ns_time_rules.param("id", "规则ID")
class TimeRuleResource(Resource):

    @ns_time_rules.doc("get_time_rule", description="获取时间规则详情")
    @ns_time_rules.response(200, "成功", time_rule_response)
    @ns_time_rules.response(404, "规则不存在")
    @requires_permission("timetable.rule.manage")
    def get(self, id):
        """
        获取时间规则详情

        根据ID获取时间规则的详细信息。

        参数：
        - id: 规则ID（路径参数）
        """
        rule = TimeRule.query.get_or_404(id)
        return {
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "day_of_week": rule.day_of_week,
            "day_of_week_text": format_day_of_week(rule.day_of_week),
            "start_hour": rule.start_hour,
            "start_minute": rule.start_minute,
            "end_hour": rule.end_hour,
            "end_minute": rule.end_minute,
            "is_active": rule.is_active,
            "allow_unlock": rule.allow_unlock,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
            "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
        }

    @ns_time_rules.doc("update_time_rule", description="更新时间规则", security="Bearer")
    @ns_time_rules.expect(time_rule_model)
    @ns_time_rules.response(200, "更新成功")
    @ns_time_rules.response(404, "规则不存在")
    @requires_permission("timetable.rule.manage")
    def put(self, id):
        """
        更新时间规则

        更新指定时间规则的信息，需要管理员权限。

        参数：
        - id: 规则ID（路径参数）
        """
        rule = TimeRule.query.get_or_404(id)
        data = ns_time_rules.payload
        update_time_rule(rule, data)
        return APIResponse.success(message="时间规则更新成功")

    @ns_time_rules.doc("delete_time_rule", description="删除时间规则", security="Bearer")
    @ns_time_rules.response(200, "删除成功")
    @ns_time_rules.response(404, "规则不存在")
    @requires_permission("timetable.rule.manage")
    def delete(self, id):
        """
        删除时间规则

        删除指定的时间规则，需要管理员权限。

        参数：
        - id: 规则ID（路径参数）
        """
        rule = TimeRule.query.get_or_404(id)
        delete_time_rule(rule)
        return APIResponse.success(message="时间规则删除成功")


@ns_time_rules.route("/check")
class TimeRuleCheck(Resource):

    @ns_time_rules.doc("check_time_rule", description="检查当前时间是否允许操作")
    @ns_time_rules.response(200, "检查成功", time_rule_check_response)
    def get(self):
        """
        检查当前时间是否允许操作

        检查当前时间是否在任意已启用的时间规则范围内。
        如果在范围内，返回允许操作及匹配的规则信息。
        """
        now = datetime.now()
        current_day = now.weekday()
        current_hour = now.hour
        current_minute = now.minute
        current_time = current_hour * 60 + current_minute

        active_rules = TimeRule.query.filter_by(is_active=True).all()

        for rule in active_rules:
            if rule.day_of_week != -1 and rule.day_of_week != current_day:
                continue

            start_time = rule.start_hour * 60 + rule.start_minute
            end_time = rule.end_hour * 60 + rule.end_minute

            if start_time <= current_time <= end_time:
                return {"allowed": True, "rule": {"id": rule.id, "name": rule.name, "allow_unlock": rule.allow_unlock}}

        return {"allowed": False, "message": "当前时间不允许操作"}
