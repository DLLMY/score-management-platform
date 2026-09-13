# -*- coding: utf-8 -*-
"""设备认证凭证体系（差异 #4，分阶段落地，全程向后兼容）。

差异背景
--------
历史上 `device_id` 是**唯一身份**：无密钥、无签名、可枚举，且
`_process_heartbeat` / `_process_ota_register` 是「上报即注册」——任何人
构造一个心跳即可凭空创建设备。

本模块按 06 差异文档的三阶段方案落地，**每阶段都可通过开关回退**：

    阶段 1  白名单开关：默认关闭 ⇒ 现行为零变化；开启后拒绝未登记设备自动注册。
    阶段 2  设备密钥 + HMAC 签名：`Device.device_secret` 为 None 时**直接放行**
            （灰度兼容），仅对已发放密钥的设备强制验签。
    阶段 3  密钥下发（后台生成 / 导出烧录）—— 见 `issue_device_secret`。

设计约束（用户要求：零破坏性变更）
----------------------------------
- 阶段 1 开关默认 **关闭**：不改变任何现有部署的行为。
- 阶段 2 校验对「无密钥设备」恒返回通过：存量设备不受影响。
- 校验逻辑只读，不落库、不抛异常（返回 (bool, reason) 元组）。
"""

import hashlib
import hmac
import json
import logging
import secrets
import time

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 阶段 1：白名单开关
# ---------------------------------------------------------------------------

# SystemConfig 是单例表（无 key/value 结构），故白名单开关作为其一个布尔列存在。
_SYSTEM_CONFIG_FLAG = "device_whitelist_enabled"

# 进程内缓存，避免每条心跳都查库（MQTT 心跳频率高）。
# 值为 (flag_value, expire_monotonic)。TTL 内直接复用。
_FLAG_CACHE = {"value": None, "expire": 0.0}
_FLAG_TTL_SEC = 10.0


def is_device_whitelist_enabled() -> bool:
    """设备白名单开关是否开启（差异 #4 阶段 1）。

    **默认 False** —— 未配置 / 读取失败一律视为关闭，保证现行为零变化。
    """
    now = time.monotonic()
    if _FLAG_CACHE["value"] is not None and now < _FLAG_CACHE["expire"]:
        return bool(_FLAG_CACHE["value"])

    value = False
    try:
        from models import SystemConfig

        config = SystemConfig.query.first()
        if config is not None:
            value = bool(getattr(config, _SYSTEM_CONFIG_FLAG, False))
    except Exception as exc:  # pragma: no cover - 防御性：任何异常都按「关闭」处理
        logger.debug(f"[设备认证] 白名单开关读取失败，按关闭处理: {exc}")
        value = False

    _FLAG_CACHE["value"] = value
    _FLAG_CACHE["expire"] = now + _FLAG_TTL_SEC
    return value


def reset_whitelist_flag_cache():
    """清空白名单开关缓存（测试 / 配置变更后调用）。"""
    _FLAG_CACHE["value"] = None
    _FLAG_CACHE["expire"] = 0.0


def should_register_unknown_device() -> bool:
    """遇到未登记设备时，是否允许「上报即注册」。

    白名单开启 ⇒ 拒绝自动注册；关闭（默认）⇒ 保持历史行为（允许）。
    """
    return not is_device_whitelist_enabled()


# ---------------------------------------------------------------------------
# 阶段 2：设备密钥 + HMAC 签名
# ---------------------------------------------------------------------------

# 允许的时间偏差（秒）。设备与服务端时钟不同步时留出余量。
DEVICE_SIGNATURE_MAX_SKEW_SEC = 300

# 参与签名时需从 payload 中剔除的字段（签名自身的载体）
_SIGNATURE_EXCLUDED_FIELDS = frozenset({"sig", "nonce"})


def build_signature_message(device_id: str, ts, nonce: str, payload: dict) -> str:
    """构造待签名字符串（设备侧必须使用完全相同的拼接方式）。

    格式：``{device_id}|{ts}|{nonce}|{payload_json_sorted}``

    `ts` 与 `sig` 本身也会从 payload 中剔除后再序列化，避免自引用。
    """
    signed_payload = {
        k: v
        for k, v in payload.items()
        if k not in _SIGNATURE_EXCLUDED_FIELDS and k != "ts"
    }
    payload_json = json.dumps(signed_payload, sort_keys=True, separators=(",", ":"))
    return f"{device_id}|{ts}|{nonce}|{payload_json}"


