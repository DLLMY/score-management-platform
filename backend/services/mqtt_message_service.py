from datetime import datetime
import logging
import time
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from services.mqtt_service import publish_mqtt, mqtt_manager, mqtt_logs
from services.class_time_checker import ClassTimeChecker
from services import phonebox_policy
from services.phonebox_policy import POLICY_BLOCK, POLICY_ALLOW_OVERRIDE, POLICY_ALLOW_WINDOW
from utils.db_session import db_session_scope


import json
from models import ScoreRecord, db, Approval, get_by_id, User, ScoreRule

logger = logging.getLogger(__name__)


class MQTTMessageService:

    def __init__(self):
        pass

    def check_time_valid(self, box_id, hour, minute):
        from models import TimeRule

        time_rules = TimeRule.query.filter_by(is_active=True).all()
        if not time_rules:
            return True

        for rule in time_rules:
            if rule.day_of_week == -1 or rule.day_of_week == datetime.now().weekday():
                start_time = datetime.now().replace(
                    hour=rule.start_hour, minute=rule.start_minute, second=0
                )
                end_time = datetime.now().replace(
                    hour=rule.end_hour, minute=rule.end_minute, second=0
                )
                current_time = datetime.now().replace(hour=hour, minute=minute, second=0)

                if start_time <= current_time <= end_time:
                    return rule.allow_unlock

        return False

    def check_rule_limit(self, user_id, rule_id):
        from models import ScoreRule, ScoreRecord

        rule = get_by_id(ScoreRule, rule_id)
        if not rule:
            return {"allow": False, "message": "Rule not found"}

        if rule.daily_limit <= 0:
            return {"allow": True, "message": "No limit"}

        today = datetime.now().date()
        records = ScoreRecord.query.filter(
            ScoreRecord.student_id == user_id,
            ScoreRecord.rule_id == rule_id,
            ScoreRecord.created_at >= datetime.combine(today, datetime.min.time()),
        ).all()

        total_score = sum(r.score_change for r in records)
        if total_score >= rule.daily_limit:
            return {
                "allow": False,
                "message": (f"Daily limit reached ({total_score}/" f"{rule.daily_limit})"),
            }

        if rule.min_interval > 0:
            last_record = (
                ScoreRecord.query.filter(
                    ScoreRecord.student_id == user_id,
                    ScoreRecord.rule_id == rule_id,
                )
                .order_by(ScoreRecord.created_at.desc())
                .first()
            )

            # R8 修复: 判空顺序（原先算 time_diff 再判 last_record → 首笔使用 AttributeError 且无回包）
            if last_record:
                time_diff = (datetime.now() - last_record.created_at).total_seconds()
                if time_diff < rule.min_interval:
                    return {
                        "allow": False,
                        "message": (f"Too frequent, wait {rule.min_interval}s"),
                    }

        return {"allow": True, "message": "Allowed"}

    def apply_score_limit(self, score):
        from models import SystemConfig

        config = SystemConfig.query.first()
        if config:
            return max(config.min_score, min(config.max_score, score))
        return max(0, min(100, score))

    def publish_unlock_result(self, box_id, success, reason, score=None):
        topic = f"phonebox/unlock/{box_id}"
        payload = {
            "result": "true" if success else "false",
            "reason": reason,
            "current_score": score,
        }
        publish_mqtt(topic, json.dumps(payload))

    def _get_user_by_card_id(self, card_id):
        from models import User

        user = mqtt_manager.get_cached_user(card_id)
        if not user:
            user = User.query.filter_by(card_id=card_id).first()
            if user:
                mqtt_manager.set_cached_user(card_id, user)
        return user

    def handle_query_message(self, data):
        box_id = data.get("box_id", "A")
        card_id = data.get("card_id")

        if not card_id:
            self.publish_unlock_result(box_id, False, "card_not_found")
            return

        user = self._get_user_by_card_id(card_id)

        if not user:
            self.publish_unlock_result(box_id, False, "card_not_found")
        else:
            self.publish_unlock_result(box_id, True, "query_ok", user.current_score)

    def handle_unlock_message(self, data):
        box_id = data.get("box_id", "A")
        card_id = data.get("card_id")
        hour = data.get("hour")
        minute = data.get("minute")

        if not card_id:
            self.publish_unlock_result(box_id, False, "card_not_found")
            return

        user = self._get_user_by_card_id(card_id)
        if not user:
            self.publish_unlock_result(box_id, False, "card_not_found")
            return

        # 班主任自助开箱策略：按班级由班主任自由决定（总开关 / 预设时段 / 一键放行）。
        # 优先级高于全局 TimeRule 与上课硬拦截：一键放行/预设时段内可直接开箱；
        # 班主任关闭本班时硬拒；无策略/未命中时回退到原有全局+课表逻辑（DEFER）。
        try:
            class_info_id = getattr(user, "class_info_id", None)
            check_time = None
            if hour is not None and minute is not None:
                try:
                    check_time = datetime.now().replace(
                        hour=int(hour), minute=int(minute), second=0, microsecond=0
                    )
                except Exception:
                    check_time = None
            if class_info_id:
                result = phonebox_policy.evaluate(class_info_id, check_time)
                decision = result.get("decision")
                if decision == POLICY_BLOCK:
                    ClassTimeChecker.log_notify_audit(
                        "unlock",
                        class_info_id,
                        result.get("policy_id"),
                        {"box_id": box_id, "card_id": card_id},
                        "PHONEBOX_TEACHER_DISABLED",
                        "班主任已关闭本班自助开箱",
                        force_send=False,
                    )
                    self.publish_unlock_result(box_id, False, "teacher_disabled")
                    return
                if decision in (POLICY_ALLOW_OVERRIDE, POLICY_ALLOW_WINDOW):
                    if decision == POLICY_ALLOW_OVERRIDE:
                        reason_code, reason_msg = (
                            "PHONEBOX_TEACHER_OVERRIDE",
                            "班主任一键放行，跳过上课时间拦截",
                        )
                    else:
                        reason_code, reason_msg = (
                            "PHONEBOX_TEACHER_WINDOW",
                            "班主任预设时段内，允许开箱",
                        )
                    ClassTimeChecker.log_notify_audit(
                        "unlock",
                        class_info_id,
                        result.get("policy_id"),
                        {"box_id": box_id, "card_id": card_id},
                        reason_code,
                        reason_msg,
                        force_send=False,
                    )
                    # 跳过全局门禁与上课硬拦截，直接进入积分扣减
                    self._deduct_and_unlock(box_id, user, card_id)
                    return
        except Exception as e:
            # 策略判定异常不影响主流程，回退到原有全局门禁逻辑
            print(f"[Unlock] 班主任策略判定异常，回退全局逻辑: {e}")

        # 全局 TimeRule 时段门禁（保留原有逻辑：allow_unlock 窗口外一律拒绝）
        if not self.check_time_valid(box_id, hour, minute):
            self.publish_unlock_result(box_id, False, "not_in_time")
            return

        # 新增：按班级课表反查，上课 / 自习时间禁止学生自助开箱（硬拦截，无 force_send）
        try:
            class_info_id = getattr(user, "class_info_id", None)
            if class_info_id:
                check_time = None
                if hour is not None and minute is not None:
                    try:
                        check_time = datetime.now().replace(
                            hour=int(hour), minute=int(minute), second=0, microsecond=0
                        )
                    except Exception:
                        check_time = None
                in_session, info = ClassTimeChecker.check_class_in_session(
                    class_info_id, check_time
                )
                if in_session:
                    msg = (
                        f"{info['class_name']}正在第{info['period_number']}节"
                        f"《{info['subject_name']}》，上课时间禁止开箱"
                    )
                    ClassTimeChecker.log_notify_audit(
                        "unlock",
                        class_info_id,
                        None,
                        {"box_id": box_id, "card_id": card_id},
                        "CLASS_IN_SESSION",
                        msg,
                        force_send=False,
                    )
                    self.publish_unlock_result(box_id, False, "class_in_session")
                    return
        except Exception as e:
            # 课表反查异常不影响主流程（全局门禁已校验），默认放行
            print(f"[Unlock] 课表反查异常，放行: {e}")

        # 积分门槛与扣减统一由 _deduct_and_unlock 处理（内部已含 <60 → score_low），
        # 与班主任策略放行路径共用同一出口，避免两处判断漂移。
        self._deduct_and_unlock(box_id, user, card_id)

    def _deduct_and_unlock(self, box_id, user, card_id):
        """学生自助开箱统一出口：限额/黑名单/分数门槛校验（R2 统一 UnlockValidator）→ 扣分记账 → 下发开箱成功结果。

        供原路径（全局门禁/课表通过）与班主任策略放行路径共用。
        skip_time_window=True：时段已由调用方校验（全局 TimeRule / 班主任策略），避免双重时段拦截。
        """
        from services.unlock_validator import UnlockValidator

        allowed, reason, info = UnlockValidator.validate_unlock(card_id, skip_time_window=True)
        if not allowed:
            self.publish_unlock_result(box_id, False, reason, user.current_score)
            return
        # R2: 统一记账（扣 10 分 + 日/周计数 + 流水"开锁扣分"），内部 commit
        UnlockValidator.record_unlock(user)

        mqtt_manager.set_cached_user(card_id, user)
        self.publish_unlock_result(box_id, True, "score_ok", user.current_score)

    def handle_heartbeat_message(self, data):
        device_id = data.get("device_id")
        timestamp = data.get("timestamp")
        status = data.get("status")
        wifi_signal = data.get("wifi_signal")
        uptime = data.get("uptime")
        box_a_status = data.get("box_a_status")
        box_b_status = data.get("box_b_status")
        system_state = data.get("system_state")

        fw_version = data.get("fw_version")
        platform = data.get("platform")
        free_heap = data.get("free_heap")
        last_error = data.get("last_error")
        error_count = data.get("error_count")

        with db_session_scope():
            from models import Device, DeviceHeartbeat

            heartbeat_record = DeviceHeartbeat(
                device_id=device_id,
                timestamp=timestamp,
                status=status,
                wifi_signal=wifi_signal,
                uptime=uptime,
                box_a_status=box_a_status,
                box_b_status=box_b_status,
                system_state=system_state,
            )
            db.session.add(heartbeat_record)

            device = Device.query.filter_by(device_id=device_id).first()
            if device:
                device.status = status
                device.last_heartbeat = datetime.now()
                device.wifi_signal = wifi_signal
                device.uptime = uptime
                device.box_a_status = box_a_status
                device.box_b_status = box_b_status
                device.system_state = system_state
                device.updated_at = datetime.now()

                if fw_version is not None:
                    device.fw_version = fw_version
                if platform is not None:
                    device.platform = platform
                if free_heap is not None:
                    device.free_heap = free_heap
                if last_error is not None:
                    device.last_error = last_error
                if error_count is not None:
                    device.error_count = error_count
            else:
                device = Device(
                    device_id=device_id,
                    name=f"Device {device_id}",
                    status=status,
                    last_heartbeat=datetime.now(),
                    wifi_signal=wifi_signal,
                    uptime=uptime,
                    box_a_status=box_a_status,
                    box_b_status=box_b_status,
                    system_state=system_state,
                    fw_version=fw_version,
                    platform=platform,
                    free_heap=free_heap,
                    last_error=last_error,
                    error_count=error_count or 0,
                )
                db.session.add(device)

    def handle_points_query(self, data):
        card_id = data.get("card_id")
        request_id = data.get("request_id")

        if not card_id:
            response = {
                "success": False,
                "message": "Please provide card ID",
                "request_id": request_id,
            }
            publish_mqtt("phonebox/points/result", json.dumps(response))
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

        publish_mqtt("phonebox/points/result", json.dumps(response))

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
            publish_mqtt("phonebox/points/result", json.dumps(response))
            return

        if amount <= 0:
            response = {
                "success": False,
                "message": "Amount must be greater than 0",
            }
            publish_mqtt("phonebox/points/result", json.dumps(response))
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
            with db_session_scope():
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

        publish_mqtt("phonebox/points/result", json.dumps(response))

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
            publish_mqtt("phonebox/points/result", json.dumps(response))
            return

        if amount <= 0:
            response = {
                "success": False,
                "message": "Amount must be greater than 0",
            }
            publish_mqtt("phonebox/points/result", json.dumps(response))
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
            with db_session_scope():

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

        publish_mqtt("phonebox/points/result", json.dumps(response))

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

        from models import ProcessedMessage, db

        record = ProcessedMessage.query.filter_by(message_id=msg_id).first() if msg_id else None
        if record:
            # 幂等回包也回显 undo_code，使客户端在任意一次重发都能取到撤销码
            # （否则洪流下首次回包未穿透时，后续重发只回 "already processed" 且无 undo_code，
            #  客户端将永远拿不到 undo_code、无法完成撤销往返）
            response = {
                "success": True,
                "message": "Message already processed (idempotent)",
                "msg_id": msg_id,
                "new_score": record.new_score,
                "record_id": record.record_id,
                "undo_code": f"UNDO_{record.record_id}",
            }
            publish_mqtt(response_topic, json.dumps(response))
            return

        user = get_by_id(User, user_id)
        if not user:
            response = {
                "success": False,
                "message": "User not found",
                "msg_id": msg_id,
            }
            publish_mqtt(response_topic, json.dumps(response))
        elif rule_id:
            rule = get_by_id(ScoreRule, rule_id)
            if not rule or not rule.is_active:
                response = {
                    "success": False,
                    "message": "Rule is invalid or not enabled",
                    "msg_id": msg_id,
                }
                publish_mqtt(response_topic, json.dumps(response))
            else:
                limit_check = self.check_rule_limit(user_id, rule_id)
                if not limit_check["allow"]:
                    response = {
                        "success": False,
                        "message": limit_check["message"],
                        "msg_id": msg_id,
                    }
                    publish_mqtt(response_topic, json.dumps(response))
                else:
                    with db_session_scope():
                        # R5: SQL 原子累加 + 钳制（原 Python 读改写有并发竞态；钳制语义与 apply_score_limit 一致）
                        from models import SystemConfig as _SysConfig
                        from utils.score_utils import atomic_score_update

                        _cfg = _SysConfig.query.first()
                        _min_s = _cfg.min_score if _cfg else 0
                        _max_s = _cfg.max_score if _cfg else 100
                        _ok, new_score = atomic_score_update(
                            user_id, rule.score, min_score=_min_s, max_score=_max_s
                        )
                        if not _ok:
                            new_score = user.current_score or 0
                        actual_change = new_score - (user.current_score or 0)

                        record = ScoreRecord(
                            student_id=user_id,
                            rule_id=rule_id,
                            score_change=actual_change,
                            description=description or rule.name,
                            operator=operator,
                        )
                        user.current_score = new_score
                        db.session.add(record)
                        db.session.flush()  # 先 flush 让自增主键 record.id 生成，否则 ProcessedMessage.record_id 会存成 None

                        if self._try_insert_processed(msg_id, record.id, new_score, client_id, response_topic):
                            return

                    # R4: MQTT 加分后触发综合评分重算（低频卡片操作，单学生聚合查询，失败不影响主流程）
                    try:
                        from services.composite_score_service import CompositeScoreService

                        CompositeScoreService.recalculate_user_score(user_id)
                    except Exception as e:
                        logger.error(
                            "[CompositeScore] MQTT 加分重算综合分失败 user_id=%s: %s",
                            user_id, e,
                        )

                    response = {
                        "success": True,
                        "message": (f"Score added: {rule.name} " f"(+{actual_change} points)"),
                        "msg_id": msg_id,
                        "new_score": new_score,
                        "record_id": record.id,
                        "undo_code": f"UNDO_{record.id}",
                    }
                    publish_mqtt(response_topic, json.dumps(response))
        elif rule_name:
            rule = ScoreRule.query.filter(
                ScoreRule.name.like(f"%{rule_name}%"), ScoreRule.is_active
            ).first()
            if not rule:
                matching_rules = ScoreRule.query.filter(ScoreRule.name.like(f"%{rule_name}%")).all()
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
                publish_mqtt(response_topic, json.dumps(response))
            else:
                limit_check = self.check_rule_limit(user_id, rule.id)
                if not limit_check["allow"]:
                    response = {
                        "success": False,
                        "message": limit_check["message"],
                        "msg_id": msg_id,
                    }
                    publish_mqtt(response_topic, json.dumps(response))
                else:
                    with db_session_scope():
                        actual_change = rule.score
                        # R5 补漏: SQL 原子累加 + 钳制（与 rule_id 路径一致）
                        from models import SystemConfig as _SysCfg2
                        from utils.score_utils import atomic_score_update

                        _cfg2 = _SysCfg2.query.first()
                        _min2 = _cfg2.min_score if _cfg2 else 0
                        _max2 = _cfg2.max_score if _cfg2 else 100
                        _ok2, new_score = atomic_score_update(
                            user_id, actual_change, min_score=_min2, max_score=_max2
                        )
                        if not _ok2:
                            new_score = user.current_score or 0
                        actual_change = new_score - (user.current_score or 0)

                        record = ScoreRecord(
                            student_id=user_id,
                            rule_id=rule.id,
                            score_change=actual_change,
                            description=description or rule.name,
                            operator=operator,
                        )
                        user.current_score = new_score
                        db.session.add(record)
                        db.session.flush()  # 先 flush 让自增主键 record.id 生成，否则 ProcessedMessage.record_id 会存成 None

                        if self._try_insert_processed(msg_id, record.id, new_score, client_id, response_topic):
                            return

                    response = {
                        "success": True,
                        "message": (f"Score added: {rule.name} " f"(+{actual_change} points)"),
                        "msg_id": msg_id,
                        "new_score": new_score,
                        "rule_name": rule.name,
                        "record_id": record.id,
                        "undo_code": f"UNDO_{record.id}",
                    }
                    publish_mqtt(response_topic, json.dumps(response))
        elif score_change is not None:
            with db_session_scope():
                try:
                    actual_change = float(score_change)
                except (TypeError, ValueError):
                    actual_change = 0
                # R5 补漏: SQL 原子累加 + 钳制
                from models import SystemConfig as _SysCfg3
                from utils.score_utils import atomic_score_update

                _cfg3 = _SysCfg3.query.first()
                _min3 = _cfg3.min_score if _cfg3 else 0
                _max3 = _cfg3.max_score if _cfg3 else 100
                _ok3, new_score = atomic_score_update(
                    user_id, actual_change, min_score=_min3, max_score=_max3
                )
                if not _ok3:
                    new_score = user.current_score or 0
                actual_change = new_score - (user.current_score or 0)

                record = ScoreRecord(
                    student_id=user_id,
                    score_change=actual_change,
                    description=description or "MQTT score adjustment",
                    operator=operator,
                )
                user.current_score = new_score
                db.session.add(record)
                db.session.flush()  # 先 flush 让自增主键 record.id 生成，否则 ProcessedMessage.record_id 会存成 None

                if self._try_insert_processed(msg_id, record.id, new_score, client_id, response_topic):
                    return

            response = {
                "success": True,
                "message": (f"Score adjusted ({actual_change:+d} points)"),
                "msg_id": msg_id,
                "new_score": new_score,
                "record_id": record.id,
                "undo_code": f"UNDO_{record.id}",
            }
            publish_mqtt(response_topic, json.dumps(response))
        else:
            response = {
                "success": False,
                "message": ("Provide rule_id, rule_name, or score_change"),
                "msg_id": msg_id,
            }
            publish_mqtt(response_topic, json.dumps(response))

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
                publish_mqtt(response_topic, json.dumps(response))
                return True
            raise

    def handle_score_undo(self, data):
        undo_code = data.get("undo_code")
        client_id = data.get("client_id")
        reason = data.get("reason", "MQTT undo")
        response_topic = f"score/undo/result/{client_id}" if client_id else "score/undo/result"

        if not undo_code or not undo_code.startswith("UNDO_"):
            response = {"success": False, "message": "Invalid undo code"}
            publish_mqtt(response_topic, json.dumps(response))
            return

        record_id = int(undo_code.replace("UNDO_", ""))

        record = get_by_id(ScoreRecord, record_id)
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
            with db_session_scope():
                user = get_by_id(User, record.student_id)
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
        publish_mqtt(response_topic, json.dumps(response))

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
            except SQLAlchemyError as last_err:
                time.sleep(0.15 * (attempt + 1))
        raise last_err

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
        except Exception as e:  # noqa: BLE001
            # 诚实失败 + 留痕：不再静默吞异常（此前洪流下 database is locked 被吞成 rules=[] 难排查）
            logger.error("score/rules/query 加载规则失败: %s", e, exc_info=True)
            response = {
                "success": False,
                "message": f"Failed to load score rules: {e}",
                "count": 0,
                "rules": [],
                "request_id": request_id,
            }
        publish_mqtt("score/rules/result", json.dumps(response))

    def handle_mqtt_message(self, client, topic, message):
        mqtt_logs.append(
            {
                "topic": topic,
                "message": message,
                "direction": "receive",
                "timestamp": datetime.now().isoformat(),
            }
        )

        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            # 畸形负载静默丢弃会让设备业务请求无声消失——留痕
            import logging

            logging.getLogger(__name__).warning(
                f"MQTT消息JSON解析失败, topic={topic}, payload前120字={message[:120]}"
            )
            return

        if topic == "phonebox/query":
            self.handle_query_message(data)
        elif topic == "phonebox/unlock" or topic.startswith("phonebox/unlock/"):
            # 订阅是 phonebox/unlock/+（实际主题 phonebox/unlock/{device_id}），
            # 此前精确匹配 topic == "phonebox/unlock" 永远不命中 → 开锁请求静默丢弃
            self.handle_unlock_message(data)
        elif topic == "phonebox/heartbeat":
            self.handle_heartbeat_message(data)
        elif topic == "phonebox/points/query":
            self.handle_points_query(data)
        elif topic == "phonebox/points/add":
            self.handle_points_add(data)
        elif topic == "phonebox/points/sub":
            self.handle_points_sub(data)
        elif topic == "score/add":
            self.handle_score_add(data)
        elif topic == "score/undo":
            self.handle_score_undo(data)
        elif topic == "score/rules/query":
            # 设备查询积分规则（此前订阅了 score/rules/query 但无处理分支 → 设备请求无响应）
            self.handle_score_rules_query(data)


mqtt_message_service = MQTTMessageService()
