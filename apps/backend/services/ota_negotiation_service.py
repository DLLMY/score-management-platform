"""
OTA 版本协商 + 自动推送服务

职责：
- 设备上报当前版本（register / heartbeat）后，与最新 active 固件做语义化版本比较；
- 若设备版本落后且可自动升级，则带抖动地（避免设备同时拉取造成带宽海啸）向
  phonebox/ota/{device_id} 下发 OTA 升级指令，形成「上报 → 协商 → 自动推送」无缝闭环。

配置（环境变量，均可选）：
- OTA_AUTO_PUSH_ENABLED      全局自动推送开关，默认 true
- OTA_PUSH_COOLDOWN_SEC      同设备最短重推间隔（秒），默认 600
- OTA_ROLLOUT_JITTER_SEC     滚动发布抖动上限（秒），默认 30，用于错峰
- OTA_FIRMWARE_BASE_URL      公网可访问的后端基础 URL（如 https://phonebox.example.com），
                             用于生成设备可直连的绝对下载地址；未配置则 MQTT 自动推送中止
                             （避免下发相对路径导致设备无法下载）。
"""

import os
import re
import hmac
import hashlib
import random
import threading
import logging
import math
from datetime import datetime

logger = logging.getLogger(__name__)
from config import config

_ota_cfg = config.get_ota_config()  # #196 T8: OTA 配置统一收口到 Config

# ---- 配置（env 可覆盖）----
OTA_AUTO_PUSH_ENABLED = _ota_cfg["OTA_AUTO_PUSH_ENABLED"]
OTA_PUSH_COOLDOWN_SEC = _ota_cfg["OTA_PUSH_COOLDOWN_SEC"]
OTA_ROLLOUT_JITTER_SEC = _ota_cfg["OTA_ROLLOUT_JITTER_SEC"]
OTA_FIRMWARE_BASE_URL = _ota_cfg["OTA_FIRMWARE_BASE_URL"]

# P2：静默时段（上课时段 + 夜间/自定义窗口），静默期内不自动推送 OTA
OTA_RESPECT_CLASS_TIME = _ota_cfg["OTA_RESPECT_CLASS_TIME"]
# 逗号分隔的本地时间窗口，支持跨午夜，如 "22:00-06:00,12:00-13:00"
OTA_QUIET_WINDOWS = _ota_cfg["OTA_QUIET_WINDOWS"]

# P2：灰度/分批推送
OTA_STAGED_ROLLOUT = _ota_cfg["OTA_STAGED_ROLLOUT"]
OTA_STAGE_PERCENT = _ota_cfg["OTA_STAGE_PERCENT"]
OTA_STAGE_BATCH_SIZE = _ota_cfg["OTA_STAGE_BATCH_SIZE"]
OTA_STAGE_BATCH_INTERVAL_SEC = _ota_cfg["OTA_STAGE_BATCH_INTERVAL_SEC"]

# P2：指令签名（HMAC-SHA256），防止伪造 MQTT Broker 下发假 OTA 指令；
# 设备侧需编译相同密钥（OTA_SIGNING_SECRET）才能校验通过。
OTA_SIGNING_SECRET = _ota_cfg["OTA_SIGNING_SECRET"]

# device_id -> threading.Timer，避免同一设备被重复调度
_ota_timers = {}


# 差异 #1/#12：设备类型归一化。设备未上报 device_type 时按 'phonebox' 处理，
# 与 FirmwareVersion.device_type 的 server_default 保持一致，保证历史数据可用。
DEFAULT_DEVICE_TYPE = "phonebox"


def normalize_device_type(device_type):
    """把设备/固件的 device_type 归一化为可比较的字符串（None/空 → 'phonebox'）。"""
    if device_type is None:
        return DEFAULT_DEVICE_TYPE
    text = str(device_type).strip()
    return text or DEFAULT_DEVICE_TYPE


