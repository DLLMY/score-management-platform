from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, User, ScoreRecord, ScoreRule, Device, get_by_id
from utils.permission import requires_permission
from utils.response import APIResponse
from datetime import datetime

ns_box = Namespace("box", description="积分盒子相关操作")

box_verify_request = ns_box.model(
    "BoxVerifyRequest",
    {
        "card_id": fields.String(required=True, description="卡号ID"),
        "device_id": fields.String(required=True, description="设备标识ID"),
        "rule_id": fields.Integer(description="规则ID（可选）"),
    },
)

box_user_response = ns_box.model(
    "BoxUserResponse",
    {
        "id": fields.Integer(description="用户ID"),
        "name": fields.String(description="用户姓名"),
        "card_id": fields.String(description="卡号ID"),
        "current_score": fields.Float(description="当前积分"),
        "class_name": fields.String(description="班级名称"),
    },
)


def check_rule_limits(user_id, rule_id):
    """检查规则使用限制（每日上限/最小间隔）"""
    rule = get_by_id(ScoreRule, rule_id)
    if not rule:
        return True, None

    today = datetime.now().date()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())

    if rule.daily_limit > 0:
        today_count = ScoreRecord.query.filter(
            ScoreRecord.user_id == user_id,
            ScoreRecord.rule_id == rule_id,
            ScoreRecord.created_at >= start_of_day,
            ScoreRecord.created_at <= end_of_day,
        ).count()
        if today_count >= rule.daily_limit:
            return False, f"今日已达到上限({rule.daily_limit}次)"

    if rule.min_interval > 0:
        last_record = ScoreRecord.query.filter(ScoreRecord.user_id == user_id, ScoreRecord.rule_id == rule_id).order_by(
            ScoreRecord.created_at.desc()
        )

        if last_record:
            time_since_last = datetime.now() - last_record.created_at
            if time_since_last.total_seconds() < rule.min_interval * 60:
                remaining_minutes = int((rule.min_interval * 60 - time_since_last.total_seconds()) / 60)
                return False, f"请等待{remaining_minutes}分钟后再操作"

    return True, None


@ns_box.route("/verify")
class BoxVerify(Resource):

    @ns_box.doc("box_verify", description="积分盒子验证")
    @ns_box.expect(box_verify_request)
    @ns_box.response(200, "验证成功")
    @ns_box.response(400, "缺少必要参数")
    @ns_box.response(403, "无权限访问")
    @ns_box.response(404, "用户或设备不存在")
    @requires_permission("device.manage")
    def post(self):
        """
        积分盒子验证

        用于积分盒子设备的用户验证和积分操作。
        如果提供rule_id，则根据规则添加积分；否则只验证用户身份。

        请求体：
        - card_id: 卡号ID（必填）
        - device_id: 设备标识ID（必填）
        - rule_id: 规则ID（可选）
        """
        data = request.get_json()
        card_id = data.get("card_id")
        device_id = data.get("device_id")
        rule_id = data.get("rule_id")

        if not card_id or not device_id:
            return APIResponse.bad_request(message="缺少必要参数")

        user = User.query.filter_by(card_id=card_id).first()
        if not user:
            return APIResponse.not_found(message="未找到用户")

        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return APIResponse.not_found(message="设备不存在")

        if device.status != "online":
            return APIResponse.bad_request(message="设备离线")

        if rule_id:
            rule = get_by_id(ScoreRule, rule_id)
            if not rule or not rule.is_active:
                return APIResponse.bad_request(message="规则不存在或未启用")

            if device.admin_id and rule.created_by != device.admin_id:
                return APIResponse.forbidden(message="规则权限不足")

            allowed, error_msg = check_rule_limits(user.id, rule_id)
            if not allowed:
                return APIResponse.bad_request(message=error_msg)

            user.current_score += rule.score

            record = ScoreRecord(
                user_id=user.id,
                rule_id=rule.id,
                score_change=rule.score,
                description=rule.description,
                source="box",
                source_info=f"device_id={device_id}",
            )
            db.session.add(record)
            db.session.commit()

            return APIResponse.success(
                message=f"积分添加成功 +{rule.score}",
                data={
                    "user": {
                        "id": user.id,
                        "name": user.name,
                        "card_id": user.card_id,
                        "current_score": user.current_score,
                    }
                },
            )

        return APIResponse.success(
            message="用户验证成功",
            data={
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "card_id": user.card_id,
                    "current_score": user.current_score,
                    "class_name": user.class_name,
                }
            },
        )
