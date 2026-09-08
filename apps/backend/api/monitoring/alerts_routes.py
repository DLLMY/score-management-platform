from flask_restx import Namespace, Resource, fields
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.alert_service import alert_service

from utils.response import APIResponse

"""告警管理API路由"""
ns_alerts = Namespace("alerts", description="告警管理相关操作")

# 告警响应序列化字段子集（与 alert_model 一致；source/is_resolved 等扩展字段不在此端点返回）
ALERT_FIELDS = [
    "id",
    "alert_type",
    "severity",
    "message",
    "device_id",
    "device_name",
    "extra_data",
    "is_read",
    "read_at",
    "created_at",
]
alert_model = ns_alerts.model(
    "Alert",
    {
        "id": fields.Integer(readOnly=True, description="告警ID"),
        "alert_type": fields.String(description="告警类型"),
        "severity": fields.String(description="告警级别"),
        "message": fields.String(description="告警消息"),
        "device_id": fields.String(description="设备ID"),
        "device_name": fields.String(description="设备名称"),
        "extra_data": fields.String(description="额外数据"),
        "is_read": fields.Boolean(description="是否已读"),
        "read_at": fields.String(description="阅读时间"),
        "created_at": fields.String(description="创建时间"),
    },
)
alert_stats_model = ns_alerts.model(
    "AlertStats",
    {
        "total": fields.Integer(description="总告警数"),
        "unread": fields.Integer(description="未读告警数"),
        "by_severity": fields.Raw(description="按级别统计"),
        "today_count": fields.Integer(description="今日告警数"),
    },
)