def compare_versions(v1, v2):
    """语义化版本比较，返回 1 / -1 / 0。支持 '2.10' > '2.9'。

    非数字片段按 0 处理；长度不齐时短侧补 0。
    差异 #9：本函数是全局唯一的版本比较实现，统一容忍以下输入形态，
    避免调用方各自实现（历史上 firmware_routes 另有一份 int() 抛 ValueError → 500）：
      - None / 空串 → 视为最小版本（全部片段 0）
      - 'v1.2.3' 前缀 v/V → 先剥离
      - '1.2.3-beta.1' 后缀 → 仅取 '-' 前的版本主体
      - 非数字片段 → 按 0 处理（不抛异常）
    """

    def parse(v):
        if v is None:
            return [0]
        text = str(v).strip()
        if not text:
            return [0]
        # 剥离 v/V 前缀与 -build/-beta 等后缀
        if text[:1] in ("v", "V"):
            text = text[1:]
        text = text.split("-", 1)[0].split("+", 1)[0]
        parts = []
        for x in text.split("."):
            try:
                parts.append(int(x))
            except ValueError:
                parts.append(0)
        return parts or [0]

    a, b = parse(v1), parse(v2)
    for i in range(max(len(a), len(b))):
        p1 = a[i] if i < len(a) else 0
        p2 = b[i] if i < len(b) else 0
        if p1 != p2:
            return 1 if p1 > p2 else -1
    return 0


def get_latest_active_firmware(device_type=None):
    """返回指定设备类型的最新 active 固件（按 created_at 倒序）。无则返回 None。

    差异 #1：新增 device_type 维度过滤，根治「取全局最新 active」导致
    doorlock 等新设备类型接入后被误推 phonebox 固件的问题。

    向后兼容：
      - 不传 device_type（None）→ 保持历史行为：跨类型取全局最新 active。
        这保证既有调用方（未适配的代码路径、第三方脚本）行为零漂移。
      - 传入 device_type → 仅匹配该类型；但若该类型下无固件，回退到
        'phonebox' 类型查询（历史固件 device_type 均为 phonebox），
        避免存量部署因未补数据而彻底查不到固件。
    """
    from models import FirmwareVersion

    if device_type is None:
        return (
            FirmwareVersion.query.filter(FirmwareVersion.is_active)
            .order_by(FirmwareVersion.created_at.desc())
            .first()
        )

    wanted = normalize_device_type(device_type)
    latest = (
        FirmwareVersion.query.filter(
            FirmwareVersion.is_active,
            FirmwareVersion.device_type == wanted,
        )
        .order_by(FirmwareVersion.created_at.desc())
        .first()
    )
    if latest is not None:
        return latest

    # 该类型无固件 → 回退 phonebox（存量数据兼容），仅当查询类型非 phonebox 时
    if wanted != DEFAULT_DEVICE_TYPE:
        return (
            FirmwareVersion.query.filter(
                FirmwareVersion.is_active,
                FirmwareVersion.device_type == DEFAULT_DEVICE_TYPE,
            )
            .order_by(FirmwareVersion.created_at.desc())
            .first()
        )
    return None


# 差异 #6：固件下载 URL 时效签名。默认 3600 秒，0 表示不生成 token（仅当显式配置为 0）。
OTA_DOWNLOAD_URL_TTL_SEC = _ota_cfg["OTA_DOWNLOAD_URL_TTL_SEC"]


