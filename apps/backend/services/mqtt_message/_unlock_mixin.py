"""开锁链路：结果发布、用户查询、班主任策略、上课拦截、扣分开锁、缓存重发与幂等标记。"""

import json

from models import User, db
from services import phonebox_policy
from services.class_time_checker import ClassTimeChecker
from services.mqtt_message import _shared
from services.mqtt_message._shared import (
    _build_policy_check_time,
    _teacher_policy_reason,
    ensure_app_context,
)
from services.phonebox_policy import (
    POLICY_ALLOW_OVERRIDE,
    POLICY_ALLOW_WINDOW,
    POLICY_BLOCK,
)
from utils.logger import log_warning
from utils.unlock_reasons import UnlockReason, canonicalize


class _UnlockMixin:
    def publish_unlock_result(
        self, box_id, success, reason, score=None, device_id=None, msg_id=None
    ):
        """下发开锁结果（差异 #17：原因码收拢到 UnlockReason 常量）。

        零破坏性变更约束下的设计：
          - 派发层历史写死的取值（`not_in_time` / `daily_limit` / `class_in_session` …）
            全部**原样保留**，仅改为引用常量，线上 payload 逐字节不变；
          - `canonicalize` 只处理**语义等价**的历史别名（如 `user_blacklisted`
            → `blacklisted`），对 `not_in_time` / `not_in_time_window` 这类
            **跨层异义**取值不做合并；
          - 若确实发生了别名改写，把原值放进 `legacy_reason`，旧下游零破坏。
          - G1：payload 新增 `device_id`（下行定向校验字段，缺省不输出，零破坏性）。
          - G2：若携带 `msg_id`，下发后把本次结果写入 `ProcessedMessage`，供
            重复上行原样重发、避免二次扣分。
        """
        topic = f"phonebox/unlock/{box_id}"
        canonical = canonicalize(reason)
        payload = {
            "result": "true" if success else "false",
            "reason": canonical,
            "current_score": score,
        }
        # G1：新固件 v1.6.0+ 校验下行 device_id；旧设备/查询缺省不输出该字段（零破坏）。
        if device_id is not None:
            payload["device_id"] = device_id
        if canonical != reason:
            payload["legacy_reason"] = reason
        _shared.publish_mqtt(topic, json.dumps(payload))

        # G2：携带 msg_id 时缓存本次结果（仅 successful/failed 原文），重复上行直接重发。
        if msg_id:
            self._mark_unlock_processed(box_id, success, canonical, score, device_id, msg_id)

    def _get_user_by_card_id(self, card_id):
        from models import User

        user = _shared.mqtt_manager.get_cached_user(card_id)
        if not user:
            user = User.query.filter_by(card_id=card_id).first()
            if user:
                _shared.mqtt_manager.set_cached_user(card_id, user)
        return user

    @ensure_app_context
    def handle_query_message(self, data):
        box_id = data.get("box_id", "A")
        card_id = data.get("card_id")
        # G1：下行补 device_id（新固件 v1.6.0+ 定向校验；缺省不输出）
        device_id = data.get("device_id") or data.get("client_id")

        if not card_id:
            self.publish_unlock_result(box_id, False, UnlockReason.CARD_NOT_FOUND, device_id=device_id)
            return

        user = self._get_user_by_card_id(card_id)

        if not user:
            self.publish_unlock_result(box_id, False, UnlockReason.CARD_NOT_FOUND, device_id=device_id)
        else:
            self.publish_unlock_result(
                box_id, True, UnlockReason.QUERY_OK, user.current_score, device_id=device_id
            )

    @ensure_app_context
    def handle_unlock_message(self, data):
        # 防御性守卫：下行结果报文（含 result 字段）被本端或其它后端实例回环接收时直接忽略，
        # 避免与 phonebox/unlock/# 订阅形成自循环。no_local 已在订阅层阻断本端回环，
        # 此处作为跨实例/异常回环的兜底，零契约变更（上行开锁请求不含 result 字段）。
        if not isinstance(data, dict) or "result" in data:
            return
        box_id = data.get("box_id", "A")
        card_id = data.get("card_id")
        # G1：下行补 device_id（新固件 v1.6.0+ 定向校验；缺省不输出）
        device_id = data.get("device_id") or data.get("client_id")
        # G2：提取 msg_id 用于幂等去重
        msg_id = data.get("msg_id")

        # G2：带 msg_id 的重复上行（QoS1 重投/设备重试）直接重发缓存结果，避免二次扣分。
        # 旧设备 msg_id 为空 → 跳过去重，保持历史行为。
        if msg_id:
            unlock_key = f"unlock:{msg_id}"
            if self._resend_cached_unlock(unlock_key, box_id):
                return

        # G8：强制使用服务器时钟判定时段门禁，忽略设备上行的 hour/minute（防篡改绕过）。
        # 保留 _build_policy_check_time 的 None→服务器时钟分支语义。
        now = _shared.datetime.now()
        hour = now.hour
        minute = now.minute

        if not card_id:
            self.publish_unlock_result(box_id, False, UnlockReason.CARD_NOT_FOUND, device_id=device_id, msg_id=msg_id)
            return

        user = self._get_user_by_card_id(card_id)
        if not user:
            self.publish_unlock_result(box_id, False, UnlockReason.CARD_NOT_FOUND, device_id=device_id, msg_id=msg_id)
            return

        if self._apply_teacher_unlock_policy(box_id, card_id, user, hour, minute, device_id, msg_id):
            return

        # 全局 TimeRule 时段门禁（保留原有逻辑：allow_unlock 窗口外一律拒绝）
        # 差异 #17：此处下发 `not_in_time`（全局规则语义），与判定层的
        # `not_in_time_window` 是不同层不同语义，**不可互换**（设备端已按前者匹配）。
        if not self.check_time_valid(box_id, hour, minute):
            self.publish_unlock_result(box_id, False, UnlockReason.NOT_IN_TIME, device_id=device_id, msg_id=msg_id)
            return

        # 新增：按班级课表反查，上课 / 自习时间禁止学生自助开箱（硬拦截，无 force_send）
        if self._blocked_by_class_schedule(box_id, card_id, user, hour, minute, device_id, msg_id):
            return

        # 积分门槛与扣减统一由 _deduct_and_unlock 处理（内部已含 <60 → score_low），
        # 与班主任策略放行路径共用同一出口，避免两处判断漂移。
        self._deduct_and_unlock(box_id, user, card_id, device_id=device_id, msg_id=msg_id)

    def _apply_teacher_unlock_policy(self, box_id, card_id, user, hour, minute, device_id=None, msg_id=None):
        """班主任自助开箱策略判定（优先级高于全局 TimeRule 与上课硬拦截）。

        返回 True 表示已处理（已下发结果，调用方应直接 return）；
        返回 False 表示无策略/未命中/判定异常，调用方回退到原有全局+课表逻辑（DEFER）。
        """
        try:
            class_info_id = getattr(user, "class_info_id", None)
            check_time = _build_policy_check_time(hour, minute)
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
                    self.publish_unlock_result(box_id, False, UnlockReason.TEACHER_DISABLED, device_id=device_id, msg_id=msg_id)
                    return True
                if decision in (POLICY_ALLOW_OVERRIDE, POLICY_ALLOW_WINDOW):
                    reason_code, reason_msg = _teacher_policy_reason(decision)
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
                    self._deduct_and_unlock(box_id, user, card_id, device_id=device_id, msg_id=msg_id)
                    return True
        except Exception as e:
            # 策略判定异常不影响主流程，回退到原有全局门禁逻辑
            log_warning(f"[Unlock] 班主任策略判定异常，回退全局逻辑: {e}", exception=e)
        return False

    def _blocked_by_class_schedule(self, box_id, card_id, user, hour, minute, device_id=None, msg_id=None):
        """按班级课表反查：上课 / 自习时间禁止学生自助开箱（硬拦截，无 force_send）。

        返回 True 表示已下发拒绝结果（调用方应直接 return）；
        课表反查异常不影响主流程（全局门禁已校验），默认放行。
        """
        try:
            class_info_id = getattr(user, "class_info_id", None)
            if class_info_id:
                check_time = _build_policy_check_time(hour, minute)
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
                    self.publish_unlock_result(box_id, False, UnlockReason.CLASS_IN_SESSION, device_id=device_id, msg_id=msg_id)
                    return True
        except Exception as e:
            # 课表反查异常不影响主流程（全局门禁已校验），默认放行
            log_warning(f"[Unlock] 课表反查异常，放行: {e}", exception=e)
        return False

    def _deduct_and_unlock(self, box_id, user, card_id, device_id=None, msg_id=None):
        """学生自助开箱统一出口：限额/黑名单/分数门槛校验（R2 统一 UnlockValidator）→ 扣分记账 → 下发开箱成功结果。

        供原路径（全局门禁/课表通过）与班主任策略放行路径共用。
        skip_time_window=True：时段已由调用方校验（全局 TimeRule / 班主任策略），避免双重时段拦截。
        device_id / msg_id：G1 下行定向 + G2 幂等缓存透传。
        """
        from services.unlock_validator import UnlockValidator

        allowed, reason, info = UnlockValidator.validate_unlock(card_id, skip_time_window=True)
        if not allowed:
            self.publish_unlock_result(box_id, False, reason, user.current_score, device_id=device_id, msg_id=msg_id)
            return
        # R2: 统一记账（扣 10 分 + 日/周计数 + 流水"开锁扣分"），内部 commit
        UnlockValidator.record_unlock(user)

        _shared.mqtt_manager.set_cached_user(card_id, user)
        self.publish_unlock_result(box_id, True, UnlockReason.SCORE_OK, user.current_score, device_id=device_id, msg_id=msg_id)

    def _resend_cached_unlock(self, key, box_id):
        """重复 msg_id：重发首次缓存的开锁结果，不再扣分；无缓存返回 False。"""
        rec = self._find_processed(key)
        if not rec or rec.success is None:
            return False
        self.publish_unlock_result(
            box_id,
            rec.success,
            rec.result_reason,
            rec.new_score,
            device_id=rec.client_id,
            msg_id=None,
        )
        return True

    def _mark_unlock_processed(self, box_id, success, reason, score, device_id, msg_id):
        """首次处理成功后写回开锁结果，供重复上行原样重发（失败不阻断主流程）。"""
        key = f"unlock:{msg_id}"
        if not key:
            return
        try:
            from models import ProcessedMessage

            db.session.add(
                ProcessedMessage(
                    message_id=key,
                    record_id=None,
                    new_score=score,
                    client_id=device_id,
                    success=bool(success),
                    result_reason=reason,
                )
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            log_warning(f"[unlock] 幂等记录写入失败（已回滚）: {e}")