@ns_alerts.route("/")
class AlertList(Resource):
    @ns_alerts.doc("list_alerts", description="获取告警列表", security="Bearer")
    @ns_alerts.response(200, "成功")
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取告警列表
        获取系统告警列表，支持分页和过滤。
        """
        args = ns_alerts.parser().add_argument("limit", type=int, default=50, location="args")
        args.add_argument("offset", type=int, default=0, location="args")
        args.add_argument("severity", type=str, location="args")
        args.add_argument("is_read", type=str, location="args")
        args.add_argument("alert_type", type=str, location="args")
        args = args.parse_args()
        is_read = None
        if args["is_read"] is not None:
            is_read = args["is_read"].lower() == "true"
        list_limit = min(int(args["limit"]), 200)
        alerts = alert_service.get_alerts(
            limit=list_limit,
            offset=args["offset"],
            severity=args["severity"],
            is_read=is_read,
            alert_type=args["alert_type"],
        )
        result = []  # noqa: F841
        for alert in alerts:
            result.append(alert.to_dict(ALERT_FIELDS))
        return APIResponse.success(data={"alerts": result})


@ns_alerts.route("/<int:alert_id>")
class AlertResource(Resource):
    @ns_alerts.doc("get_alert", description="获取单个告警", security="Bearer")
    @ns_alerts.response(200, "成功")
    @ns_alerts.response(404, "告警不存在")
    @requires_permission("device.view")
    def get(self, alert_id):
        """
        获取单个告警
        根据ID获取告警详情。
        """
        alert = alert_service.get_alert_by_id(alert_id)
        if not alert:
            return APIResponse.error(message="告警不存在", status_code=404)
        return alert.to_dict(ALERT_FIELDS)

    @ns_alerts.doc("update_alert", description="更新告警状态", security="Bearer")
    @ns_alerts.response(200, "更新成功")
    @ns_alerts.response(404, "告警不存在")
    @requires_permission("device.manage")
    def put(self, alert_id):
        """
        更新告警状态
        标记告警为已读或未读。
        """
        data = ns_alerts.payload
        alert = alert_service.get_alert_by_id(alert_id)
        if not alert:
            return APIResponse.error(message="告警不存在", status_code=404)
        if "is_read" in data:
            # 写入路径收口至 alert_service（F17 防腐层）：原路由内 is_read/read_at 赋值 + commit 已迁出
            ok = alert_service.update_alert_status(alert_id, bool(data["is_read"]))
            if not ok:
                return APIResponse.error(message="告警不存在", status_code=404)
        invalidate_cache("api:/api/alerts/*")
        return APIResponse.success(message="告警状态更新成功")

    @ns_alerts.doc("delete_alert", description="删除告警", security="Bearer")
    @ns_alerts.response(200, "删除成功")
    @ns_alerts.response(404, "告警不存在")
    @requires_permission("device.manage")
    def delete(self, alert_id):
        """
        删除告警
        删除指定的告警记录。
        """
        result = alert_service.delete_alert(alert_id)  # noqa: F841
        if not result:
            return APIResponse.error(message="告警不存在", status_code=404)
        invalidate_cache("api:/api/alerts/*")
        return APIResponse.success(message="告警删除成功")


@ns_alerts.route("/read/<int:alert_id>")
class AlertRead(Resource):
    @ns_alerts.doc("mark_alert_read", description="标记告警为已读", security="Bearer")
    @ns_alerts.response(200, "标记成功")
    @ns_alerts.response(404, "告警不存在")
    @requires_permission("device.view")
    def post(self, alert_id):
        """
        标记告警为已读
        将指定告警标记为已读状态。
        """
        result = alert_service.mark_as_read(alert_id)  # noqa: F841
        if not result:
            return APIResponse.error(message="告警不存在", status_code=404)
        invalidate_cache("api:/api/alerts/*")
        return APIResponse.success(message="告警已标记为已读")


@ns_alerts.route("/read-all")
class AlertReadAll(Resource):
    @ns_alerts.doc("mark_all_alerts_read", description="标记所有告警为已读", security="Bearer")
    @ns_alerts.response(200, "标记成功")
    @requires_permission("device.view")
    def post(self):
        """
        标记所有告警为已读
        将所有未读告警标记为已读状态。
        """
        count = alert_service.mark_all_as_read()
        if count is None:
            return APIResponse.error(message="标记所有告警已读失败", status_code=500)
        invalidate_cache("api:/api/alerts/*")
        return APIResponse.success(data={"count": count}, message=f"已标记 {count} 条告警为已读")


@ns_alerts.route("/stats")
class AlertStats(Resource):
    @ns_alerts.doc("get_alert_stats", description="获取告警统计信息", security="Bearer")
    @ns_alerts.response(200, "成功")
    @requires_permission("device.view")
    @cached_api(ttl=60)
    def get(self):
        """
        获取告警统计信息
        获取告警的统计数据，包括总数、未读数、按级别统计等。
        """
        stats = alert_service.get_alert_stats()
        if stats is None:
            return APIResponse.error(message="获取告警统计失败", status_code=500)
        return APIResponse.success(data={"stats": stats})


@ns_alerts.route("/cleanup")
class AlertCleanup(Resource):
    @ns_alerts.doc("cleanup_old_alerts", description="清理过期告警", security="Bearer")
    @ns_alerts.response(200, "清理成功")
    @requires_permission("device.manage")
    def post(self):
        """
        清理过期告警
        删除指定天数之前的告警记录，默认为7天。
        """
        args = ns_alerts.parser().add_argument("days", type=int, default=7, location="args")
        args = args.parse_args()
        count = alert_service.delete_old_alerts(days=args["days"])
        if count is None:
            return APIResponse.error(message="清理过期告警失败", status_code=500)
        invalidate_cache("api:/api/alerts/*")
        return APIResponse.success(
            data={"deleted_count": count}, message=f"已删除 {count} 条过期告警"
        )


@ns_alerts.route("/test")
class AlertTest(Resource):
    @ns_alerts.doc("test_alert", description="测试告警功能", security="Bearer")
    @ns_alerts.response(200, "测试成功")
    @requires_permission("device.manage")
    def post(self):
        """
        测试告警功能
        创建一条测试告警，用于验证告警系统是否正常工作。
        """
        alert = alert_service.create_alert(
            "system_warning",
            "这是一条测试告警",
            device_id="test_device",
            device_name="测试设备",
            extra_data={"test": "data"},
            suppress=False,
        )
        if alert:
            invalidate_cache("api:/api/alerts/*")
            return APIResponse.success(data={"alert_id": alert.id}, message="测试告警创建成功")
        else:
            return APIResponse.error(message="测试告警创建失败", status_code=500)
