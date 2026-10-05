"""请假（硬件端）业务服务（#408）。

归并到 Approval(type='leave')，承载：
  - 设备上行请假申请 / 销假 / 状态查询（req / cancel / query）的业务处理与下行 MQTT 回包发布；
  - ProcessedMessage(message_id UNIQUE) 原子幂等去重（先插占位，冲突回查 record_id 重建回包）；
  - 惰性过期（读时把已过期 approved 置 expired）与周期过期（expire_leaves 供 scheduler 调用）；
  - 解锁扣分解析 resolve_leave_for_unlock（F3 自动销假+正常扣 / 纯免扣）；
  - ISO8601 +08:00 时间格式（F7）。

设计依据：docs/esp32/请假审批-硬件端设计需求.md §3–§6（F1–F7 采纳「当前建议」）。
零破坏约束：复用既有 Approval / ProcessedMessage / phonebox_policy / mqtt 发布链路，不改动既有契约。
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError

from models import Approval, ProcessedMessage, User, db
from services import phonebox_policy
from services.mqtt_service import publish_mqtt
from utils.db_session import db_session_scope

logger = logging.getLogger(__name__)

# 中国时区（服务器本地钟为 naive，统一附 +08:00 输出，F7）
_CN_TZ = timezone(timedelta(hours=8))

# 合法请假类型（§3.2.1）
LEAVE_TYPES = ("sick", "personal", "other")

# 默认自动销假模式下正常开锁扣分（与 UnlockValidator.UNLOCK_COST 对齐）
LEAVE_UNLOCK_COST = 10


def _to_iso(dt):
    """ISO8601 带 +08:00 时区偏移（F7）；None → None。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_CN_TZ)
    return dt.isoformat()


def _fmt_hm(dt):
    """本地时分展示，用于 explain 文案。"""
    return dt.strftime("%H:%M") if dt else ""


def _get_user_by_card(card_id):
    if not card_id:
        return None
    return User.query.filter_by(card_id=card_id).first()


def _publish_leave(device_id, msg_type, resp):
    """统一下行回包：phonebox/leave/{device_id}，payload={device_id,type,r}（§3.3）。"""
    topic = f"phonebox/leave/{device_id}" if device_id else "phonebox/leave"
    payload = {"device_id": device_id, "type": msg_type, "r": resp}
    try:
        publish_mqtt(topic, json.dumps(payload, ensure_ascii=False))
    except Exception as e:  # 发布失败不阻断主流程
        logger.warning("[Leave] 下发回包失败（已忽略）: %s", e, exc_info=True)


# ---------------------------------------------------------------------------
# 请假态查询（含惰性过期）
# ---------------------------------------------------------------------------
def _find_active_leave(user_id):
    """返回该生活效请假（approved 且未过期），惰性过期已过期项并落库。

    返回 Approval 或 None。
    """
    now = datetime.now()
    leaves = (
        Approval.query.filter_by(student_id=user_id, type="leave", status="approved")
        .order_by(Approval.end_time.desc())
        .all()
    )
    for leave in leaves:
        if leave.end_time and leave.end_time <= now:
            leave.status = "expired"
            db.session.commit()
            continue
        return leave
    return None


def _find_active_leave_in_session(user_id):
    """同上，但不在本函数内提交（交由外层 db_session_scope 统一提交）。"""
    now = datetime.now()
    leave = (
        Approval.query.filter_by(student_id=user_id, type="leave", status="approved")
        .order_by(Approval.end_time.desc())
        .first()
    )
    if leave and leave.end_time and leave.end_time <= now:
        leave.status = "expired"  # 惰性过期，外层 scope 提交
        return None
    return leave


def is_on_leave(user_id):
    """供 query/unlock 回包快速判定当前是否生效请假中（会触发惰性过期）。"""
    return _find_active_leave(user_id) is not None


def resolve_leave_status(user):
    """供 query 回包判定当前请假态与（如免扣）扣分（F6 透传）。

    返回 {"on_leave": bool, "points_deducted": int|None}：
      - 无生效请假：        {"on_leave": False, "points_deducted": None}
      - 生效请假 + 纯免扣： {"on_leave": True,  "points_deducted": 0}
      - 生效请假 + 默认：   {"on_leave": True,  "points_deducted": None}（由解锁时正常扣）
    """
    leave = _find_active_leave(user.id)
    if not leave:
        return {"on_leave": False, "points_deducted": None}
    policy = phonebox_policy.get_policy(getattr(user, "class_info_id", None))
    exempt = bool(policy and policy.leave_exempt_deduction)
    if exempt:
        return {"on_leave": True, "points_deducted": 0}
    return {"on_leave": True, "points_deducted": None}


