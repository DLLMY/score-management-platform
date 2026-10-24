"""积分录入链路：按规则 ID/名称/分值三路录入、会话内应用、撤销与规则查询。"""

import json
import logging
import time

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from models import ScoreRecord, ScoreRule, User, db
from services.mqtt_message import _shared
from services.mqtt_message._shared import ensure_app_context

logger = logging.getLogger(__name__)


class _ScoreMixin:
    @ensure_app_context
    def handle_score_add(self, data):
        msg_id = data.get("msg_id")
        client_id = data.get("client_id")
        user_id = data.get("user_id")
        rule_id = data.get("rule_id")
        rule_name = data.get("rule_name")
        score_change = data.get("score_change")
        description = data.get("description")
        operator = data.get("operator", "MQTT System")

        response_topic = f"score/add/result/{client_id}" if client_id else "score/add/result"

        from models import ProcessedMessage

        record = ProcessedMessage.query.filter_by(message_id=msg_id).first() if msg_id else None
        if record:
            response = {
                "success": True,
                "message": "Message already processed (idempotent)",
                "msg_id": msg_id,
                "new_score": record.new_score,
                "record_id": record.record_id,
                "undo_code": f"UNDO_{record.record_id}",
            }
            _shared.publish_mqtt(response_topic, json.dumps(response))
            return

        user = _shared.get_by_id(User, user_id)
        if not user:
            response = {
                "success": False,
                "message": "User not found",
                "msg_id": msg_id,
            }
            _shared.publish_mqtt(response_topic, json.dumps(response))
            return
        if rule_id:
            self._handle_score_by_rule_id(
                user, rule_id, msg_id, client_id, response_topic, operator, description
            )
        elif rule_name:
            self._handle_score_by_rule_name(
                user, rule_name, msg_id, client_id, response_topic, operator, description
            )
        elif score_change is not None:
            self._handle_score_by_score_change(
                user, score_change, msg_id, client_id, response_topic, operator, description
            )
        else:
            response = {
                "success": False,
                "message": ("Provide rule_id, rule_name, or score_change"),
                "msg_id": msg_id,
            }
            _shared.publish_mqtt(response_topic, json.dumps(response))

    def _apply_score_in_session(
        self, user, score_to_add, record_description, rule_id_value,
        msg_id, client_id, response_topic, operator,
    ):
        """在事务内原子累加并落库 ScoreRecord，返回 (early_return, actual_change, record_id, new_score)。

        early_return 为 True 表示 _try_insert_processed 命中并发重试、已回发幂等响应，
        调用方应直接 return（与原实现在 with 块内 return 等价）。
        rule_id_value 为 None 时表示无需写入 rule_id（如 score_change 路径）。
        """
        from models import SystemConfig as _SysCfg
        from models import db
        from utils.score_utils import atomic_score_update

        _cfg = _SysCfg.query.first()
        _min_s = _cfg.min_score if _cfg else 0
        _max_s = _cfg.max_score if _cfg else 100
        _ok, new_score = atomic_score_update(
            user.id, score_to_add, min_score=_min_s, max_score=_max_s
        )
        if not _ok:
            new_score = user.current_score or 0
        actual_change = new_score - (user.current_score or 0)

        if rule_id_value is not None:
            record = ScoreRecord(
                student_id=user.id,
                rule_id=rule_id_value,
                score_change=actual_change,
                description=record_description,
                operator=operator,
            )
        else:
            record = ScoreRecord(
                student_id=user.id,
                score_change=actual_change,
                description=record_description,
                operator=operator,
            )
        user.current_score = new_score
        with _shared.db_session_scope():
            db.session.add(record)
            db.session.flush()
            if self._try_insert_processed(msg_id, record.id, new_score, client_id, response_topic):
                return True, actual_change, record.id, new_score
        return False, actual_change, record.id, new_score

    def _handle_score_by_rule_id(
        self, user, rule_id, msg_id, client_id, response_topic, operator, description
    ):
        rule = _shared.get_by_id(ScoreRule, rule_id)
        if not rule or not rule.is_active:
            response = {
                "success": False,
                "message": "Rule is invalid or not enabled",
                "msg_id": msg_id,
            }
            _shared.publish_mqtt(response_topic, json.dumps(response))
            return
        limit_check = self.check_rule_limit(user.id, rule_id)
        if not limit_check["allow"]:
            response = {
                "success": False,
                "message": limit_check["message"],
                "msg_id": msg_id,
            }
            _shared.publish_mqtt(response_topic, json.dumps(response))
            return
        early, actual_change, record_id, new_score = self._apply_score_in_session(
            user, rule.score, description or rule.name, rule_id,
            msg_id, client_id, response_topic, operator,
        )
        if early:
            return
        try:
            from services.score_recalc import enqueue_or_recalc_user_score

            enqueue_or_recalc_user_score(user.id)
        except Exception as e:
            logger.error(
                "[CompositeScore] MQTT 加分重算综合分失败 user_id=%s: %s",
                user.id,
                e,
            )
        response = {
            "success": True,
            "message": (f"Score added: {rule.name} " f"(+{actual_change} points)"),
            "msg_id": msg_id,
            "new_score": new_score,
            "record_id": record_id,
            "undo_code": f"UNDO_{record_id}",
        }
        _shared.publish_mqtt(response_topic, json.dumps(response))

    def _handle_score_by_rule_name(
        self, user, rule_name, msg_id, client_id, response_topic, operator, description
    ):
        rule = ScoreRule.query.filter(
            ScoreRule.name.like(f"%{rule_name}%"), ScoreRule.is_active
        ).first()
        if not rule:
            matching_rules = ScoreRule.query.filter(
                ScoreRule.name.like(f"%{rule_name}%")
            ).all()
            if matching_rules:
                rule_names = [r.name for r in matching_rules]
                response = {
                    "success": False,
                    "message": (
                        f'No enabled rule matching "{rule_name}". ' f"Available: {rule_names}"
                    ),
                    "msg_id": msg_id,
                }
            else:
                response = {
                    "success": False,
                    "message": f'No rule found containing "{rule_name}"',
                    "msg_id": msg_id,
                }
            _shared.publish_mqtt(response_topic, json.dumps(response))
            return
        limit_check = self.check_rule_limit(user.id, rule.id)
        if not limit_check["allow"]:
            response = {
                "success": False,
                "message": limit_check["message"],
                "msg_id": msg_id,
            }
            _shared.publish_mqtt(response_topic, json.dumps(response))
            return
        early, actual_change, record_id, new_score = self._apply_score_in_session(
            user, rule.score, description or rule.name, rule.id,
            msg_id, client_id, response_topic, operator,
        )
        if early:
            return
        response = {
            "success": True,
            "message": (f"Score added: {rule.name} " f"(+{actual_change} points)"),
            "msg_id": msg_id,
            "new_score": new_score,
            "rule_name": rule.name,
            "record_id": record_id,
            "undo_code": f"UNDO_{record_id}",
        }
        _shared.publish_mqtt(response_topic, json.dumps(response))

    def _handle_score_by_score_change(
        self, user, score_change, msg_id, client_id, response_topic, operator, description
    ):
        try:
            score_to_add = float(score_change)
        except (TypeError, ValueError):
            score_to_add = 0
        early, actual_change, record_id, new_score = self._apply_score_in_session(
            user, score_to_add, description or "MQTT score adjustment", None,
            msg_id, client_id, response_topic, operator,
        )
        if early:
            return
        response = {
            "success": True,
            "message": (f"Score adjusted ({actual_change:+d} points)"),
            "msg_id": msg_id,
            "new_score": new_score,
            "record_id": record_id,
            "undo_code": f"UNDO_{record_id}",
        }
        _shared.publish_mqtt(response_topic, json.dumps(response))

    def _try_insert_processed(self, msg_id, record_id, new_score, client_id, response_topic):
        """事务内写入 ProcessedMessage；若 msg_id 唯一约束冲突（并发重发绕过外层检查），

        回滚并回查已有记录、直接发幂等响应，返回 True 表示已处理（调用方应 return）。
        正常（无冲突 / 无 msg_id）返回 False，由调用方继续发成功响应。
        """
        if not msg_id:
            return False
        from sqlalchemy.exc import IntegrityError

        from models import ProcessedMessage, db

        try:
            processed = ProcessedMessage(
                message_id=msg_id,
                record_id=record_id,
                new_score=new_score,
                client_id=client_id,
            )
            db.session.add(processed)
            db.session.flush()
            return False
        except IntegrityError:
            db.session.rollback()
            existing = ProcessedMessage.query.filter_by(message_id=msg_id).first()
            if existing:
                response = {
                    "success": True,
                    "message": "Message already processed (idempotent, concurrent retry)",
                    "msg_id": msg_id,
                    "new_score": existing.new_score,
                    "record_id": existing.record_id,
                    "undo_code": f"UNDO_{existing.record_id}",
                }
                _shared.publish_mqtt(response_topic, json.dumps(response))
                return True
            raise

    @ensure_app_context
    def handle_score_undo(self, data):
        undo_code = data.get("undo_code")
        client_id = data.get("client_id")
        reason = data.get("reason", "MQTT undo")
        response_topic = f"score/undo/result/{client_id}" if client_id else "score/undo/result"

        if not undo_code or not undo_code.startswith("UNDO_"):
            response = {"success": False, "message": "Invalid undo code"}
            _shared.publish_mqtt(response_topic, json.dumps(response))
            return

        record_id = int(undo_code.replace("UNDO_", ""))

        record = _shared.get_by_id(ScoreRecord, record_id)
        if not record:
            response = {
                "success": False,
                "message": f"Record ID not found: {record_id}",
            }
        elif "undone" in (record.description or ""):
            response = {
                "success": False,
                "message": "This record has already been undone",
            }
        else:
            with _shared.db_session_scope():
                user = _shared.get_by_id(User, record.student_id)
                if user:
                    user.current_score -= record.score_change
                    user.current_score = max(0, user.current_score)

                record.description = f"{record.description} [Undone: {reason}]"
                record.operator = "MQTT undo"

            response = {
                "success": True,
                "message": (f"Undo done ({record.score_change:+d} points)"),
                "user_id": user.id if user else None,
                "new_score": user.current_score if user else None,
            }
        _shared.publish_mqtt(response_topic, json.dumps(response))

    def _load_active_score_rules(self, retries=4):
        """读取当前启用的积分规则。

        生产洪流下 score/add、遥测落库(MQTTLog)高频写同一 SQLite，Flask-SQLAlchemy 默认连接
        busy_timeout=0，读查询易撞写锁抛 OperationalError(database is locked) 被上层 except 静默
        成 rules=[]（表现为设备偶发收不到规则）。这里显式设 busy_timeout 并重试几次规避。
        """
        from models import ScoreRule

        # busy_timeout 为连接级优化，规避洪流下读查询撞 SQLite 写锁被静默吞。
        # 无 app context 环境(如部分单测)下 db.session.execute 会抛 RuntimeError，跳过即可，
        # 不影响查询正确性；生产 MQTT 派发路径自带 app context，PRAGMA 正常生效。
        try:
            db.session.execute(text("PRAGMA busy_timeout=5000"))
        except Exception as e:
            # 无 app context 环境(如部分单测)下 db.session.execute 会抛 RuntimeError（详见上方 docstring）。
            # 这是可预期分支，降级跳过即可，但不应完全静默（T9 日志化）。
            logger.debug(f"设置 SQLite busy_timeout 跳过（无可用连接上下文）: {e}")
        last_err = None
        for attempt in range(retries):
            try:
                return (
                    ScoreRule.query.filter_by(is_active=True)
                    .order_by(ScoreRule.category_id, ScoreRule.id)
                    .all()
                )
            except SQLAlchemyError:
                time.sleep(0.15 * (attempt + 1))
        raise last_err

    @ensure_app_context
    def handle_score_rules_query(self, data):
        """设备查询积分规则：回发当前启用的规则列表（供设备端本地加分/校验参考）。

        此前订阅了 score/rules/query 但无处理分支 → 设备请求静默无响应。
        """
        request_id = data.get("request_id") if isinstance(data, dict) else None
        try:
            rules = self._load_active_score_rules()
            rule_list = [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "score": r.score,
                    "category": r.category.name if r.category else None,
                    "daily_limit": r.daily_limit,
                    "min_interval": r.min_interval,
                    "score_type": r.score_type,
                    "start_time": r.start_time.isoformat() if r.start_time else None,
                    "end_time": r.end_time.isoformat() if r.end_time else None,
                }
                for r in rules
            ]
            response = {
                "success": True,
                "message": "OK",
                "count": len(rule_list),
                "rules": rule_list,
                "request_id": request_id,
            }
        except Exception as e:
            # 诚实失败 + 留痕：不再静默吞异常（此前洪流下 database is locked 被吞成 rules=[] 难排查）
            logger.error("score/rules/query 加载规则失败: %s", e, exc_info=True)
            response = {
                "success": False,
                "message": f"Failed to load score rules: {e}",
                "count": 0,
                "rules": [],
                "request_id": request_id,
            }
        _shared.publish_mqtt("score/rules/result", json.dumps(response))
