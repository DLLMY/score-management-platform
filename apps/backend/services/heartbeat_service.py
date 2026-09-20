from datetime import datetime, timedelta
from models import Device, Alert, db
import logging

logger = logging.getLogger(__name__)


# 差异 #3：心跳 → Device 字段的**唯一**映射表。
# 两条心跳入口（mqtt_manager._process_heartbeat / mqtt_message_service.
# handle_heartbeat_message）与 update_device_heartbeat 统一引用此处，
# 避免字段集不一致导致同一设备经不同入口进来状态不同。
# 值为 Device 上的属性名；键为心跳 payload 字段名。
_HEARTBEAT_DEVICE_FIELDS = {
    "wifi_signal": "wifi_signal",
    "uptime": "uptime",
    "box_a_status": "box_a_status",
    "box_b_status": "box_b_status",
    "system_state": "system_state",
    "fw_version": "fw_version",
    "platform": "platform",
    "free_heap": "free_heap",
    "last_error": "last_error",
    "error_count": "error_count",
    "device_type": "device_type",
    "battery_level": "battery_level",
    "temperature": "temperature",
}

# 心跳中「设备自称在线」时可安全回写的状态字段（不包含 status，见下）
_HEARTBEAT_STATUS_VALUE = "online"


# 差异 #15：device_id 兜底格式校验（**宽松**，绝不拒绝既有设备）
# 只拦截明确非法的形态：空、含空白/换行、超过列宽、含 MQTT 主题分隔符或控制字符。
# 历史上已存在的设备（可能是无连字符的短 ID、含中文前缀等）一律放行，
# 因此本校验只做「安全卫生」而非「强制命名规范」，避免存量设备集体失效。
_DEVICE_ID_MAX_LEN = 100  # 与 Device.device_id 列宽一致
_DEVICE_ID_FORBIDDEN = set("/+#\x00\r\n\t")


def is_safe_device_id(device_id) -> bool:
    """device_id 是否可安全入库（宽松白名单，见模块内说明）。

    注意：**不**校验长度下限，也不要求字母开头 —— 仅拦截会造成
    「空值键」「Topic 注入」「列溢出」的非法形态。
    """
    if not device_id or not isinstance(device_id, str):
        return False
    text = device_id.strip()
    if not text or text != device_id:
        # 前后空白（trim 后不等）会导致同一设备产生两个主键 → 拒绝
        return False
    if len(text) > _DEVICE_ID_MAX_LEN:
        return False
    return not any(ch in _DEVICE_ID_FORBIDDEN for ch in text)


def apply_heartbeat_to_device(device, heartbeat_data, now=None, touch_status=True):
    """把心跳 payload 写入 Device 实例（差异 #3：统一心跳落库语义）。

    统一规则（与历史两条路径的关键差异）：
      - 字段**键存在且值非 None** 才覆盖，避免设备「按需上报」时把已有值清空；
      - last_heartbeat 总是刷新为 now（心跳到达即代表在线时刻）；
      - touch_status=True 时把 status 置为 'online'（心跳到达即在线）。

    注意：本函数只改内存对象，**不 commit** —— 事务边界由调用方掌控，
    保持与两条既有路径各自的事务语义一致。

    Args:
        device: Device 模型实例
        heartbeat_data: 心跳 payload（dict）
        now: 注入当前时间（便于测试）
        touch_status: 是否同时置 status='online'
    """
    if device is None:
        return device

    data = heartbeat_data or {}
    device.last_heartbeat = now or datetime.now()
    if touch_status and hasattr(device, "status"):
        device.status = _HEARTBEAT_STATUS_VALUE

    for payload_key, attr_name in _HEARTBEAT_DEVICE_FIELDS.items():
        if payload_key not in data:
            continue
        value = data[payload_key]
        if value is None:
            continue
        if hasattr(device, attr_name):
            setattr(device, attr_name, value)

    if hasattr(device, "updated_at"):
        device.updated_at = now or datetime.now()
    return device