# ---------------------------------------------------------------------------
# 解锁扣分解析（F3）
# ---------------------------------------------------------------------------
def resolve_leave_for_unlock(user):
    """解锁前请假态判定。

    返回 (on_leave, points_deducted, proceed_deduct)：
      - 无生效请假：        (False, 10, True)  正常扣分路径
      - 生效请假 + 纯免扣： (True, 0, False)  不扣分、保留请假
      - 生效请假 + 默认：    (False, 10, True) 自动销假(status=cancelled) + 正常扣 10
    """
    leave = _find_active_leave(user.id)
    if not leave:
        return False, LEAVE_UNLOCK_COST, True
    policy = phonebox_policy.get_policy(getattr(user, "class_info_id", None))
    exempt = bool(policy and policy.leave_exempt_deduction)
    if exempt:
        # 纯免扣：保留请假，本次不扣分（F3 备选开关）
        return True, 0, False
    # 默认自动销假 + 正常扣 10（F3 默认，防滥用）
    leave.status = "cancelled"
    leave.approver_id = None
    db.session.commit()
    return False, LEAVE_UNLOCK_COST, True


# ---------------------------------------------------------------------------
# 回包构建
# ---------------------------------------------------------------------------
def _leave_req_response_from_approval(approval, device_id):
    if approval is None:
        return {
            "ok": True,
            "status": "approved",
            "end_time": None,
            "explain": "请假已生效",
        }
    if approval.status == "pending":
        return {
            "ok": True,
            "status": "pending",
            "end_time": _to_iso(approval.end_time),
            "explain": "请假已提交，待审批",
        }
    return {
        "ok": True,
        "status": "approved",
        "end_time": _to_iso(approval.end_time),
        "explain": f"请假已生效，截止{_fmt_hm(approval.end_time)}",
    }


def _leave_status_response_from_approval(approval, device_id):
    if not approval or approval.status != "approved":
        return {"on_leave": False}
    remain = 0.0
    if approval.end_time:
        remain = (approval.end_time - datetime.now()).total_seconds() / 3600.0
        remain = max(0.0, remain)
    return {
        "on_leave": True,
        "leave_type": approval.leave_type,
        "status": "approved",
        "end_time": _to_iso(approval.end_time),
        "remaining_hours": round(remain, 1),
    }


def _rebuild_response(msg_type, approval, device_id):
    if msg_type == "leave_req":
        return _leave_req_response_from_approval(approval, device_id)
    if msg_type == "leave_cancel":
        if approval and approval.status == "cancelled":
            return {"ok": True, "status": "cancelled", "explain": "销假成功，恢复手机存放"}
        return {"ok": False, "status": "not_found", "explain": "该生无生效请假"}
    if msg_type == "leave_status":
        return _leave_status_response_from_approval(approval, device_id)
    return {"ok": False, "status": "error", "explain": "未知类型"}


def _replay(device_id, msg_type, rec):
    aid = rec.record_id
    approval = Approval.query.get(aid) if aid else None
    resp = _rebuild_response(msg_type, approval, device_id)
    _publish_leave(device_id, msg_type, resp)
    return resp


def _process_leave_message(device_id, msg_type, msg_id, build_fn):
    """通用请假消息幂等处理（#408 / §2.2 / §2.11）。

    build_fn() 在事务内调用，返回 (response_dict, approval_id_or_None)，
    由本函数统一在事务提交后发布回包。
    幂等：msg_id 复用 ProcessedMessage(message_id UNIQUE)；首次先插占位，
    冲突(IntegrityError)则按已存 record_id 重建回包重发，避免双插请假记录。
    """
    if not msg_id:
        resp, _ = build_fn()
        _publish_leave(device_id, msg_type, resp)
        return resp

    rec = ProcessedMessage.query.filter_by(message_id=msg_id).first()
    if rec:
        return _replay(device_id, msg_type, rec)

    with db_session_scope():
        try:
            db.session.add(ProcessedMessage(message_id=msg_id))
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            rec = ProcessedMessage.query.filter_by(message_id=msg_id).first()
            if rec:
                return _replay(device_id, msg_type, rec)
            return None
        resp, aid = build_fn()
        rec = ProcessedMessage.query.filter_by(message_id=msg_id).first()
        if rec and aid is not None:
            rec.record_id = aid
        _pending = resp  # scope 退出已提交，外部发布
    _publish_leave(device_id, msg_type, _pending)
    return _pending


