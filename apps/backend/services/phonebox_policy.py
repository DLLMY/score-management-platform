"""班主任手机箱自助开箱策略服务。

与「上课时间下发互斥」的区别：
  - 全局 TimeRule / 课表反查 是「全校级、硬拦截、学生无 override」。
  - 班主任策略是「按班级、由班主任自由决定」：班主任可开/关本班自助开箱总开关、
    预设允许时段、或一键临时放行（含上课期间）。

判定优先级（evaluate）：
  1. 一键放行 override_until > now      -> ALLOW_OVERRIDE（最高优先，可越过上课硬拦截）
  2. 当前时间在预设时段 unlock_windows   -> ALLOW_WINDOW
  3. 策略存在但 allow_self_unlock=False  -> BLOCK（班主任已关闭本班自助开箱）
  4. 无策略 / 不在时段 / 未放行          -> DEFER（交给现有全局 TimeRule + 课表反查逻辑）

注意：ALLOW_* 会**跳过**后续的全局 TimeRule 与上课硬拦截，直接进入积分扣减；
DEFER 时维持原行为不变，因此未配置策略的班级完全无感。
"""

from datetime import datetime, timedelta
from models import PhoneBoxPolicy, db

# 判定结果常量
POLICY_ALLOW_OVERRIDE = "allow_override"
POLICY_ALLOW_WINDOW = "allow_window"
POLICY_BLOCK = "block"
POLICY_DEFER = "defer"


def get_policy(class_info_id):
    """读取某班的手机箱策略（不存在返回 None）。"""
    if not class_info_id:
        return None
    return PhoneBoxPolicy.query.filter_by(class_info_id=class_info_id).first()


def normalize_windows(windows):
    """校验并归一化预设时段列表。

    统一存储格式为 {"day":int, "start_hour":int, "start_minute":int,
                   "end_hour":int, "end_minute":int}。
    同时兼容 {"day":-1, "start":"12:00", "end":"12:30"} 这种字符串写法，
    避免调用方传了「看起来对」但服务层读不到的字段而静默失效
    （时段存进去了却永远不命中）。

    Returns:
        (normalized_list, error_message or None)
    """
    if windows is None:
        return None, None
    if not isinstance(windows, list):
        return None, "unlock_windows 必须是数组"

    def _parse_hm(item, prefix):
        """返回 (hour, minute, err)。prefix 为 'start' / 'end'。"""
        hour_key, min_key = f"{prefix}_hour", f"{prefix}_minute"
        if hour_key in item or min_key in item:
            try:
                return int(item.get(hour_key, 0)), int(item.get(min_key, 0)), None
            except (TypeError, ValueError):
                return None, None, f"{hour_key}/{min_key} 必须是整数"
        # 兼容 "HH:MM" 字符串
        raw = item.get(prefix)
        if isinstance(raw, str) and ":" in raw:
            try:
                h, m = raw.split(":")[:2]
                return int(h), int(m), None
            except (TypeError, ValueError):
                return None, None, f"{prefix} 格式应为 HH:MM"
        return None, None, f"缺少 {hour_key}/{min_key}（或 {prefix}='HH:MM'）"

    normalized = []
    for idx, item in enumerate(windows):
        if not isinstance(item, dict):
            return None, f"第 {idx + 1} 个时段格式错误，应为对象"
        try:
            day = int(item.get("day", -1))
        except (TypeError, ValueError):
            return None, f"第 {idx + 1} 个时段 day 必须是整数"
        if day != -1 and not (0 <= day <= 6):
            return None, f"第 {idx + 1} 个时段 day 应为 -1(每天) 或 0~6"

        sh, sm, err = _parse_hm(item, "start")
        if err:
            return None, f"第 {idx + 1} 个时段：{err}"
        eh, em, err = _parse_hm(item, "end")
        if err:
            return None, f"第 {idx + 1} 个时段：{err}"

        for label, h, m in (("开始", sh, sm), ("结束", eh, em)):
            if not (0 <= h <= 23):
                return None, f"第 {idx + 1} 个时段{label}小时应在 0~23"
            if not (0 <= m <= 59):
                return None, f"第 {idx + 1} 个时段{label}分钟应在 0~59"

        if (sh, sm) > (eh, em):
            return None, f"第 {idx + 1} 个时段的结束时间不能早于开始时间"

        normalized.append(
            {
                "day": day,
                "start_hour": sh,
                "start_minute": sm,
                "end_hour": eh,
                "end_minute": em,
            }
        )
    return normalized, None