def is_device_online(device, now=None, default_timeout_seconds: int = 60) -> bool:
    """判断设备是否在线——以 last_heartbeat 时效性为准（status 字段可能陈旧）。

    判定规则：
    - 无 last_heartbeat → 离线（设备从未上报心跳）
    - 距 now 超过 (heartbeat_timeout or default_timeout_seconds) 秒 → 离线（心跳超时）
    - 否则视 status 字段（在线状态由 update_device_heartbeat 维护）

    Args:
        device: Device 模型实例
        now: 当前时间（默认 datetime.now()，便于测试注入）
        default_timeout_seconds: 当 device.heartbeat_timeout 为空时使用的默认阈值

    Returns:
        bool: True 在线 / False 离线
    """
    if device is None:
        return False
    if device.last_heartbeat is None:
        return False
    now = now or datetime.now()
    threshold = device.heartbeat_timeout or default_timeout_seconds
    if (now - device.last_heartbeat).total_seconds() > threshold:
        return False
    return device.status == "online"


def check_heartbeat_timeout(timeout_seconds: int = 60) -> dict:
    """
    检查心跳超时的设备

    参数:
        timeout_seconds: 超时阈值（秒）

    返回:
        包含超时设备列表和总数的字典
    """
    timeout_threshold = datetime.now() - timedelta(seconds=timeout_seconds)

    logger.info(
        f"开始检查心跳超时设备，超时阈值: {timeout_threshold}, 超时时间: {timeout_seconds}秒"
    )

    result = {"timeout_devices": [], "total_timeout": 0, "alerts_created": 0}
    try:
        timeout_devices = Device.query.filter(
            Device.last_heartbeat.isnot(None),
            Device.last_heartbeat < timeout_threshold,
            Device.status == "online",
            Device.alert_enabled,
        ).all()

        logger.info(f"发现 {len(timeout_devices)} 台设备心跳超时")

        alerts_created = 0
        for device in timeout_devices:
            # F9-A: 心跳超时告警统一写入 alert 表，来源标记为 'device'
            existing_alert = Alert.query.filter_by(
                device_id=device.device_id,
                alert_type="heartbeat_timeout",
                is_resolved=False,
                source="device",
            ).first()

            if not existing_alert:
                alert = Alert(
                    device_id=device.device_id,
                    alert_type="heartbeat_timeout",
                    severity="warning",
                    message=f"设备 {device.name or device.device_id} 心跳超时",
                    source="device",
                )
                db.session.add(alert)
                alerts_created += 1

                device.status = "offline"
                device.last_error = "心跳超时"

                logger.warning(f"设备 {device.device_id} ({device.name}) 心跳超时，已创建告警")

        if alerts_created > 0:
            try:
                db.session.commit()
                logger.info(f"已提交 {alerts_created} 条心跳超时告警")
            except Exception as e:
                db.session.rollback()
                logger.error(f"心跳超时告警提交失败: {e}", exc_info=True)

        # 必须在 db.session.remove() 之前构建结果：remove() 会 expire_all()，
        # 之后访问 device_id 等列属性会触发惰性 reload → DetachedInstanceError。
        # 构建时对象仍挂载在 session 上，列属性已加载，纯值落入 dict 后不再依赖 session。
        result = {
            "timeout_devices": [
                {
                    "device_id": d.device_id,
                    "name": d.name,
                    "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                    "heartbeat_timeout": d.heartbeat_timeout,
                }
                for d in timeout_devices
            ],
            "total_timeout": len(timeout_devices),
            "alerts_created": alerts_created,
        }
    finally:
        # P5: 后台线程（心跳检查每30s）无请求上下文，app_context teardown
        # 不一定可靠释放 scoped session；显式 remove 保证连接归还连接池，
        # 杜绝 QueuePool 耗尽（覆盖 0 超时不 commit 与异常两条泄漏路径）。
        db.session.remove()
    return result


def update_device_heartbeat(device_id: str, heartbeat_data: dict = None) -> bool:
    """
    更新设备心跳

    参数:
        device_id: 设备ID
        heartbeat_data: 心跳数据（可选）

    返回:
        是否更新成功
    """
    device = Device.query.filter_by(device_id=device_id).first()

    if not device:
        logger.error(f"未找到设备: {device_id}")
        return False

    # 差异 #3：复用统一映射表，字段集不再与另两条心跳路径分叉。
    # 保留本函数原有的 last_error=None 语义（此路径用于「设备确认存活」场景，
    # 与两条 MQTT 心跳路径的 last_error 语义不同，故显式保留）。
    apply_heartbeat_to_device(device, heartbeat_data, touch_status=True)
    device.last_error = None

    db.session.commit()
    logger.debug(f"设备 {device_id} 心跳已更新")

    return True


