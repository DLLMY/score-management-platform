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

# ---- 配置（env 可覆盖）----
OTA_AUTO_PUSH_ENABLED = os.environ.get("OTA_AUTO_PUSH_ENABLED", "true").lower() == "true"
try:
    OTA_PUSH_COOLDOWN_SEC = int(os.environ.get("OTA_PUSH_COOLDOWN_SEC", "600"))
except ValueError:
    OTA_PUSH_COOLDOWN_SEC = 600
try:
    OTA_ROLLOUT_JITTER_SEC = int(os.environ.get("OTA_ROLLOUT_JITTER_SEC", "30"))
except ValueError:
    OTA_ROLLOUT_JITTER_SEC = 30
OTA_FIRMWARE_BASE_URL = (os.environ.get("OTA_FIRMWARE_BASE_URL", "") or "").rstrip("/")

# P2：静默时段（上课时段 + 夜间/自定义窗口），静默期内不自动推送 OTA
OTA_RESPECT_CLASS_TIME = os.environ.get("OTA_RESPECT_CLASS_TIME", "true").lower() == "true"
# 逗号分隔的本地时间窗口，支持跨午夜，如 "22:00-06:00,12:00-13:00"
OTA_QUIET_WINDOWS = (os.environ.get("OTA_QUIET_WINDOWS", "") or "").strip()

# P2：灰度/分批推送
OTA_STAGED_ROLLOUT = os.environ.get("OTA_STAGED_ROLLOUT", "false").lower() == "true"
try:
    OTA_STAGE_PERCENT = int(os.environ.get("OTA_STAGE_PERCENT", "100"))
except ValueError:
    OTA_STAGE_PERCENT = 100
try:
    OTA_STAGE_BATCH_SIZE = int(os.environ.get("OTA_STAGE_BATCH_SIZE", "0"))
except ValueError:
    OTA_STAGE_BATCH_SIZE = 0
try:
    OTA_STAGE_BATCH_INTERVAL_SEC = int(os.environ.get("OTA_STAGE_BATCH_INTERVAL_SEC", "60"))
except ValueError:
    OTA_STAGE_BATCH_INTERVAL_SEC = 60

# P2：指令签名（HMAC-SHA256），防止伪造 MQTT Broker 下发假 OTA 指令；
# 设备侧需编译相同密钥（OTA_SIGNING_SECRET）才能校验通过。
OTA_SIGNING_SECRET = (os.environ.get("OTA_SIGNING_SECRET", "") or "").strip()

# device_id -> threading.Timer，避免同一设备被重复调度
_ota_timers = {}


def compare_versions(v1, v2):
    """语义化版本比较，返回 1 / -1 / 0。支持 '2.10' > '2.9'。

    非数字片段按 0 处理；长度不齐时短侧补 0。
    """
    def parse(v):
        parts = []
        for x in str(v).split("."):
            try:
                parts.append(int(x))
            except ValueError:
                parts.append(0)
        return parts

    a, b = parse(v1), parse(v2)
    for i in range(max(len(a), len(b))):
        p1 = a[i] if i < len(a) else 0
        p2 = b[i] if i < len(b) else 0
        if p1 != p2:
            return 1 if p1 > p2 else -1
    return 0


def get_latest_active_firmware():
    """返回最新 active 固件（按 created_at 倒序）。无则返回 None。"""
    from models import FirmwareVersion

    return (
        FirmwareVersion.query.filter(FirmwareVersion.is_active)
        .order_by(FirmwareVersion.created_at.desc())
        .first()
    )


def build_download_url(firmware, request=None):
    """返回固件绝对下载 URL。

    MQTT 线程无 request 对象，使用 OTA_FIRMWARE_BASE_URL；
    REST 调用可传 request 使用 host_url。二者皆无则回退相对路径
    （仅当设备侧已知主机时可用，自动推送会因此中止）。
    """
    rel = f"/api/firmware/download/{firmware.id}"
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
            if start <= end:
                if start <= cur < end:
                    return True
            else:  # 跨午夜，如 22:00-06:00
                if cur >= start or cur < end:
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


def negotiate(device, reported_version):
    """版本协商：返回决策 dict。

    action 取值：
      - "no_firmware"   无可用 active 固件
      - "up_to_date"    设备已是最新
      - "skip_too_old"  设备版本低于最低兼容版本，需先手动中间升级
      - "upgrade"       可升级，附带 firmware
    """
    latest = get_latest_active_firmware()
    if not latest:
        return {"action": "no_firmware"}

    if compare_versions(reported_version or "", latest.version) >= 0:
        return {"action": "up_to_date", "latest_version": latest.version}

    if latest.min_compatible_version:
        if compare_versions(reported_version or "0", latest.min_compatible_version) < 0:
            return {
                "action": "skip_too_old",
                "latest_version": latest.version,
                "min_compatible_version": latest.min_compatible_version,
            }

    return {"action": "upgrade", "firmware": latest, "latest_version": latest.version}


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

    status = (getattr(device, "ota_status", None) or "idle")
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
        logger.warning("[OTA协商] 占坑失败 %s: %s", device_id, e)
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
    logger.info("[OTA协商] 已为设备 %s 调度自动推送（约 %.1fs 后）版本 %s",
                device_id, delay, firmware.version)


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
            decision = negotiate(device, device.fw_version)
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
            logger.info("[OTA协商] 自动推送指令已发往 %s -> %s（签名:%s）",
                        device_id, firmware.version, "有" if sig else "无")
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
        logger.debug("[OTA协商] 设备 %s 决策=%s", getattr(device, "device_id", "?"), decision["action"])


def negotiate_all_devices(stage_percent=None, batch_size=None):
    """触发全量协商扫描（管理端手动调用）。

    stage_percent: 仅推送当前可升级设备的前百分之 N（灰度）；None 时取 OTA_STAGE_PERCENT。
                   未入选设备保留资格，可后续再次调用推进（如 10% -> 50% -> 100%）。
    batch_size:    分批大小，>0 时按批错峰（批间隔 OTA_STAGE_BATCH_INTERVAL_SEC）。
    返回 checked / eligible / scheduled 计数。
    """
    from app import app
    from models import Device

    pct = stage_percent if stage_percent is not None else (OTA_STAGE_PERCENT if OTA_STAGED_ROLLOUT else 100)
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

    logger.info("[OTA协商] 全量扫描完成：checked=%d eligible=%d scheduled=%d (pct=%d)",
                checked, len(eligible), scheduled, pct)
    return {"checked": checked, "eligible": len(eligible), "scheduled": scheduled, "stage_percent": pct}


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
