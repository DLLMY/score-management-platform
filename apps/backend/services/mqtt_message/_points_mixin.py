"""积分链路：幂等键/已处理标记/结果发布 + 查询/加分/扣分。"""

import json

from models import Approval, db
from services.mqtt_message import _shared
from services.mqtt_message._shared import ensure_app_context
from utils.logger import log_warning


class _PointsMixin:
    @staticmethod
    def _points_idempotency_key(kind, msg_id):
        """构造幂等键；msg_id 为空则返回 None（表示不做去重，保持历史行为）。"""
        if not msg_id:
            return None
        return f"points:{kind}:{msg_id}"

    @staticmethod
    def _find_processed(key):
        """查询已处理记录；key 为空返回 None。"""
        if not key:
            return None
        from models import ProcessedMessage

        return ProcessedMessage.query.filter_by(message_id=key).first()

    @staticmethod
    def _mark_processed(key, approval_id, card_id, device_id):
        """写入幂等记录（key 为空则跳过）。失败不阻断主流程。"""
        if not key:
            return
        try:
            from models import ProcessedMessage

            db.session.add(
                ProcessedMessage(
                    message_id=key,
                    record_id=approval_id,
                    client_id=device_id,
                )
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            log_warning(f"[points] 幂等记录写入失败（已回滚）: {e}")

    @staticmethod
    def _publish_points_result(response, device_id=None):
        """G3: points/result 下行统一补 device_id（新固件 v1.6.0+ 定向校验；缺省不输出，零破坏）。"""
        if device_id is not None:
            response["device_id"] = device_id
        _shared.publish_mqtt("phonebox/points/result", json.dumps(response))

    @ensure_app_context
    def handle_points_query(self, data):
        card_id = data.get("card_id")
        request_id = data.get("request_id")
        device_id = data.get("device_id")

        if not card_id:
            response = {
                "success": False,
                "message": "Please provide card ID",
                "request_id": request_id,
            }
            self._publish_points_result(response, device_id=device_id)
            return

        user = self._get_user_by_card_id(card_id)

        if not user:
            response = {
                "success": False,
                "message": "Card not registered, user not found",
                "card_id": card_id,
                "request_id": request_id,
            }
        else:
            response = {
                "success": True,
                "message": "Query successful",
                "card_id": card_id,
                "user_name": user.name,
                "new_points": user.current_score,
                "request_id": request_id,
            }

        self._publish_points_result(response, device_id=device_id)

    @ensure_app_context
    def handle_points_add(self, data):
        card_id = data.get("card_id")
        amount = data.get("amount", 0)
        device_id = data.get("device_id")
        request_id = data.get("request_id")

        if not card_id:
            response = {
                "success": False,
                "message": "Please provide card ID",
            }
            self._publish_points_result(response, device_id=device_id)
            return

        if amount <= 0:
            response = {
                "success": False,
                "message": "Amount must be greater than 0",
            }
            self._publish_points_result(response, device_id=device_id)
            return

        # 差异 #7：msg_id 幂等（未带 msg_id → 不做去重，行为与历史一致）
        idem_key = self._points_idempotency_key("add", data.get("msg_id"))
        processed = self._find_processed(idem_key)
        if processed:
            response = {
                "success": True,
                "message": "Message already processed (idempotent)",
                "card_id": card_id,
                "requested_amount": amount,
                "request_id": request_id,
                "msg_id": data.get("msg_id"),
                "approval_id": processed.record_id,
                "status": "pending",
            }
            self._publish_points_result(response, device_id=device_id)
            return

        user = self._get_user_by_card_id(card_id)

        if not user:
            response = {
                "success": False,
                "message": "Card not registered, user not found",
                "card_id": card_id,
                "request_id": request_id,
            }
        else:
            with _shared.db_session_scope():
                from models import Approval

                approval = Approval(
                    student_id=user.id,
                    type="score_add",
                    title="Device score add request",
                    description=(
                        f"Device {device_id} requests to add +{amount} " f"points for {user.name}"
                    ),
                    score_change=amount,
                    status="pending",
                )
                db.session.add(approval)

            # 差异 #7：首次处理成功后写幂等记录
            self._mark_processed(idem_key, approval.id, card_id, device_id)

            response = {
                "success": True,
                "message": ("Request submitted for approval, " "awaiting admin confirmation"),
                "card_id": card_id,
                "user_name": user.name,
                "requested_amount": amount,
                "request_id": request_id,
                "approval_id": approval.id,
                "status": "pending",
            }

        self._publish_points_result(response, device_id=device_id)

    @ensure_app_context
    def handle_points_sub(self, data):
        card_id = data.get("card_id")
        amount = data.get("amount", 0)
        device_id = data.get("device_id")
        request_id = data.get("request_id")

        if not card_id:
            response = {
                "success": False,
                "message": "Please provide card ID",
            }
            self._publish_points_result(response, device_id=device_id)
            return

        if amount <= 0:
            response = {
                "success": False,
                "message": "Amount must be greater than 0",
            }
            self._publish_points_result(response, device_id=device_id)
            return

        # 差异 #7：msg_id 幂等（未带 msg_id → 不做去重，行为与历史一致）
        idem_key = self._points_idempotency_key("sub", data.get("msg_id"))
        processed = self._find_processed(idem_key)
        if processed:
            response = {
                "success": True,
                "message": "Message already processed (idempotent)",
                "card_id": card_id,
                "requested_amount": amount,
                "request_id": request_id,
                "msg_id": data.get("msg_id"),
                "approval_id": processed.record_id,
                "status": "pending",
            }
            self._publish_points_result(response, device_id=device_id)
            return

        user = self._get_user_by_card_id(card_id)

        if not user:
            response = {
                "success": False,
                "message": "Card not registered, user not found",
                "card_id": card_id,
                "request_id": request_id,
            }
        else:
            with _shared.db_session_scope():

                approval = Approval(
                    student_id=user.id,
                    type="score_sub",
                    title="Device score subtract request",
                    description=(
                        f"Device {device_id} requests to subtract -{amount} "
                        f"points from {user.name}"
                    ),
                    score_change=-amount,
                    status="pending",
                )
                db.session.add(approval)

            # 差异 #7：首次处理成功后写幂等记录
            self._mark_processed(idem_key, approval.id, card_id, device_id)

            response = {
                "success": True,
                "message": ("Request submitted for approval, " "awaiting admin confirmation"),
                "card_id": card_id,
                "user_name": user.name,
                "requested_amount": amount,
                "request_id": request_id,
                "approval_id": approval.id,
                "status": "pending",
            }

        self._publish_points_result(response, device_id=device_id)