def get_device_heartbeat_status(device_id: str = None) -> dict:
    """
    获取设备心跳状态

    参数:
        device_id: 设备ID（可选，为空则返回所有设备）

    返回:
        设备心跳状态信息
    """
    if device_id:
        devices = Device.query.filter_by(device_id=device_id).all()
    else:
        devices = Device.query.all()

    status_list = []
    now = datetime.now()

    for device in devices:
        status_list.append(
            {
                "device_id": device.device_id,
                "name": device.name,
                "status": device.status,
                "last_heartbeat": (
                    device.last_heartbeat.isoformat() if device.last_heartbeat else None
                ),
                "heartbeat_timeout": device.heartbeat_timeout,
                "is_timeout": (
                    device.last_heartbeat is not None
                    and (
                        (now - device.last_heartbeat).total_seconds()
                        > (device.heartbeat_timeout or 60)
                    )
                ),
                "last_error": device.last_error,
                "alert_enabled": device.alert_enabled,
            }
        )

    logger.debug(f"获取了 {len(status_list)} 台设备的心跳状态")

    return {
        "devices": status_list,
        "total": len(status_list),
        # online 按 is_timeout 判定：心跳超时但尚未被 30s 任务标 off 的设备不算在线
        # （此前按陈旧 status 字段汇总，超时设备仍计入在线 → 在线数虚高）
        "online": sum(1 for d in status_list if d["status"] == "online" and not d["is_timeout"]),
        "offline": sum(1 for d in status_list if d["status"] == "offline" or d["is_timeout"]),
        "timeout": sum(1 for d in status_list if d["is_timeout"]),
    }


# 差异 #11：设备错误计数达到该阈值时额外产生 high 级别告警
DEVICE_ERROR_COUNT_ALERT_THRESHOLD = 5


def check_device_errors(device, heartbeat_data=None, now=None):
    """差异 #11：设备错误自动告警。

    此前 last_error / error_count 只落库、不产生任何 Alert，导致设备自报的故障
    （传感器异常、看门狗复位等）在管理端完全不可见，只能靠人工翻设备详情页。

    本函数在心跳落库后调用，产生两类告警（均遵循既有 Alert 体例）：
      - device_error       : last_error 非空且非「心跳超时」（后者已有专门告警）
      - error_count_high   : error_count >= DEVICE_ERROR_COUNT_ALERT_THRESHOLD
    去重规则与 check_heartbeat_timeout 一致：同 device_id + alert_type + is_resolved=False
    + source='device' 已存在则不重复创建。

    仅改内存（不 commit），事务由调用方掌控；异常不向上抛出，避免影响心跳主流程。
    返回本次新建的告警数量。
    """
    if device is None:
        return 0

    data = heartbeat_data or {}
    last_error = data.get("last_error", getattr(device, "last_error", None))
    error_count = data.get("error_count", getattr(device, "error_count", None))

    now = now or datetime.now()
    created = 0

    def _ensure_alert(alert_type, severity, message):
        nonlocal created
        existing = Alert.query.filter_by(
            device_id=device.device_id,
            alert_type=alert_type,
            is_resolved=False,
            source="device",
        ).first()
        if existing:
            return
        db.session.add(
            Alert(
                device_id=device.device_id,
                alert_type=alert_type,
                severity=severity,
                message=message,
                source="device",
            )
        )
        created += 1

    try:
        # ① 设备自报错误（排除「心跳超时」——那是后端推断的，另有 heartbeat_timeout 告警）
        if last_error and str(last_error).strip() and str(last_error).strip() != "心跳超时":
            _ensure_alert(
                "device_error",
                "warning",
                f"设备 {device.name or device.device_id} 上报错误：{last_error}",
            )

        # ② 错误计数超阈值 → 升级为 high（提示需人工介入）
        try:
            count_val = int(error_count) if error_count is not None else 0
        except (TypeError, ValueError):
            count_val = 0
        if count_val >= DEVICE_ERROR_COUNT_ALERT_THRESHOLD:
            _ensure_alert(
                "error_count_high",
                "high",
                f"设备 {device.name or device.device_id} 错误次数达 {count_val}，"
                f"超过阈值 {DEVICE_ERROR_COUNT_ALERT_THRESHOLD}",
            )
    except Exception as e:  # 告警失败不得影响心跳主流程
        logger.warning(f"设备 {getattr(device, 'device_id', '?')} 错误告警检查失败: {e}")

    return created