# ---------------------------------------------------------------------------
# 三个设备上行入口
# ---------------------------------------------------------------------------
def handle_leave_request(data):
    """phonebox/leave/req —— 学生刷卡提交请假（§3.2.1 / §3.3.1 / L1,L2,L8,L10）。"""
    device_id = data.get("device_id") or data.get("client_id")
    msg_id = data.get("msg_id")
    card_id = data.get("card_id")
    leave_type = data.get("leave_type")
    leave_hours = data.get("leave_hours")

    if not card_id:
        _publish_leave(device_id, "leave_req", {"ok": False, "status": "error", "explain": "卡号缺失"})
        return
    if leave_type not in LEAVE_TYPES:
        _publish_leave(
            device_id, "leave_req",
            {"ok": False, "status": "error", "explain": "请假类型无效（应为 sick/personal/other）"},
        )
        return
    try:
        lh = int(leave_hours)
        if lh <= 0:
            raise ValueError
    except (TypeError, ValueError):
        _publish_leave(
            device_id, "leave_req",
            {"ok": False, "status": "error", "explain": "请假时长无效（应为正整数小时）"},
        )
        return

    user = _get_user_by_card(card_id)
    if not user:
        _publish_leave(
            device_id, "leave_req", {"ok": False, "status": "not_found", "explain": "卡号未注册"}
        )
        return

    def build_fn():
        existing = _find_active_leave_in_session(user.id)
        if existing:
            return (
                {
                    "ok": False,
                    "status": "duplicate",
                    "end_time": _to_iso(existing.end_time),
                    "explain": (
                        f"已有生效请假（{existing.leave_type}），截止{_fmt_hm(existing.end_time)}，"
                        f"如需修改请先销假"
                    ),
                },
                existing.id,
            )
        # F2 审批模式：每班级可配（默认免审批直生效）
        policy = phonebox_policy.get_policy(getattr(user, "class_info_id", None))
        approval_required = bool(policy and policy.leave_approval_required)
        now = datetime.now()
        end = now + timedelta(hours=lh)
        approval = Approval(
            student_id=user.id,
            type="leave",
            title=f"请假-{leave_type}",
            description=f"硬件端提交 {leave_type} {lh}h（设备 {device_id}）",
            leave_type=leave_type,
            start_date=now.date(),
            end_date=end.date(),
            start_time=now,
            end_time=end,
            card_id=card_id,
            device_id=device_id,
            status="pending" if approval_required else "approved",
            approver_id=None,
        )
        db.session.add(approval)
        db.session.flush()
        return _leave_req_response_from_approval(approval, device_id), approval.id

    return _process_leave_message(device_id, "leave_req", msg_id, build_fn)


def handle_leave_cancel(data):
    """phonebox/leave/cancel —— 学生返校刷卡销假（§3.2.2 / §3.3.2 / L4,L5,B2）。"""
    device_id = data.get("device_id") or data.get("client_id")
    msg_id = data.get("msg_id")
    card_id = data.get("card_id")

    if not card_id:
        _publish_leave(
            device_id, "leave_cancel", {"ok": False, "status": "error", "explain": "卡号缺失"}
        )
        return
    user = _get_user_by_card(card_id)
    if not user:
        _publish_leave(
            device_id, "leave_cancel",
            {"ok": False, "status": "not_found", "explain": "卡号未注册"},
        )
        return

    def build_fn():
        # 按 card_id 命中（不依赖 device_id，支持跨设备销假 B2）
        leave = _find_active_leave_in_session(user.id)
        if not leave:
            return {"ok": False, "status": "not_found", "explain": "该生无生效请假"}, None
        leave.status = "cancelled"
        db.session.flush()
        return {"ok": True, "status": "cancelled", "explain": "销假成功，恢复手机存放"}, leave.id

    return _process_leave_message(device_id, "leave_cancel", msg_id, build_fn)


def handle_leave_query(data):
    """phonebox/leave/query —— 刷卡查该生请假状态（§3.2.3 / §3.3.3 / L7）。"""
    device_id = data.get("device_id") or data.get("client_id")
    msg_id = data.get("msg_id")
    card_id = data.get("card_id")

    if not card_id:
        _publish_leave(device_id, "leave_status", {"on_leave": False})
        return
    user = _get_user_by_card(card_id)
    if not user:
        _publish_leave(device_id, "leave_status", {"on_leave": False})
        return

    def build_fn():
        leave = _find_active_leave_in_session(user.id)  # 惰性过期
        if not leave:
            return {"on_leave": False}, None
        return _leave_status_response_from_approval(leave, device_id), leave.id

    return _process_leave_message(device_id, "leave_status", msg_id, build_fn)


# ---------------------------------------------------------------------------
# 周期过期任务（F5 双保险之一，供 scheduler 调用）
# ---------------------------------------------------------------------------
def expire_leaves(app=None):
    """将 status='approved' 且 end_time<=now 的请假置 expired（双保险·周期任务）。

    返回处理条数。读时惰性过期见 _find_active_leave / _find_active_leave_in_session。
    """
    from models import Approval as _Approval

    if app is None:
        from app import app as _app

        app = _app
    count = 0
    try:
        with app.app_context():
            now = datetime.now()
            expired = (
                _Approval.query.filter_by(type="leave", status="approved")
                .filter(_Approval.end_time <= now)
                .all()
            )
            for a in expired:
                a.status = "expired"
                count += 1
            if count:
                db.session.commit()
            logger.info("[Leave] 周期过期任务：扫描 %d 条置 expired", count)
    except Exception as e:
        logger.error("[Leave] 周期过期任务失败: %s", e, exc_info=True)
    return count
