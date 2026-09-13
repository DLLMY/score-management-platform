# -*- coding: utf-8 -*-
"""开锁原因码统一常量表（差异 #17）。

背景：开锁链路历史上存在**两套命名**，同一语义在不同层叫法不同，设备端与前端的
包含匹配（substring）逻辑容易踩空：

    语义                    校验层 validate_unlock        派发层 publish_unlock_result
    ----------------------  ----------------------------  --------------------------
    成功                     "ok"                          "score_ok" / "query_ok"
    分数不足                 "score_low"                   "score_low"
    周限额                   "weekly_limit_exceeded"       （未下发）
    日限额                   "daily_limit_exceeded"        "daily_limit"      ← 不一致
    不在时段                 "not_in_time_window"          "not_in_time"      ← 不一致
    上课中                   （未覆盖）                     "class_in_session"
    班主任关闭               （未覆盖）                     "teacher_disabled"

统一方案：以本模块常量为**唯一命名来源**，两套调用方均引用常量。

**命名冻结口径（零破坏性变更，关键）**：
本模块**不重命名任何既有线上取值**，而是把历史上散落两处的字面量收拢为常量。
两处「同名不同层」的取值继续**并存且保持原样**：

    - `not_in_time`        → 派发层（全局 TimeRule 未命中），设备已按此值匹配
    - `not_in_time_window` → 判定层（validate_unlock 返回），前端已按此值映射

二者语义**不同**（前者=全局时段规则、后者=判定层时段结论），
**不是彼此的别名**，因此不做 `LEGACY_ALIASES` 合并 —— 合并会把两种语义
压成一个值，使设备端/前端无法区分，属于破坏性变更。
（06 文档方案 A 的枚举清单同样把两者列为独立常量。）

成功类原因码同理并存：`ok`（判定层）/ `score_ok` / `query_ok`（派发层）。
"""


class UnlockReason:
    """开锁原因码（唯一命名来源，设备侧契约，禁止随意改名）。"""

    # --- 成功 ---
    OK = "ok"
    SUCCESS = "success"
    SCORE_OK = "score_ok"
    QUERY_OK = "query_ok"
    MANUAL = "manual"

    # --- 资格类（validate_unlock 产生）---
    CARD_NOT_FOUND = "card_not_found"
    USER_INACTIVE = "user_inactive"
    # 判定层历史上分别返回两个黑名单原因码（普通/永久），前端已按此区分，保留原值。
    USER_BLACKLISTED = "user_blacklisted"
    USER_PERMANENTLY_BLACKLISTED = "user_permanently_blacklisted"
    SCORE_LOW = "score_low"
    WEEKLY_LIMIT_EXCEEDED = "weekly_limit_exceeded"
    DAILY_LIMIT_EXCEEDED = "daily_limit_exceeded"
    NOT_IN_TIME_WINDOW = "not_in_time_window"

    # --- 环境/策略类（派发层产生）---
    NOT_IN_TIME = "not_in_time"
    CLASS_IN_SESSION = "class_in_session"
    TEACHER_DISABLED = "teacher_disabled"

    # --- 设备/卡号异常 ---
    NO_CARD_ID = "no_card_id"


# 历史别名 → 规范名。**必须语义等价**才入表；当前为空集。
#
# 明确**不入表**的几组（语义不等价，合并即破坏性变更）：
#   not_in_time        ≠ not_in_time_window   不同层：全局 TimeRule vs 判定层结论
#   daily_limit        ≠ daily_limit_exceeded 历史派发层简写，且已不再使用
#   weekly_limit       ≠ weekly_limit_exceeded  同上
#   user_blacklisted   ≠ user_permanently_blacklisted  前端按两者区分展示/处理
#
# 保留该表是为了给未来真正等价的别名一个落点（`canonicalize` 契约不变）。
LEGACY_ALIASES = {}

# 全部规范原因码集合（供校验/文档生成）
ALL_REASONS = frozenset(
    value
    for name, value in vars(UnlockReason).items()
    if not name.startswith("_") and isinstance(value, str)
)


def canonicalize(reason):
    """把历史别名映射为规范名；未知值原样返回（不抛异常、不清空）。

    ⚠️ 本函数**不做跨语义合并**。以下取值各自原样返回，因为它们是不同层 / 不同
    语义的独立取值，合并会破坏下游（前端 / 设备端 / 日志）的区分能力：

        not_in_time          → 原样（派发层：全局 TimeRule 未命中）
        not_in_time_window   → 原样（判定层：时段结论）
        user_blacklisted     → 原样（普通黑名单）
        user_permanently_blacklisted → 原样（永久黑名单）

    >>> canonicalize("score_low")
    'score_low'
    >>> canonicalize("not_in_time")
    'not_in_time'
    >>> canonicalize("not_in_time_window")
    'not_in_time_window'
    """
    if not reason:
        return reason
    return LEGACY_ALIASES.get(reason, reason)


def is_failure(reason):
    """判断原因码是否代表开锁失败（成功码之外一律视为失败）。"""
    return reason not in (
        None,
        "",
        UnlockReason.OK,
        UnlockReason.SUCCESS,
        UnlockReason.SCORE_OK,
        UnlockReason.QUERY_OK,
        UnlockReason.MANUAL,
    )
