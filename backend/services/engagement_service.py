from datetime import datetime, timedelta

from models import (
    Attendance,
    LeaveApplication,
    HomeworkAssignment,
    HomeworkSubmission,
    ScoreRecord,
)


# 出勤状态权重：迟到半价、请假(准假)视为正常出勤、缺勤 0
ATTENDANCE_WEIGHT = {
    "present": 1.0,
    "late": 0.5,
    "leave": 1.0,
    "leaved": 1.0,
    "absent": 0.0,
}
# 未知状态按正常出勤处理，避免误判
DEFAULT_ATTENDANCE_WEIGHT = 1.0

# 各维度权重（有数据时才计入，缺失维度权重会被重归一化）
WEIGHTS = {
    "attendance": 0.4,
    "homework": 0.3,
    "activity": 0.3,
}
# 单条积分行为视作「活跃」的预期密度：约每 3 天 1 次
ACTIVITY_EXPECTED_PER_DAYS = 3
# 请假扣分上限与单位
LEAVE_PENALTY_PER_DAY = 1.5
LEAVE_PENALTY_CAP = 15.0

# 等级阈值（基于 0-100 参与度分）
LEVEL_HIGH = 70
LEVEL_MEDIUM = 45


def _to_date(value):
    """将 datetime/date 归一为 date。"""
    if isinstance(value, datetime):
        return value.date()
    return value


def _count_leave_days(user_id, cutoff, now):
    """统计窗口内已批准请假的天数（按与窗口重叠的实际天数计）。"""
    leaves = LeaveApplication.query.filter(
        LeaveApplication.student_id == user_id,
        LeaveApplication.status == "approved",
        LeaveApplication.end_date >= cutoff,
    ).all()
    total = 0
    for lv in leaves:
        start = _to_date(lv.start_date)
        end = _to_date(lv.end_date)
        if start is None or end is None:
            continue
        s = max(start, cutoff)
        e = min(end, now)
        if e >= s:
            total += (e - s).days + 1
    return total


def calculate_engagement(user_id, days=30):
    """计算单个学生的参与度指数（0-100）。

    综合四个维度：
      - 出勤率：Attendance 表中各状态加权（迟到半价、准假算正常、缺勤 0）
      - 作业提交率：窗口内作业按时提交比例（迟交半价）
      - 积分活跃度：ScoreRecord 行为事件数 / 预期密度（封顶 1）
      - 请假天数：已批准请假按重叠天数扣分

    健壮性：
      - 任意维度无数据则记为 None，最终仅对「有数据」维度按权重重归一化；
      - 全维度无数据返回 has_data=False、score=0、level=low；
      - 所有数值均转原生 float/int，避免 numpy 类型导致 JSON 序列化失败。
    """
    user_id = int(user_id)
    days = int(days)
    now = datetime.now().date()
    cutoff = now - timedelta(days=days)
    cutoff_dt = datetime.combine(cutoff, datetime.min.time())

    # ---- 出勤 ----
    attendances = Attendance.query.filter(
        Attendance.student_id == user_id,
        Attendance.date >= cutoff,
    ).all()
    att_total = len(attendances)
    attendance_rate = None
    if att_total > 0:
        weighted = 0.0
        for a in attendances:
            st = (a.status or "present").lower()
            weighted += ATTENDANCE_WEIGHT.get(st, DEFAULT_ATTENDANCE_WEIGHT)
        attendance_rate = weighted / att_total

    # ---- 作业 ----
    assignments = HomeworkAssignment.query.filter(
        HomeworkAssignment.assigned_date >= cutoff,
    ).all()
    hw_total = len(assignments)
    homework_rate = None
    if hw_total > 0:
        sub_map = {}
        if assignments:
            subs = HomeworkSubmission.query.filter(
                HomeworkSubmission.student_id == user_id,
                HomeworkSubmission.assignment_id.in_([a.id for a in assignments]),
            ).all()
            for s in subs:
                sub_map[s.assignment_id] = s
        submitted = 0
        late = 0
        for a in assignments:
            s = sub_map.get(a.id)
            if s and s.is_submitted:
                submitted += 1
                if s.is_late:
                    late += 1
        # 迟交按半价计入，最少 0
        homework_rate = max(0.0, (submitted - 0.5 * late) / hw_total)

    # ---- 积分活跃度（无积分行为记录时记为缺失，参与权重重归一化）----
    records = ScoreRecord.query.filter(
        ScoreRecord.user_id == user_id,
        ScoreRecord.created_at >= cutoff_dt,
    ).all()
    event_count = len(records)
    expected = max(1, days // ACTIVITY_EXPECTED_PER_DAYS)
    activity_rate = None if event_count == 0 else min(1.0, event_count / expected)

    # ---- 请假 ----
    leave_days = _count_leave_days(user_id, cutoff, now)

    # ---- 汇总 ----
    rates = {
        "attendance": attendance_rate,
        "homework": homework_rate,
        "activity": activity_rate,
    }
    present = [k for k in WEIGHTS if rates[k] is not None]

    if not present:
        return {
            "user_id": user_id,
            "days": days,
            "engagement_score": 0.0,
            "level": "low",
            "factors": [
                {"name": "暂无行为数据", "value": 0.0, "weight": 0.0, "contribution": 0.0}
            ],
            "components": {
                "attendance_rate": None,
                "homework_rate": None,
                "activity_rate": (float(activity_rate) if activity_rate is not None else None),
                "leave_days": int(leave_days),
            },
            "description": "该学生在近 %d 天内暂无出勤、作业或积分行为记录，无法计算参与度。" % days,
            "has_data": False,
        }

    wsum = sum(WEIGHTS[k] for k in present)
    norm_weights = {k: WEIGHTS[k] / wsum for k in present}

    factors = []
    raw_score = 0.0
    for k in present:
        contribution = norm_weights[k] * rates[k] * 100
        raw_score += contribution
        factors.append(
            {
                "name": k,
                "value": round(float(rates[k]), 3),
                "weight": round(float(norm_weights[k]), 3),
                "contribution": round(float(contribution), 2),
            }
        )

    leave_penalty = min(LEAVE_PENALTY_CAP, leave_days * LEAVE_PENALTY_PER_DAY)
    engagement_score = max(0.0, raw_score - leave_penalty)
    engagement_score = round(float(engagement_score), 1)

    if leave_days > 0:
        factors.append(
            {
                "name": "leave",
                "value": int(leave_days),
                "weight": 0.0,
                "contribution": round(-float(leave_penalty), 2),
            }
        )

    level = "high" if engagement_score >= LEVEL_HIGH else ("medium" if engagement_score >= LEVEL_MEDIUM else "low")

    description = "参与度指数 %s（%s），由出勤、作业提交与积分活跃度综合评估。" % (
        engagement_score,
        "高" if level == "high" else ("中" if level == "medium" else "低"),
    )

    return {
        "user_id": user_id,
        "days": days,
        "engagement_score": engagement_score,
        "level": level,
        "factors": factors,
        "components": {
            "attendance_rate": (round(float(attendance_rate), 3) if attendance_rate is not None else None),
            "homework_rate": (round(float(homework_rate), 3) if homework_rate is not None else None),
            "activity_rate": (round(float(activity_rate), 3) if activity_rate is not None else None),
            "leave_days": int(leave_days),
        },
        "description": description,
        "has_data": True,
    }


class EngagementService:
    """学生参与度指数服务（与 AnomalyService / RiskPredictService 保持一致的类接口）。"""

    calculate_engagement = staticmethod(calculate_engagement)
