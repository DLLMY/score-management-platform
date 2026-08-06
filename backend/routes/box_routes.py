from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, User, ScoreRecord, ScoreRule, Device

ns_box = Namespace("box", description="积分盒子相关操作")

box_verify_request = ns_box.model(
    "BoxVerifyRequest",
    {
        "card_id": fields.String(required=True, description="卡号ID"),
        "device_id": fields.Integer(required=True, description="设备ID"),
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


@ns_box.route("/verify")
class BoxVerify(Resource):
    @ns_box.doc("box_verify", description="积分盒子验证")
    @ns_box.expect(box_verify_request)
    @ns_box.response(200, "验证成功")
    @ns_box.response(400, "缺少必要参数")
    @ns_box.response(404, "用户或设备不存在")
    def post(self):
        """
        积分盒子验证

        用于积分盒子设备的用户验证和积分操作。
        如果提供rule_id，则根据规则添加积分；否则只验证用户身份。

        请求体：
        - card_id: 卡号ID（必填）
        - device_id: 设备ID（必填）
        - rule_id: 规则ID（可选）
        """
        data = request.get_json()
        card_id = data.get("card_id")
        device_id = data.get("device_id")
        rule_id = data.get("rule_id")

        if not card_id or not device_id:
            return {"success": False, "message": "缺少必要参数"}, 400

        user = User.query.filter_by(card_id=card_id).first()
        if not user:
            return {"success": False, "message": "未找到用户"}, 404

        device = Device.query.get(device_id)
        if not device or device.status != "online":
            return {"success": False, "message": "设备离线或不存在"}, 400

        if rule_id:
            rule = ScoreRule.query.get(rule_id)
            if not rule or not rule.is_active:
                return {"success": False, "message": "规则不存在或未启用"}, 400

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

            return {
                "success": True,
                "message": f"积分添加成功 +{rule.score}",
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "card_id": user.card_id,
                    "current_score": user.current_score,
                },
            }

        return {
            "success": True,
            "message": "用户验证成功",
            "user": {
                "id": user.id,
                "name": user.name,
                "card_id": user.card_id,
                "current_score": user.current_score,
                "class_name": user.class_name,
            },
        }
