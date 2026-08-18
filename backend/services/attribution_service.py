"""成绩波动归因服务。

将单名学生「近期 vs 前期」在四个维度（学业成绩 / 行为积分 / 出勤 / 作业完成）
上的变化进行归因分析，把学业成绩的净变化按各维度影响分配到可读的贡献度。

设计要点：
- ``attribute_score_change`` 为纯函数（不依赖 DB），便于单元测试与复用；
- ``analyze_score_attribution`` 为 DB 包装层，负责取数并估算置信度；
- 敏感度系数（SENSITIVITY）仅用于相对权重与文案，非因果推断，结果应理解为
  “相关性归因”而非“因果归因”。
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np

from models import (
    Attendance,
    Exam,
    HomeworkSubmission,
    Score,
    ScoreRecord,
    User,
    get_by_id,
)

# 各维度灵敏度：每单位原生变化对应的考试成绩影响（仅用于相对权重，非因果）。
SENSITIVITY: Dict[str, float] = {
    "behavior": 1.5,  # 行为积分：日均分值差
    "attendance": 30.0,  # 出勤率：0~1 差值
    "homework": 25.0,  # 作业提交率：0~1 差值
}
FACTOR_LABELS: Dict[str, str] = {
    "behavior": "行为积分",
    "attendance": "出勤",
    "homework": "作业完成",
}


class AttributionService:
    # ------------------------------------------------------------------
    # 纯函数核心（无 DB 依赖，单测友好）
    # ------------------------------------------------------------------
    @staticmethod
    def attribute_score_change(
        score_before: Optional[float],
        score_after: Optional[float],
        factor_values: Dict[str, Tuple[Optional[float], Optional[float]]],
        sensitivities: Optional[Dict[str, float]] = None,
        factor_labels: Optional[Dict[str, str]] = None,
    ) -> Dict:
        """将成绩净变化归因到各维度。

        Args:
            score_before: 前期平均学业成绩（None 表示缺数据）
            score_after:  近期平均学业成绩（None 表示缺数据）
            factor_values: {key: (before, after)} 各维度原生前后值
            sensitivities: {key: float} 灵敏度（默认用类常量）
            factor_labels: {key: str} 展示名

        Returns:
            dict: {has_data, total_change, score_before, score_after, confidence,
                   factors:[...], summary}
        """
        sensitivities = sensitivities or SENSITIVITY
        factor_labels = factor_labels or FACTOR_LABELS

        # 缺少成绩对比数据 → 无法归因
        if score_before is None or score_after is None:
            return {
                "has_data": False,
                "total_change": 0.0,
                "score_before": score_before,
                "score_after": score_after,
                "confidence": 0.0,
                "factors": [],
                "summary": "仅近期或前期缺少考试数据，无法对比归因",
            }

        total_change = float(score_after - score_before)
        eps = 1e-9

        # 计算各维度原始影响（delta × 灵敏度）
        impacts: Dict[str, float] = {}
        for key, (before, after) in factor_values.items():
            before = 0.0 if before is None else float(before)
            after = 0.0 if after is None else float(after)
            delta = after - before
            impacts[key] = delta * float(sensitivities.get(key, 1.0))

        total_signed = sum(impacts.values())
        factors: List[Dict] = []

        if abs(total_signed) < eps:
            # 各维度影响相互抵消或均未变化：等分到 total_change（保证贡献度和=净变化）
            n = max(len(impacts), 1)
            direction = "neutral" if abs(total_change) < eps else ("positive" if total_change > 0 else "negative")
            for key, (before, after) in factor_values.items():
                delta = (0.0 if after is None else float(after)) - (0.0 if before is None else float(before))
                factors.append(
                    {
                        "key": key,
                        "name": factor_labels.get(key, key),
                        "contribution": round(total_change / n, 2),
                        "direction": direction,
                        "delta": round(delta, 3),
                        "detail": "该维度变化相互抵消，无法单独归因",
                    }
                )
        else:
            for key, (before, after) in factor_values.items():
                before = 0.0 if before is None else float(before)
                after = 0.0 if after is None else float(after)
                delta = after - before
                contribution = total_change * impacts[key] / total_signed
                direction = "positive" if contribution > eps else ("negative" if contribution < -eps else "neutral")
                factors.append(
                    {
                        "key": key,
                        "name": factor_labels.get(key, key),
                        "contribution": round(contribution, 2),
                        "direction": direction,
                        "delta": round(delta, 3),
                        "detail": AttributionService._describe(key, before, after, delta),
                    }
                )

        # 数值稳定性兜底：保证贡献度之和 ≈ 净变化（避免浮点漂移导致前端展示错位）
        contrib_sum = sum(f["contribution"] for f in factors)
        if factors and abs(contrib_sum - total_change) > 0.05 and abs(contrib_sum) > eps:
            scale = total_change / contrib_sum
            for f in factors:
                f["contribution"] = round(f["contribution"] * scale, 2)

        factors.sort(key=lambda f: abs(f["contribution"]), reverse=True)

        return {
            "has_data": True,
            "total_change": round(total_change, 2),
            "score_before": round(score_before, 2),
            "score_after": round(score_after, 2),
            "confidence": 0.0,  # 由 DB 层覆盖
            "factors": factors,
            "summary": AttributionService._summarize(total_change, factors),
        }

    @staticmethod
    def _describe(key: str, before: float, after: float, delta: float) -> str:
        if key == "behavior":
            return f"行为积分日均 {after:+.2f}（前期 {before:+.2f}），变化 {delta:+.2f}"
        if key == "attendance":
            return f"出勤率 {after * 100:.0f}%（前期 {before * 100:.0f}%）"
        if key == "homework":
            return f"作业提交率 {after * 100:.0f}%（前期 {before * 100:.0f}%）"
        return f"变化 {delta:+.3f}"

    @staticmethod
    def _summarize(total_change: float, factors: List[Dict]) -> str:
        if not factors:
            return "成绩波动较小，各维度无明显变化"
        direction_word = "上升" if total_change > 0 else ("下降" if total_change < 0 else "基本持平")
        top = factors[0]
        return (
            f"成绩较前期{direction_word} {abs(total_change):.1f} 分，"
            f"主要归因于{top['name']}（贡献 {top['contribution']:+.1f} 分）"
        )

    # ------------------------------------------------------------------
    # DB 包装层
    # ------------------------------------------------------------------
    @staticmethod
    def analyze_score_attribution(user_id: int, days: int = 30) -> Dict:
        """分析单名学生成绩波动归因。

        Args:
            user_id: 学生 ID
            days:    每个对比窗口的天数（近期窗口 = [now-days, now]，前期窗口 = [now-2*days, now-days]）

        Returns:
            dict: 归因结果（含 has_data / confidence / factors 等）
        """
        user = get_by_id(User, user_id)
        if not user:
            return {"user_id": user_id, "error": "学生不存在"}

        days = max(int(days), 1)
        now = datetime.now()
        recent_start = now - timedelta(days=days)
        prior_start = now - timedelta(days=2 * days)
        prior_end = recent_start

        # 学业成绩：按考试日期聚合每个窗口的平均分
        score_before, score_after, exam_counts = AttributionService._score_windows(
            user_id, prior_start, prior_end, recent_start, now
        )

        # 行为积分：日均分值
        behavior_before = AttributionService._avg_daily_points(user_id, prior_start, prior_end)
        behavior_after = AttributionService._avg_daily_points(user_id, recent_start, now)

        # 出勤率
        att_before = AttributionService._attendance_rate(user_id, prior_start, prior_end)
        att_after = AttributionService._attendance_rate(user_id, recent_start, now)

        # 作业提交率
        hw_before = AttributionService._homework_rate(user_id, prior_start, prior_end)
        hw_after = AttributionService._homework_rate(user_id, recent_start, now)

        factor_values = {
            "behavior": (behavior_before, behavior_after),
            "attendance": (att_before, att_after),
            "homework": (hw_before, hw_after),
        }

        result = AttributionService.attribute_score_change(score_before, score_after, factor_values)
        result["confidence"] = AttributionService._confidence(
            score_before, score_after, exam_counts, behavior_before is not None, att_before is not None, hw_after is not None
        )
        result["user_id"] = user_id
        result["name"] = user.name
        result["class_name"] = getattr(user, "class_name", "") or ""
        return result

    @staticmethod
    def batch_analyze(class_name: str, days: int = 30) -> Dict:
        """批量分析某班级全部学生的成绩波动归因。

        Args:
            class_name: 班级名称（对应 User.class_name）；为空则直接返回空结果
            days:       每个对比窗口天数（透传给 analyze_score_attribution）

        Returns:
            dict: {
                class_name, days, total, analyzed, with_data, failed,
                students:   [单生归因结果（含 has_data/factors 等，原生类型）],
                failed_students: [隔离捕获的单生异常 {user_id,name,class_name,error}],
            }
        设计要点：单名学生异常（DB 查询失败等）被隔离进 failed_students，
        不影响其余学生与整体响应；所有数值均走 float()/int() 转原生类型，
        避免 numpy 类型导致 Flask JSON 序列化失败。
        """
        days = max(int(days), 1)
        users = User.query.filter(User.class_name == class_name).all() if class_name else []
        total = len(users)
        students: List[Dict] = []
        failed_students: List[Dict] = []
        with_data = 0

        for u in users:
            try:
                res = AttributionService.analyze_score_attribution(u.id, days)
                if res.get("has_data"):
                    with_data += 1
                students.append(res)
            except Exception as exc:  # 单生异常隔离，保证全班其余结果可用
                failed_students.append(
                    {
                        "user_id": int(u.id),
                        "name": u.name,
                        "class_name": getattr(u, "class_name", "") or "",
                        "error": str(exc),
                    }
                )

        return {
            "class_name": class_name or "",
            "days": int(days),
            "total": int(total),
            "analyzed": int(len(students)),
            "with_data": int(with_data),
            "failed": int(len(failed_students)),
            "students": students,
            "failed_students": failed_students,
        }

    @staticmethod
    def _score_windows(user_id, prior_start, prior_end, recent_start, now):
        """返回 (前期均分, 近期均分, (前期考试数, 近期考试数))。无成绩返回 (None, None, counts)。"""
        before_rows = (
            Score.query.join(Exam, Score.exam_id == Exam.id)
            .filter(Score.student_id == user_id, Exam.date >= prior_start, Exam.date < prior_end)
            .all()
        )
        after_rows = (
            Score.query.join(Exam, Score.exam_id == Exam.id)
            .filter(Score.student_id == user_id, Exam.date >= recent_start, Exam.date < now)
            .all()
        )
        before_vals = [r.score for r in before_rows if r.score is not None]
        after_vals = [r.score for r in after_rows if r.score is not None]
        score_before = float(np.mean(before_vals)) if before_vals else None
        score_after = float(np.mean(after_vals)) if after_vals else None
        return score_before, score_after, (len(before_rows), len(after_rows))

    @staticmethod
    def _avg_daily_points(user_id, start, end):
        """返回窗口内行为积分日均分值；无记录返回 None。"""
        rows = (
            ScoreRecord.query.filter(
                ScoreRecord.student_id == user_id,
                ScoreRecord.created_at >= start,
                ScoreRecord.created_at < end,
            )
            .all()
        )
        if not rows:
            return None
        total = sum(r.score_change for r in rows)
        days_span = max((end - start).days, 1)
        return total / days_span

    @staticmethod
    def _attendance_rate(user_id, start, end):
        """返回窗口内出勤率（present/late 计为出勤）；无记录返回 None。"""
        start_d = start.date()
        end_d = end.date()
        rows = (
            Attendance.query.filter(
                Attendance.student_id == user_id,
                Attendance.date >= start_d,
                Attendance.date < end_d,
            )
            .all()
        )
        if not rows:
            return None
        attended = sum(1 for r in rows if r.status in ("present", "late", "early"))
        return attended / len(rows)

    @staticmethod
    def _homework_rate(user_id, start, end):
        """返回窗口内作业提交率（按已提交记录计）；无记录返回 None。"""
        rows = (
            HomeworkSubmission.query.filter(
                HomeworkSubmission.student_id == user_id,
                HomeworkSubmission.submitted_at >= start,
                HomeworkSubmission.submitted_at < end,
            )
            .all()
        )
        if not rows:
            return None
        submitted = sum(1 for r in rows if r.is_submitted)
        return submitted / len(rows)

    @staticmethod
    def _confidence(score_before, score_after, exam_counts, has_behavior, has_att, has_hw):
        """依据数据充分度估算置信度（0~0.95）。"""
        if score_before is None or score_after is None:
            return 0.0
        conf = 0.5
        if exam_counts[0] >= 1 and exam_counts[1] >= 1:
            conf += 0.15
        if (exam_counts[0] + exam_counts[1]) >= 4:
            conf += 0.1
        present = sum(1 for x in (has_behavior, has_att, has_hw) if x)
        conf += 0.1 * present
        return round(min(0.95, conf), 2)