def compute_signature(secret: str, device_id: str, ts, nonce: str, payload: dict) -> str:
    """计算 HMAC-SHA256 签名（hex）。设备侧与后端共用同一实现。"""
    message = build_signature_message(device_id, ts, nonce, payload)
    return hmac.new(
        secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def verify_device_signature(device, data: dict, now_ts=None) -> tuple:
    """校验设备上行签名。返回 ``(通过, 原因)``。

    宽容策略（差异 #4 阶段 2 的核心，保证灰度期零破坏）：
      - ``device.device_secret`` 为 None/空 ⇒ **直接通过**（`no_secret_configured`），
        存量设备与未发放密钥的设备完全不受影响；
      - 已发放密钥 ⇒ 必须携带 `ts` / `nonce` / `sig`，且时间窗口内签名匹配。

    参数:
        device: Device 实例（可为 None，此时按未登记设备处理）
        data:   上行 payload（dict）
        now_ts: 当前时间戳（测试可注入）
    """
    secret = getattr(device, "device_secret", None) if device is not None else None
    if not secret:
        return True, "no_secret_configured"

    if not isinstance(data, dict):
        return False, "payload_not_dict"

    ts = data.get("ts")
    nonce = data.get("nonce")
    sig = data.get("sig")
    if ts is None or not nonce or not sig:
        return False, "missing_signature_fields"

    try:
        ts_int = int(ts)
    except (TypeError, ValueError):
        return False, "invalid_timestamp"

    current = int(time.time() if now_ts is None else now_ts)
    if abs(current - ts_int) > DEVICE_SIGNATURE_MAX_SKEW_SEC:
        return False, "timestamp_out_of_window"

    device_id = getattr(device, "device_id", None) or data.get("device_id") or ""
    expected = compute_signature(secret, device_id, ts, nonce, data)
    if not hmac.compare_digest(expected, str(sig)):
        return False, "signature_mismatch"

    return True, "ok"


def verify_device_signature_for_id(device_id, data, now_ts=None) -> tuple:
    """按 device_id 查库后验签（供路由层便捷调用）。

    未登记设备 ⇒ 按 `no_secret_configured` 放行（阶段 1 开关才是拦未登记设备的地方，
    本函数只负责「已登记设备是否带对签名」）。
    """
    try:
        from models import Device

        device = Device.query.filter_by(device_id=device_id).first()
    except Exception as exc:  # pragma: no cover - 查询异常不应阻断业务
        logger.warning(f"[设备认证] 验签查库失败，按放行处理: {exc}")
        return True, "lookup_failed"
    return verify_device_signature(device, data, now_ts=now_ts)


# ---------------------------------------------------------------------------
# 阶段 3：密钥下发
# ---------------------------------------------------------------------------


def issue_device_secret(device, length: int = 64, commit: bool = True) -> str:
    """为设备生成并落库新密钥（阶段 3）。返回密钥明文（仅此一次可见）。

    `secrets.token_hex(32)` ⇒ 64 个十六进制字符，正好匹配 String(64) 列宽。
    调用方负责把明文导出给设备烧录（NVS），此后后端只存密文原值
    （HMAC 场景下密钥必须可读，故不做哈希）。
    """
    from models import db
    from datetime import datetime as _dt

    secret = secrets.token_hex(length // 2)
    device.device_secret = secret
    device.secret_issued_at = _dt.now()
    if commit:
        db.session.commit()
    return secret


def mark_device_seen(device, now_ts=None, commit: bool = True):
    """记录设备最近上行时间戳（防重放基线，阶段 2）。

    `last_seen_ts` 用于后续实现「时间戳单调递增」的强防重放；
    当前实现只做记录（不拒绝回退时间戳），以免设备时钟回拨导致误封。
    """
    from models import db

    ts = int(time.time() if now_ts is None else now_ts)
    device.last_seen_ts = ts
    if commit:
        db.session.commit()
    return ts