def _download_token(firmware, expires_at):
    """生成下载令牌：HMAC_SHA256(OTA_SIGNING_SECRET, "{id}:{expires_at}")。

    未配置 OTA_SIGNING_SECRET 时返回空串（保持匿名下载，向后兼容）。
    """
    if not OTA_SIGNING_SECRET:
        return ""
    msg = f"{firmware.id}:{expires_at}"
    return hmac.new(
        OTA_SIGNING_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_download_token(firmware_id, expires_at, token):
    """校验下载令牌。返回 True 表示通过。

    未配置 OTA_SIGNING_SECRET 时**始终返回 True**（不启用验签，保持匿名下载），
    这样存量部署升级后行为零变化，需显式配置密钥才启用强制验签。
    """
    if not OTA_SIGNING_SECRET:
        return True
    if not token or not expires_at:
        return False
    try:
        exp = int(expires_at)
    except (TypeError, ValueError):
        return False
    if exp < int(datetime.now().timestamp()):
        return False
    expected = hmac.new(
        OTA_SIGNING_SECRET.encode("utf-8"),
        f"{firmware_id}:{exp}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, str(token))


def build_download_url(firmware, request=None, with_token=None):
    """返回固件绝对下载 URL。

    MQTT 线程无 request 对象，使用 OTA_FIRMWARE_BASE_URL；
    REST 调用可传 request 使用 host_url。二者皆无则回退相对路径
    （仅当设备侧已知主机时可用，自动推送会因此中止）。

    差异 #6：配置了 OTA_SIGNING_SECRET 时，URL 自动附带 expire + token 查询参数，
    使下载端点可校验来源与时效。未配置密钥时 URL 形态与历史完全一致
    （不带任何查询参数），保证存量设备与存量契约零漂移。
    with_token 可显式覆盖（True/False），便于灰度与测试。
    """
    rel = f"/api/firmware/download/{firmware.id}"

    use_token = with_token
    if use_token is None:
        use_token = bool(OTA_SIGNING_SECRET) and OTA_DOWNLOAD_URL_TTL_SEC > 0

    if use_token:
        expires_at = int(datetime.now().timestamp()) + OTA_DOWNLOAD_URL_TTL_SEC
        token = _download_token(firmware, expires_at)
        if token:
            rel = f"{rel}?expire={expires_at}&token={token}"

    if OTA_FIRMWARE_BASE_URL:
        return f"{OTA_FIRMWARE_BASE_URL}{rel}"
    if request is not None:
        base = (getattr(request, "host_url", "") or "").rstrip("/")
        if base:
            return f"{base}{rel}"
    return rel


def _parse_hhmm(s):
    """解析 'HH:MM' -> 当日分钟数；非法返回 None。"""
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*$", s)
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return None
    return h * 60 + mi


def _hit_window(cur, start, end):
    """判断分钟数 cur 是否落在窗口 [start, end) 内；支持跨午夜（start > end）。"""
    if start <= end:
        return start <= cur < end
    return cur >= start or cur < end


def in_quiet_window(now=None):
    """是否处于 OTA 静默时段（不自动推送）。

    触发条件：
      - OTA_RESPECT_CLASS_TIME 且当前确为上课时段（复用 ClassTimeChecker）；
      - 当前本地时间落在 OTA_QUIET_WINDOWS 任一窗口内（支持跨午夜）。
    """
    if now is None:
        now = datetime.now()

    if OTA_RESPECT_CLASS_TIME:
        try:
            from services.class_time_checker import ClassTimeChecker

            if ClassTimeChecker.is_during_class_time()[0]:
                return True
        except Exception as e:  # 上课时间检查失败不应阻断自动推送
            logger.warning("[OTA协商] 上课时段检查异常（忽略）: %s", e)

    if OTA_QUIET_WINDOWS:
        cur = now.hour * 60 + now.minute
        for win in OTA_QUIET_WINDOWS.split(","):
            win = win.strip()
            if "-" not in win:
                continue
            a, b = win.split("-", 1)
            start, end = _parse_hhmm(a), _parse_hhmm(b)
            if start is None or end is None:
                continue
            if _hit_window(cur, start, end):
                return True
    return False


def seconds_until_quiet_window_end(now=None):
    """若处于 OTA_QUIET_WINDOWS 窗口内，返回到窗口结束的秒数；否则 0。

    上课时段因无法预估下课时间，返回 0（由调用方走固定重试兜底）。
    """
    if now is None:
        now = datetime.now()
    cur_sec = now.hour * 3600 + now.minute * 60 + now.second
    best = None
    if OTA_QUIET_WINDOWS:
        for win in OTA_QUIET_WINDOWS.split(","):
            win = win.strip()
            if "-" not in win:
                continue
            a, b = win.split("-", 1)
            start, end = _parse_hhmm(a), _parse_hhmm(b)
            if start is None or end is None:
                continue
            if start <= end:
                if start <= (now.hour * 60 + now.minute) < end:
                    d = end * 60 - (now.hour * 60 + now.minute) * 60 - now.second
                    best = d if best is None else min(best, d)
            else:  # 跨午夜
                if now.hour * 60 + now.minute >= start:
                    d = (24 * 3600 - cur_sec) + end * 60
                    best = d if best is None else min(best, d)
                elif now.hour * 60 + now.minute < end:
                    d = end * 60 - (now.hour * 60 + now.minute) * 60 - now.second
                    best = d if best is None else min(best, d)
    return int(best) if best is not None else 0


def sign_ota_command(firmware, url):
    """对 OTA 指令生成 HMAC-SHA256 签名；未配置密钥返回空串（设备侧跳过校验）。"""
    if not OTA_SIGNING_SECRET:
        return ""
    msg = f"{firmware.id}:{firmware.version}:{url}"
    return hmac.new(
        OTA_SIGNING_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def negotiate(device, reported_version, device_type=None):
    """版本协商：返回决策 dict。

    action 取值：
      - "no_firmware"   无可用 active 固件
      - "up_to_date"    设备已是最新
      - "skip_too_old"  设备版本低于最低兼容版本，需先手动中间升级
      - "upgrade"       可升级，附带 firmware

    差异 #1：device_type 未显式传入时自动取 device.device_type（None → 'phonebox'），
    只与该类型固件比较，避免跨设备类型误推。
    """
    if device_type is None:
        device_type = getattr(device, "device_type", None)
    wanted_type = normalize_device_type(device_type)

    latest = get_latest_active_firmware(wanted_type)
    if not latest:
        return {"action": "no_firmware", "device_type": wanted_type}

    if compare_versions(reported_version or "", latest.version) >= 0:
        return {
            "action": "up_to_date",
            "latest_version": latest.version,
            "device_type": wanted_type,
        }

    if (
        latest.min_compatible_version
        and compare_versions(reported_version or "0", latest.min_compatible_version) < 0
    ):
        return {
            "action": "skip_too_old",
            "latest_version": latest.version,
            "min_compatible_version": latest.min_compatible_version,
            "device_type": wanted_type,
        }

    return {
        "action": "upgrade",
        "firmware": latest,
        "latest_version": latest.version,
        "device_type": wanted_type,
    }


def can_auto_push(device):
    """是否允许调度自动推送（全局开关 + 设备开关 + 状态护栏 + 冷却）。

    返回 False 的情形：
      - 全局自动推送关闭
      - 设备 auto_update=False
      - 设备正在升级中（ota_status=='upgrading'）
      - 设备处于 pending（已调度，冷却期内不再重复调度）或 failed（冷却期内不重试）
    """
    if not OTA_AUTO_PUSH_ENABLED:
        return False
    if getattr(device, "auto_update", True) is False:
        return False
    if in_quiet_window():
        return False

    status = getattr(device, "ota_status", None) or "idle"
    last = getattr(device, "last_ota_push_at", None)

    if status == "upgrading":
        return False
    if status in ("pending", "failed") and last is not None:
        elapsed = (datetime.now() - last).total_seconds()
        if elapsed < OTA_PUSH_COOLDOWN_SEC:
            return False
    return True


def schedule_auto_push(device, firmware, extra_delay=0):
    """调度自动推送：先占坑（防并发心跳重复调度），再带抖动启动定时器错峰下发。

    extra_delay 用于灰度分批：同批次设备统一推迟 batch_idx*间隔 秒。
    若当前处于静默时段，则推迟到窗口结束后（上课时段无法预估结束，固定 5min 后重试）。
    """
    device_id = device.device_id
    try:
        from app import app
        from models import db, Device

        with app.app_context():
            d = Device.query.filter_by(device_id=device_id).first()
            if d is None:
                return
            d.ota_status = "pending"
            d.last_ota_push_at = datetime.now()
            db.session.commit()
    except Exception as e:  # 占坑失败不致命，仅跳过本次调度
        logger.warning("[OTA协商] 占坑失败 %s: %s", device_id, e, exc_info=True)
        return

    old = _ota_timers.pop(device_id, None)
    if old is not None:
        old.cancel()

    jitter = random.uniform(0, max(0, OTA_ROLLOUT_JITTER_SEC))
    if in_quiet_window():
        q_delay = seconds_until_quiet_window_end()
        if q_delay <= 0:
            q_delay = 300  # 上课时段无法预估下课时间，固定 5 分钟后重试
        delay = q_delay + jitter
        logger.info("[OTA协商] 设备 %s 处于静默时段，推迟到约 %.1fs 后推送", device_id, delay)
    else:
        delay = extra_delay + jitter
    t = threading.Timer(delay, _execute_push, args=(device_id, firmware.id))
    t.daemon = True
    _ota_timers[device_id] = t
    t.start()
    logger.info(
        "[OTA协商] 已为设备 %s 调度自动推送（约 %.1fs 后）版本 %s",
        device_id,
        delay,
        firmware.version,
    )


def _execute_push(device_id, firmware_id):
    """定时器回调：重新校验状态，避免重复/无效推送。"""
    try:
        # 执行时刻若仍处于静默时段：保留 pending 状态，推迟重试（不重置，避免丢失调度意图）
        if in_quiet_window():
            delay = seconds_until_quiet_window_end() or 300
            old = _ota_timers.pop(device_id, None)
            if old is not None:
                old.cancel()
            t = threading.Timer(delay, _execute_push, args=(device_id, firmware_id))
            t.daemon = True
            _ota_timers[device_id] = t
            t.start()
            logger.info("[OTA协商] 设备 %s 执行时刻仍在静默时段，%ds 后重试", device_id, delay)
            return

        from app import app
        from models import db, Device, FirmwareVersion

        with app.app_context():
            device = Device.query.filter_by(device_id=device_id).first()
            firmware = FirmwareVersion.query.get(firmware_id)
            if device is None or firmware is None:
                return

            # 设备已在升级中 → 放弃本次推送
            if (device.ota_status or "idle") == "upgrading":
                _reset_pending(device, db)
                return

            # 二次协商：版本已最新或护栏变化 → 放弃
            # 差异 #1：显式传入 firmware.device_type，确保与调度时的固件同类型比较
            decision = negotiate(
                device, device.fw_version, device_type=getattr(firmware, "device_type", None)
            )
            if decision["action"] != "upgrade":
                _reset_pending(device, db)
                return

            url = build_download_url(firmware)
            if not url.startswith("http"):
                logger.error(
                    "[OTA协商] 设备 %s 推送中止：未配置 OTA_FIRMWARE_BASE_URL，"
                    "无法生成设备可直连的绝对下载 URL",
                    device_id,
                )
                _reset_pending(device, db)
                return

            from services.mqtt_manager import mqtt_manager

            payload = {
                "id": firmware.id,
                "url": url,
                "version": firmware.version,
                "md5": firmware.md5,
                "is_mandatory": firmware.is_mandatory,
                "force": False,
            }
            sig = sign_ota_command(firmware, url)
            if sig:
                payload["signature"] = sig
            mqtt_manager.publish_ota_command(device_id, payload)
            logger.info(
                "[OTA协商] 自动推送指令已发往 %s -> %s（签名:%s）",
                device_id,
                firmware.version,
                "有" if sig else "无",
            )
    except Exception as e:
        logger.error("[OTA协商] 执行推送异常 %s: %s", device_id, e)


def _reset_pending(device, db):
    if (device.ota_status or "idle") == "pending":
        device.ota_status = "idle"
        db.session.commit()


def try_auto_negotiate(device):
    """在 register / heartbeat 落库后调用：协商并可能自动推送。

    调用方须处于 app context 内（Device.query 可用）。
    """
    if not OTA_AUTO_PUSH_ENABLED:
        return
    reported = getattr(device, "fw_version", None)
    if not reported:
        return
    if not can_auto_push(device):
        return
    decision = negotiate(device, reported)
    if decision["action"] == "upgrade":
        schedule_auto_push(device, decision["firmware"])
    else:
        logger.debug(
            "[OTA协商] 设备 %s 决策=%s", getattr(device, "device_id", "?"), decision["action"]
        )


def negotiate_all_devices(stage_percent=None, batch_size=None):
    """触发全量协商扫描（管理端手动调用）。

    stage_percent: 仅推送当前可升级设备的前百分之 N（灰度）；None 时取 OTA_STAGE_PERCENT。
                   未入选设备保留资格，可后续再次调用推进（如 10% -> 50% -> 100%）。
    batch_size:    分批大小，>0 时按批错峰（批间隔 OTA_STAGE_BATCH_INTERVAL_SEC）。
    返回 checked / eligible / scheduled 计数。
    """
    from app import app
    from models import Device

    pct = (
        stage_percent
        if stage_percent is not None
        else (OTA_STAGE_PERCENT if OTA_STAGED_ROLLOUT else 100)
    )
    pct = max(0, min(100, int(pct)))
    bs = batch_size if batch_size is not None else OTA_STAGE_BATCH_SIZE

    checked = 0
    eligible = []
    with app.app_context():
        devices = Device.query.filter(Device.fw_version.isnot(None)).all()
        for d in devices:
            checked += 1
            if can_auto_push(d):
                decision = negotiate(d, d.fw_version)
                if decision["action"] == "upgrade":
                    eligible.append((d, decision["firmware"]))

    planned = _plan_rollout(eligible, pct, bs)
    scheduled = 0
    for d, fw, extra_delay in planned:
        schedule_auto_push(d, fw, extra_delay=extra_delay)
        scheduled += 1

    logger.info(
        "[OTA协商] 全量扫描完成：checked=%d eligible=%d scheduled=%d (pct=%d)",
        checked,
        len(eligible),
        scheduled,
        pct,
    )
    return {
        "checked": checked,
        "eligible": len(eligible),
        "scheduled": scheduled,
        "stage_percent": pct,
    }


def _plan_rollout(eligible, stage_percent, batch_size):
    """根据灰度百分比与分批大小，规划实际推送的设备列表及各自错峰延迟。

    eligible: [(device, firmware), ...]
    返回 [(device, firmware, extra_delay), ...]
      - 灰度：取前 stage_percent% 个（先随机洗牌，避免每次都是同一批）
      - 分批：第 b 批（batch_size 个）整体推迟 b * OTA_STAGE_BATCH_INTERVAL_SEC 秒
    """
    if not eligible:
        return []
    pct = max(0, min(100, int(stage_percent)))
    chosen = list(eligible)
    if pct < 100:
        random.shuffle(chosen)
        k = max(1, int(math.ceil(len(chosen) * pct / 100.0)))
        chosen = chosen[:k]

    bs = int(batch_size) if batch_size else 0
    planned = []
    for i, (d, fw) in enumerate(chosen):
        extra_delay = 0
        if bs > 0:
            extra_delay = (i // bs) * OTA_STAGE_BATCH_INTERVAL_SEC
        planned.append((d, fw, extra_delay))
    return planned


# ---------------------------------------------------------------------------
# 差异 #2：设备端回滚机制（后端侧）
# ---------------------------------------------------------------------------
def resolve_rollback_target(firmware):
    """解析给定固件应回滚到的目标固件。

    优先级：
      1) firmware.rollback_to（管理员显式指定的版本号）
      2) 同 device_type 下、created_at 早于该固件的最新 active 且 is_stable 的版本
    找不到返回 None。
    """
    from models import FirmwareVersion

    if firmware is None:
        return None

    if getattr(firmware, "rollback_to", None):
        target = FirmwareVersion.query.filter_by(version=firmware.rollback_to).first()
        if target is not None:
            return target

    wanted = normalize_device_type(getattr(firmware, "device_type", None))
    return (
        FirmwareVersion.query.filter(
            FirmwareVersion.is_active,
            FirmwareVersion.device_type == wanted,
            FirmwareVersion.is_stable.is_(True),
            FirmwareVersion.created_at < firmware.created_at,
        )
        .order_by(FirmwareVersion.created_at.desc())
        .first()
    )


def build_rollback_command(device, target_firmware, reason=None):
    """构造回滚指令 payload（含签名），设备侧按 action='rollback' 执行。

    与自动推送的区别：force=True（忽略「已是最新」的版本比较，强制降级），
    并额外带 rollback=True 供设备端区分「升级」与「回滚」两种语义。
    """
    url = build_download_url(target_firmware)
    payload = {
        "id": target_firmware.id,
        "url": url,
        "version": target_firmware.version,
        "md5": target_firmware.md5,
        "is_mandatory": True,
        "force": True,
        "rollback": True,
        "action": "rollback",
        "device_id": getattr(device, "device_id", None),
        "reason": reason or "manual_rollback",
    }
    sig = sign_ota_command(target_firmware, url)
    if sig:
        payload["signature"] = sig
    return payload


def rollback_device(device, reason=None):
    """对单台设备下发回滚指令。

    返回 (ok: bool, message: str, payload: dict | None)。
    - 设备当前固件不存在 → (False, 'device_firmware_unknown', None)
    - 找不到回滚目标 → (False, 'no_rollback_target', None)
    - MQTT 发布失败 → (False, 'mqtt_publish_failed', payload)
    """
    from services.mqtt_manager import mqtt_manager

    current = getattr(device, "fw_version", None)
    if not current:
        return False, "device_firmware_unknown", None

    from models import FirmwareVersion

    current_fw = FirmwareVersion.query.filter_by(version=current).first()
    if current_fw is None:
        return False, "device_firmware_unknown", None

    target = resolve_rollback_target(current_fw)
    if target is None:
        return False, "no_rollback_target", None

    payload = build_rollback_command(device, target, reason=reason)
    ok = mqtt_manager.publish_ota_command(device.device_id, payload)
    if not ok:
        return False, "mqtt_publish_failed", payload

    logger.warning(
        "[OTA回滚] 已向设备 %s 下发回滚指令：%s -> %s（原因：%s）",
        device.device_id,
        current,
        target.version,
        reason or "manual_rollback",
    )
    return True, "rollback_dispatched", payload


def rollback_all_devices(device_ids=None, reason=None):
    """批量回滚：device_ids 为 None 时对所有设备执行。

    返回 {"total", "dispatched", "failed", "results": [...]}。
    逐台隔离异常，单台失败不影响其余设备。
    """
    from app import app
    from models import Device

    results = []
    dispatched = 0
    failed = 0

    with app.app_context():
        query = Device.query
        if device_ids:
            query = query.filter(Device.id.in_(list(device_ids)))
        devices = query.all()

        for d in devices:
            try:
                ok, message, payload = rollback_device(d, reason=reason)
            except Exception as e:  # 单台异常隔离
                logger.error("[OTA回滚] 设备 %s 回滚异常: %s", getattr(d, "device_id", "?"), e)
                ok, message, payload = False, "exception", None
            if ok:
                dispatched += 1
            else:
                failed += 1
            results.append(
                {
                    "device_id": d.device_id,
                    "name": d.name,
                    "current_version": d.fw_version,
                    "success": ok,
                    "message": message,
                    "target_version": (payload or {}).get("version"),
                }
            )

    return {
        "total": len(results),
        "dispatched": dispatched,
        "failed": failed,
        "results": results,
    }