def _now_in_windows(windows, now):
    """判断 now 是否落在任一预设时段内。

    windows 形如 [{"day":-1,"start_hour":10,"start_minute":0,
                   "end_hour":10,"end_minute":20}, ...]
    day=-1 表示每天；0~6 表示周一~周日。
    """
    if not windows:
        return False
    wd = now.weekday()
    t = now.time()
    for w in windows:
        day = w.get("day", -1)
        if day != -1 and day != wd:
            continue
        start = t.replace(
            hour=int(w.get("start_hour", 0)),
            minute=int(w.get("start_minute", 0)),
            second=0,
            microsecond=0,
        )
        end = t.replace(
            hour=int(w.get("end_hour", 0)),
            minute=int(w.get("end_minute", 0)),
            second=0,
            microsecond=0,
        )
        if start <= t <= end:
            return True
    return False


def evaluate(class_info_id, check_time=None):
    """评估某班学生此刻能否自助开箱。

    Returns:
        dict: {"decision", "reason", "policy_id"(可选), "override_until"(可选)}
    """
    if not class_info_id:
        return {"decision": POLICY_DEFER, "reason": "no_class"}

    policy = get_policy(class_info_id)
    if policy is None:
        return {"decision": POLICY_DEFER, "reason": "no_policy"}

    now = check_time or datetime.now()

    if policy.override_until and policy.override_until > now:
        return {
            "decision": POLICY_ALLOW_OVERRIDE,
            "reason": "override",
            "policy_id": policy.id,
            "override_until": policy.override_until.isoformat(),
        }

    if not policy.allow_self_unlock:
        return {
            "decision": POLICY_BLOCK,
            "reason": "teacher_disabled",
            "policy_id": policy.id,
        }

    if _now_in_windows(policy.unlock_windows, now):
        return {
            "decision": POLICY_ALLOW_WINDOW,
            "reason": "window",
            "policy_id": policy.id,
        }

    return {"decision": POLICY_DEFER, "reason": "no_match", "policy_id": policy.id}


def set_policy(
    class_info_id,
    allow_self_unlock=None,
    unlock_windows=None,
    updated_by=None,
):
    """新增或更新某班策略。返回 PhoneBoxPolicy。"""
    policy = get_policy(class_info_id)
    if policy is None:
        policy = PhoneBoxPolicy(class_info_id=class_info_id)
        db.session.add(policy)

    if allow_self_unlock is not None:
        policy.allow_self_unlock = bool(allow_self_unlock)
    if unlock_windows is not None:
        normalized, err = normalize_windows(unlock_windows)
        if err:
            raise ValueError(err)
        policy.unlock_windows = normalized
    policy.updated_by = updated_by
    policy.updated_at = datetime.now()
    db.session.commit()
    return policy


def one_click_allow(class_info_id, minutes, updated_by=None):
    """一键临时放行：将 override_until 设为 now + minutes。返回 PhoneBoxPolicy。"""
    minutes = int(minutes)
    if minutes <= 0:
        raise ValueError("minutes 必须为正整数")
    policy = get_policy(class_info_id)
    if policy is None:
        policy = PhoneBoxPolicy(class_info_id=class_info_id)
        db.session.add(policy)
    policy.override_until = datetime.now() + timedelta(minutes=minutes)
    policy.updated_by = updated_by
    policy.updated_at = datetime.now()
    db.session.commit()
    return policy


def cancel_override(class_info_id, updated_by=None):
    """取消一键临时放行（override_until 置空）。返回 PhoneBoxPolicy。"""
    policy = get_policy(class_info_id)
    if policy is None:
        return None
    policy.override_until = None
    policy.updated_by = updated_by
    policy.updated_at = datetime.now()
    db.session.commit()
    return policy
