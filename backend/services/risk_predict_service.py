import json
import os
import time
from datetime import datetime, timedelta, timezone

from models import User, ScoreRecord, get_by_id, db
import numpy as np


class RiskPredictService:
    RISK_LEVELS = {
        "high": {
            "name": "高风险",
            "color": "red",
            "description": "需要立即干预",
            "actions": ["安排辅导员谈话", "联系家长沟通", "制定帮扶计划"],
        },
        "medium": {
            "name": "中风险",
            "color": "yellow",
            "description": "需要关注",
            "actions": ["定期关注表现", "与学生沟通", "提供学习建议"],
        },
        "low": {
            "name": "低风险",
            "color": "green",
            "description": "正常关注",
            "actions": ["保持常规关注"],
        },
    }

    RISK_TYPES = {
        "academic": {"name": "学业风险", "description": "成绩下降趋势"},
        "behavior": {"name": "行为风险", "description": "积分持续下降"},
        "attendance": {"name": "出勤风险", "description": "出勤率偏低"},
        "comprehensive": {"name": "综合风险", "description": "多维度综合评估"},
    }

    # 综合风险类型默认权重（未被 train_risk_model 训练覆盖时回退使用）
    DEFAULT_WEIGHTS = {"academic": 0.4, "behavior": 0.35, "attendance": 0.25}

    # RP5：班级聚合缓存（按 (class_name, days) 复用，60s TTL），
    # 避免每个学生都全量加载同班同学导致的 O(学生×班级人数) 查询放大。
    _class_agg_cache = {}
    _class_agg_cache_ts = {}
    _class_agg_cache_ttl = 60

    @staticmethod
    def _model_config_path():
        """返回训练模型配置落盘路径（位于 backend/instance，已被 gitignore 忽略）。"""
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, "instance", "risk_model_config.json")

    @staticmethod
    def _load_model_config():
        """读取已训练模型配置；不存在或解析失败时返回空字典。"""
        path = RiskPredictService._model_config_path()
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:  # noqa: BLE001
            pass
        return {}

    @staticmethod
    def _save_model_config(config):
        """持久化训练模型配置（best-effort，写入失败不影响主流程）。"""
        path = RiskPredictService._model_config_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _resolve_weights():
        """返回综合风险权重：优先用训练得到的，否则回退默认。"""
        cfg = RiskPredictService._load_model_config()
        weights = cfg.get("risk_type_weights")
        if not isinstance(weights, dict) or not all(
            k in weights for k in RiskPredictService.DEFAULT_WEIGHTS
        ):
            return dict(RiskPredictService.DEFAULT_WEIGHTS)
        if sum(float(v) for v in weights.values()) <= 0:
            return dict(RiskPredictService.DEFAULT_WEIGHTS)
        return {k: float(weights[k]) for k in RiskPredictService.DEFAULT_WEIGHTS}

    @staticmethod
    def _get_detection_thresholds():
        """返回各风险检测阈值；优先用训练得到的 optimal_thresholds，否则回退固定默认值。

        注：训练产出的 optimal_thresholds 此前从未被预测使用（RP3 修复），
        此处使其真正生效；未训练时阈值与历史硬编码值一致，零行为变化。
        """
        defaults = {
            "score_trend_30d": -0.5,
            "score_trend_7d": -1,
            "class_percentile": 30,
            "score_decline_rate": -0.1,
            "positive_rate": 0.2,
            "negative_rate": 0.5,
        }
        cfg = RiskPredictService._load_model_config()
        trained = cfg.get("optimal_thresholds", {}) or {}
        # RP3：仅在训练样本充足时才应用训练阈值，避免极小样本/陈旧训练产出的
        # 垃圾阈值无声改变线上风险分级（违反零回归原则）。未训练或样本不足时
        # 回退默认值，与历史硬编码行为一致、零行为变化。
        if cfg.get("valid_students", 0) >= 20 and trained:
            merged = dict(defaults)
            for k, v in trained.items():
                if k in defaults and isinstance(v, (int, float)):
                    merged[k] = v
            return merged
        return dict(defaults)

    @staticmethod
    def _get_class_aggregates(class_name, days):
        """返回班级 current_score 聚合（scores 列表 / mean / std）；无同班同学时返回 None。

        单条聚合查询取班级所有 current_score，O(1) 替代逐生加载全量 User 对象；
        用短 TTL 进程内缓存复用，避免批量/训练接口放大为 O(N^2)。
        """
        key = (class_name, days)
        now = time.time()
        cached = RiskPredictService._class_agg_cache.get(key)
        cached_ts = RiskPredictService._class_agg_cache_ts.get(key, 0)
        if cached is not None and (now - cached_ts) < RiskPredictService._class_agg_cache_ttl:
            return cached

        scores = [
            s
            for (s,) in db.session.query(User.current_score)
            .filter(User.class_name == class_name)
            .all()
        ]
        agg = None
        if scores:
            arr = np.array(scores, dtype=float)
            agg = {
                "scores": scores,
                "mean": float(np.mean(arr)),
                "std": float(np.std(arr)),
            }
        RiskPredictService._class_agg_cache[key] = agg
        RiskPredictService._class_agg_cache_ts[key] = now
        return agg

    @staticmethod
    def get_risk_features(user_id, days=30):
        """
        获取风险特征数据

        Args:
            user_id: 学生ID
            days: 统计天数

        Returns:
            dict: 风险特征
        """
        user = get_by_id(User, user_id)
        if not user:
            return None

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        records = (
            ScoreRecord.query.filter(
                ScoreRecord.student_id == user_id,
                ScoreRecord.created_at >= start_date,
            )
            .order_by(ScoreRecord.created_at)
            .all()
        )

        features = {
            "user_id": user_id,
            "name": user.name,
            "class_name": user.class_name,
            "current_score": user.current_score,
            "total_records": len(records),
        }

        if records:
            score_changes = [r.score_change for r in records]

            # 积分趋势特征
            cumulative_scores = []
            current = user.current_score - sum(score_changes)
            for change in score_changes:
                current += change
                cumulative_scores.append(current)

            if len(cumulative_scores) >= 2:
                x = np.arange(len(cumulative_scores))
                y = np.array(cumulative_scores)
                slope_7d = 0
                slope_30d = np.polyfit(x, y, 1)[0]

                if len(cumulative_scores) >= 7:
                    x_7d = np.arange(7)
                    y_7d = np.array(cumulative_scores[-7:])
                    slope_7d = np.polyfit(x_7d, y_7d, 1)[0]

                features["score_trend_7d"] = round(slope_7d, 2)
                features["score_trend_30d"] = round(slope_30d, 2)
            else:
                features["score_trend_7d"] = 0.0
                features["score_trend_30d"] = 0.0

            # 波动性特征
            features["score_volatility"] = round(np.std(score_changes), 2)

            # 正向/负向统计
            positive_count = sum(1 for c in score_changes if c > 0)
            negative_count = sum(1 for c in score_changes if c < 0)
            features["positive_rate"] = round(positive_count / len(score_changes), 2)
            features["negative_rate"] = round(negative_count / len(score_changes), 2)

            # 连续无正向积分天数
            features["no_positive_days"] = RiskPredictService._count_consecutive_no_positive(
                score_changes
            )

            # 日均解锁次数（简化为记录数）
            features["daily_record_count"] = round(len(records) / days, 2)

            # 下降率
            if len(cumulative_scores) >= 14:
                earlier_avg = np.mean(cumulative_scores[:-7])
                recent_avg = np.mean(cumulative_scores[-7:])
                features["score_decline_rate"] = round(
                    (recent_avg - earlier_avg) / (earlier_avg + 1), 2
                )
            else:
                features["score_decline_rate"] = 0.0
        else:
            features["score_trend_7d"] = 0.0
            features["score_trend_30d"] = 0.0
            features["score_volatility"] = 0.0
            features["positive_rate"] = 0.0
            features["negative_rate"] = 0.0
            features["no_positive_days"] = days
            features["daily_record_count"] = 0.0
            features["score_decline_rate"] = 0.0

        # 真实出勤特征：直接读取 attendance 表（替代原 score_record 活跃度代理）。
        # 无考勤记录时返回 None，detect_attendance_risk 会回退到代理判断，保持历史行为不变。
        attendance_rate, absent_count, late_count, total_attendance, leave_days = (
            RiskPredictService._get_attendance_stats(user_id, start_date, end_date)
        )
        features["attendance_rate"] = attendance_rate
        features["attendance_absent_count"] = absent_count
        features["attendance_late_count"] = late_count
        features["attendance_total"] = total_attendance
        features["attendance_leave_days"] = leave_days

        # 班级对比特征（RP5：经 _get_class_aggregates 复用单条聚合 + 短 TTL 缓存，
        # 消除逐生全量加载同班同学的 O(N^2) 放大）
        agg = RiskPredictService._get_class_aggregates(user.class_name, days)
        if agg:
            scores = agg["scores"]
            class_avg = agg["mean"]
            class_std = agg["std"]

            features["score_deviation_from_avg"] = round(user.current_score - class_avg, 2)
            features["z_score"] = round((user.current_score - class_avg) / (class_std + 0.1), 2)
            features["class_rank"] = sum(1 for s in scores if s > user.current_score) + 1
            features["class_percentile"] = round(
                (len(scores) - features["class_rank"] + 1) / len(scores) * 100,
                2,
            )
        else:
            features["score_deviation_from_avg"] = 0.0
            features["z_score"] = 0.0
            features["class_rank"] = 1
            features["class_percentile"] = 100.0

        return features

    @staticmethod
    def _count_consecutive_no_positive(changes):
        """计算连续无正向积分天数"""
        max_count = 0
        current_count = 0
        for c in changes:
            if c <= 0:
                current_count += 1
                max_count = max(max_count, current_count)
            else:
                current_count = 0
        return max_count

    @staticmethod
    def _get_attendance_stats(user_id, start_date, end_date):
        """从 attendance 表读取真实出勤统计。

        Returns:
            (attendance_rate, absent_count, late_count, total, leave_days)
            - attendance_rate：出勤率（出勤+迟到 占 总记录），无记录或异常时返回 None 以触发代理回退。
            - leave_days：统计窗口内已批准请假天数（不计入缺勤风险）。
        """
        try:
            from models import Attendance, Approval

            s_date = start_date.date() if isinstance(start_date, datetime) else start_date
            e_date = end_date.date() if isinstance(end_date, datetime) else end_date

            records = Attendance.query.filter(
                Attendance.student_id == user_id,
                Attendance.date >= s_date,
                Attendance.date <= e_date,
            ).all()
            total = len(records)
            if total == 0:
                return None, 0, 0, 0, 0

            # 出勤 = 出勤 + 迟到（迟到视为已到）；缺勤为未到
            attended = sum(1 for r in records if r.status in ("present", "late"))
            absent = sum(1 for r in records if r.status == "absent")
            late = sum(1 for r in records if r.status == "late")
            rate = round(attended / total, 3)

            # 已批准的请假不计入缺勤风险
            leaves = Approval.query.filter(
                Approval.student_id == user_id,
                Approval.type == "leave",
                Approval.status == "approved",
                Approval.start_date <= e_date,
                Approval.end_date >= s_date,
            ).all()
            leave_days = 0
            for lv in leaves:
                ls = max(lv.start_date, s_date)
                le = min(lv.end_date, e_date)
                if le >= ls:
                    leave_days += (le - ls).days + 1

            return rate, absent, late, total, leave_days
        except Exception:  # noqa: BLE001
            # 诚实失败：全 None 传导，调用方（detect_attendance_risk）见 attendance_rate=None
            # 走代理回退，不把缺勤/迟到伪装成 0（避免系统故障被读作"表现正常"）。
            return None, None, None, None, None

    @staticmethod
    def detect_score_risk(features):
        """
        检测积分（成绩）下降趋势风险

        注：历史上命名为 detect_academic_risk，本平台为积分管理系统，
        实际评估的是 score_trend / class_percentile / score_decline_rate
        等积分维度，故重命名为 detect_score_risk。风险类型键仍沿用
        RISK_TYPES["academic"] 以保持 API 契约稳定。

        Args:
            features: 风险特征

        Returns:
            dict: 积分风险检测结果
        """
        risk_score = 0.0
        factors = []
        th = RiskPredictService._get_detection_thresholds()

        # 积分趋势下降
        if features["score_trend_30d"] < th["score_trend_30d"]:
            risk_score += 0.3
            factors.append(
                {
                    "factor": "score_trend_30d",
                    "score": features["score_trend_30d"],
                    "description": "积分持续下降",
                }
            )

        # 近期趋势下降
        if features["score_trend_7d"] < th["score_trend_7d"]:
            risk_score += 0.2
            factors.append(
                {
                    "factor": "score_trend_7d",
                    "score": features["score_trend_7d"],
                    "description": "近期积分急剧下降",
                }
            )

        # 班级排名靠后
        if features["class_percentile"] < th["class_percentile"]:
            risk_score += 0.25
            factors.append(
                {
                    "factor": "class_percentile",
                    "score": features["class_percentile"],
                    "description": "班级排名靠后",
                }
            )

        # 下降率高
        if features["score_decline_rate"] < th["score_decline_rate"]:
            risk_score += 0.15
            factors.append(
                {
                    "factor": "score_decline_rate",
                    "score": features["score_decline_rate"],
                    "description": "积分下降率高",
                }
            )

        # RP2：risk_score 裁剪到 [0,1]，与各 detect 的 0.7/0.4 阈值及综合加权口径一致
        risk_score = min(1.0, max(0.0, risk_score))

        # 确定风险级别
        if risk_score >= 0.7:
            level = "high"
        elif risk_score >= 0.4:
            level = "medium"
        else:
            level = "low"

        return {
            "type": "academic",
            "name": RiskPredictService.RISK_TYPES["academic"]["name"],
            "risk_level": level,
            "risk_score": round(risk_score, 2),
            "factors": factors,
            "description": RiskPredictService.RISK_TYPES["academic"]["description"],
        }

    @staticmethod
    def detect_behavior_risk(features):
        """
        检测行为风险

        Args:
            features: 风险特征

        Returns:
            dict: 行为风险检测结果
        """
        risk_score = 0.0
        factors = []
        th = RiskPredictService._get_detection_thresholds()

        # 连续无正向积分天数
        if features["no_positive_days"] >= 7:
            risk_score += 0.3
            factors.append(
                {
                    "factor": "no_positive_days",
                    "score": features["no_positive_days"],
                    "description": "连续多日无正向积分",
                }
            )
        elif features["no_positive_days"] >= 3:
            risk_score += 0.15

        # 负向积分率高
        if features["negative_rate"] > th["negative_rate"]:
            risk_score += 0.25
            factors.append(
                {
                    "factor": "negative_rate",
                    "score": features["negative_rate"],
                    "description": "负向积分占比高",
                }
            )

        # 正向积分率低
        if features["positive_rate"] < th["positive_rate"]:
            risk_score += 0.2
            factors.append(
                {
                    "factor": "positive_rate",
                    "score": features["positive_rate"],
                    "description": "正向积分获取少",
                }
            )

        # 日均记录数少
        if features["daily_record_count"] < 0.5:
            risk_score += 0.15
            factors.append(
                {
                    "factor": "daily_record_count",
                    "score": features["daily_record_count"],
                    "description": "活跃度低",
                }
            )

        # RP2：risk_score 裁剪到 [0,1]，与各 detect 的 0.7/0.4 阈值及综合加权口径一致
        risk_score = min(1.0, max(0.0, risk_score))

        # 确定风险级别
        if risk_score >= 0.7:
            level = "high"
        elif risk_score >= 0.4:
            level = "medium"
        else:
            level = "low"

        return {
            "type": "behavior",
            "name": RiskPredictService.RISK_TYPES["behavior"]["name"],
            "risk_level": level,
            "risk_score": round(risk_score, 2),
            "factors": factors,
            "description": RiskPredictService.RISK_TYPES["behavior"]["description"],
        }

    @staticmethod
    def detect_attendance_risk(features):
        """
        检测出動风险。

        优先使用真实考勤数据（attendance 表）：出勤率、缺勤次数、请假天数。
        若系统中无考勤记录（features["attendance_rate"] 为 None），则回退到基于
        ScoreRecord 活跃度的代理判断，保持历史行为不变。

        Args:
            features: 风险特征

        Returns:
            dict: 出勤风险检测结果
        """
        risk_score = 0.0
        factors = []

        attendance_rate = features.get("attendance_rate")
        if attendance_rate is not None:
            # —— 真实考勤路径 ——
            if attendance_rate < 0.6:
                risk_score += 0.5
                factors.append(
                    {
                        "factor": "attendance_rate",
                        "score": attendance_rate,
                        "description": "出勤率偏低，存在出勤问题",
                    }
                )
                if attendance_rate < 0.4:
                    risk_score += 0.2
                    factors.append(
                        {
                            "factor": "attendance_rate_severe",
                            "score": attendance_rate,
                            "description": "出勤率极低，存在严重出勤问题",
                        }
                    )
            elif attendance_rate < 0.8:
                risk_score += 0.4
                factors.append(
                    {
                        "factor": "attendance_rate",
                        "score": attendance_rate,
                        "description": "出勤率偏低",
                    }
                )

            if features.get("attendance_absent_count", 0) >= 5:
                risk_score += 0.2
                factors.append(
                    {
                        "factor": "attendance_absent_count",
                        "score": features["attendance_absent_count"],
                        "description": "缺勤次数较多",
                    }
                )

            if features.get("attendance_leave_days", 0) >= 10:
                risk_score += 0.1
                factors.append(
                    {
                        "factor": "attendance_leave_days",
                        "score": features["attendance_leave_days"],
                        "description": "请假天数较多",
                    }
                )
        else:
            # —— 代理回退路径（无真实考勤数据时，与原逻辑一致）——
            # 活跃度低可能意味着出勤问题
            if features["daily_record_count"] < 0.3:
                risk_score += 0.4
                factors.append(
                    {
                        "factor": "daily_record_count",
                        "score": features["daily_record_count"],
                        "description": "活跃度极低，可能存在出勤问题",
                    }
                )
            elif features["daily_record_count"] < 0.5:
                risk_score += 0.2

            # 积分波动大可能意味着出勤不稳定
            if features["score_volatility"] > 5:
                risk_score += 0.2
                factors.append(
                    {
                        "factor": "score_volatility",
                        "score": features["score_volatility"],
                        "description": "积分波动大，出勤可能不稳定",
                    }
                )

            # 近期无活动
            if features["total_records"] == 0:
                risk_score += 0.3
                factors.append(
                    {
                        "factor": "total_records",
                        "score": 0,
                        "description": "近期无任何活动记录",
                    }
                )

        # RP2：risk_score 裁剪到 [0,1]，与各 detect 的 0.7/0.4 阈值及综合加权口径一致
        risk_score = min(1.0, max(0.0, risk_score))

        # 确定风险级别
        if risk_score >= 0.7:
            level = "high"
        elif risk_score >= 0.4:
            level = "medium"
        else:
            level = "low"

        return {
            "type": "attendance",
            "name": RiskPredictService.RISK_TYPES["attendance"]["name"],
            "risk_level": level,
            "risk_score": round(risk_score, 2),
            "factors": factors,
            "description": RiskPredictService.RISK_TYPES["attendance"]["description"],
        }

    @staticmethod
    def predict_risk(user_id, days=30):
        """
        预测学生风险

        Args:
            user_id: 学生ID
            days: 统计天数

        Returns:
            dict: 风险预测结果
        """
        features = RiskPredictService.get_risk_features(user_id, days)

        if not features:
            return {"user_id": user_id, "error": "学生不存在"}

        # 检测各类型风险
        academic_risk = RiskPredictService.detect_score_risk(features)
        behavior_risk = RiskPredictService.detect_behavior_risk(features)
        attendance_risk = RiskPredictService.detect_attendance_risk(features)

        # 综合风险评估
        risk_types = [academic_risk, behavior_risk, attendance_risk]

        # 计算综合风险评分（加权），权重来自训练结果，未训练时回退默认
        weights = RiskPredictService._resolve_weights()
        overall_score = sum(r["risk_score"] * weights[r["type"]] for r in risk_types)

        # 确定综合风险级别
        if overall_score >= 0.7:
            overall_level = "high"
        elif overall_score >= 0.4:
            overall_level = "medium"
        else:
            overall_level = "low"

        # 获取所有风险因素
        all_factors = []
        for risk in risk_types:
            all_factors.extend(risk["factors"])

        # RP1：按统一「严重度」降序排因素——不同因子的 score 方向不同
        # （如 class_percentile 越低越坏、no_positive_days 越高越坏），原排序因正负号
        # 混用导致良性高值（如 percentile=95）被排到最前。这里按因子语义归一为
        # severity（越高越坏）后再降序，确保 Top5 风险因子排序正确。
        _FACTOR_SEVERITY_DIR = {
            "score_trend_30d": "lower_worse",
            "score_trend_7d": "lower_worse",
            "class_percentile": "lower_worse",
            "score_decline_rate": "lower_worse",
            "no_positive_days": "higher_worse",
            "negative_rate": "higher_worse",
            "positive_rate": "lower_worse",
            "daily_record_count": "lower_worse",
            "attendance_rate": "lower_worse",
            "attendance_rate_severe": "lower_worse",
            "attendance_absent_count": "higher_worse",
            "attendance_leave_days": "higher_worse",
            "score_volatility": "higher_worse",
            "total_records": "lower_worse",
        }
        for f in all_factors:
            direction = _FACTOR_SEVERITY_DIR.get(f.get("factor"), "lower_worse")
            s = f.get("score", 0) or 0
            f["severity"] = s if direction == "higher_worse" else -s
        all_factors.sort(key=lambda x: x.get("severity", 0), reverse=True)

        # 生成干预建议
        suggestions = []
        if academic_risk["risk_level"] in ["high", "medium"]:
            suggestions.extend(["关注学习状态，提供学习辅导", "分析成绩下降原因"])

        if behavior_risk["risk_level"] in ["high", "medium"]:
            suggestions.extend(["与学生沟通，了解行为变化原因", "制定行为改进计划"])

        if attendance_risk["risk_level"] in ["high", "medium"]:
            suggestions.extend(["核实出勤情况", "联系家长确认学生状态"])

        # 推荐行动
        recommended_actions = RiskPredictService.RISK_LEVELS[overall_level]["actions"]

        return {
            "user_id": user_id,
            "name": features["name"],
            "class_name": features["class_name"],
            "overall_risk_level": overall_level,
            "overall_risk_score": round(overall_score, 2),
            "overall_risk_name": RiskPredictService.RISK_LEVELS[overall_level]["name"],
            "risk_details": {
                "academic": academic_risk,
                "behavior": behavior_risk,
                "attendance": attendance_risk,
            },
            "risk_factors": all_factors[:5],
            "intervention_suggestions": suggestions or ["当前表现正常，继续保持"],
            "recommended_actions": recommended_actions,
            "features": features,
        }

    @staticmethod
    def predict_batch(class_name=None, days=30):
        """
        批量预测风险

        Args:
            class_name: 班级名称（可选）
            days: 统计天数

        Returns:
            dict: 批量风险预测结果
        """
        query = User.query.filter(User.role == "student")
        if class_name:
            query = query.filter(User.class_name == class_name)

        users = query.all()

        results = []
        failed_students = []
        summary = {
            "total_students": len(users),
            "high_risk": 0,
            "medium_risk": 0,
            "low_risk": 0,
            "avg_risk_score": 0.0,
        }

        total_score = 0.0

        for user in users:
            try:
                result = RiskPredictService.predict_risk(user.id, days)
            except Exception as e:  # noqa: BLE001
                # 单生异常隔离：失败学生不影响其余学生与整体响应
                failed_students.append(
                    {
                        "user_id": int(user.id),
                        "name": user.name,
                        "class_name": getattr(user, "class_name", "") or "",
                        "error": str(e),
                    }
                )
                continue
            results.append(result)

            if "overall_risk_score" in result:
                total_score += result["overall_risk_score"]
                if result["overall_risk_level"] == "high":
                    summary["high_risk"] += 1
                elif result["overall_risk_level"] == "medium":
                    summary["medium_risk"] += 1
                else:
                    summary["low_risk"] += 1

        if results:
            summary["avg_risk_score"] = round(total_score / len(results), 2)

        # 按风险级别排序（高风险优先）
        level_order = {"high": 0, "medium": 1, "low": 2}
        results.sort(key=lambda x: level_order.get(x.get("overall_risk_level", "low"), 2))

        return {
            "class_name": class_name,
            "period_days": days,
            "summary": summary,
            "results": results,
            "failed": len(failed_students),
            "failed_students": failed_students,
        }

    @staticmethod
    def get_high_risk_students(days=30):
        """
        获取高风险学生列表

        Args:
            days: 统计天数

        Returns:
            list: 高风险学生列表
        """
        batch_result = RiskPredictService.predict_batch(days=days)
        return [r for r in batch_result["results"] if r.get("overall_risk_level") == "high"]

    @staticmethod
    def train_risk_model(days=90):
        """
        校准风险预测模型权重（启发式，非监督学习训练产物）。

        基于全量学生风险特征的分布（低分位比例、负向率比例、低活跃比例）对
        DEFAULT_WEIGHTS 做 ±0.05 微调并归一化，微调幅度有限；不训练分类器，
        也不产出可供预测直接使用的「最优阈值」之外的监督信号。optimal_thresholds
        仅作为检测阈值的候选覆盖（见 _get_detection_thresholds），并非模型参数。

        Args:
            days: 训练数据天数

        Returns:
            dict: 训练结果（含 feature_distributions / optimal_thresholds / risk_type_weights）
        """
        query = User.query.filter(User.role == "student")
        users = query.all()

        if not users:
            return {
                "status": "error",
                "message": "没有学生数据",
                "model_info": {},
            }

        # 收集风险特征数据
        features_list = []
        valid_users = 0

        for user in users:
            features = RiskPredictService.get_risk_features(user.id, days)
            if features:
                features_list.append(features)
                valid_users += 1

        if not features_list:
            return {
                "status": "error",
                "message": "没有足够的有效训练数据",
                "model_info": {},
            }

        # 分析特征分布
        feature_distributions = {}

        # 积分趋势分布
        trend_30d = [f["score_trend_30d"] for f in features_list]
        trend_7d = [f["score_trend_7d"] for f in features_list]
        feature_distributions["score_trend"] = {
            "avg_30d": round(np.mean(trend_30d), 2),
            "std_30d": round(np.std(trend_30d), 2),
            "avg_7d": round(np.mean(trend_7d), 2),
            "std_7d": round(np.std(trend_7d), 2),
            "negative_30d_ratio": round(sum(1 for t in trend_30d if t < -0.5) / len(trend_30d), 4),
            "negative_7d_ratio": round(sum(1 for t in trend_7d if t < -1) / len(trend_7d), 4),
        }

        # 波动性分布
        volatilities = [f["score_volatility"] for f in features_list]
        feature_distributions["volatility"] = {
            "avg": round(np.mean(volatilities), 2),
            "std": round(np.std(volatilities), 2),
            "high_volatility_ratio": round(
                sum(1 for v in volatilities if v > 5) / len(volatilities), 4
            ),
        }

        # 正负向率分布
        positive_rates = [f["positive_rate"] for f in features_list]
        negative_rates = [f["negative_rate"] for f in features_list]
        feature_distributions["rate"] = {
            "avg_positive_rate": round(np.mean(positive_rates), 2),
            "avg_negative_rate": round(np.mean(negative_rates), 2),
            "low_positive_ratio": round(
                sum(1 for r in positive_rates if r < 0.2) / len(positive_rates),
                4,
            ),
            "high_negative_ratio": round(
                sum(1 for r in negative_rates if r > 0.5) / len(negative_rates),
                4,
            ),
        }

        # 班级排名分布
        percentiles = [f["class_percentile"] for f in features_list]
        feature_distributions["class_rank"] = {
            "avg_percentile": round(np.mean(percentiles), 2),
            "std_percentile": round(np.std(percentiles), 2),
            "low_percentile_ratio": round(
                sum(1 for p in percentiles if p < 30) / len(percentiles), 4
            ),
        }

        # 计算最优阈值（基于数据分布）
        optimal_thresholds = {
            "score_trend_30d": round(np.mean(trend_30d) - np.std(trend_30d), 2),
            "score_trend_7d": round(np.mean(trend_7d) - np.std(trend_7d), 2),
            "positive_rate": round(np.mean(positive_rates) - np.std(positive_rates) * 0.5, 2),
            "negative_rate": round(np.mean(negative_rates) + np.std(negative_rates) * 0.5, 2),
            "class_percentile": round(np.percentile(percentiles, 30), 2),
            "score_volatility": round(np.mean(volatilities) + np.std(volatilities) * 0.5, 2),
        }

        # 风险类型权重（P2-5 修复: 标注为启发式默认权重 + 分布微调；非监督学习训练产物）
        weights = {"academic": 0.4, "behavior": 0.35, "attendance": 0.25}

        # 根据数据分布调整权重
        low_percentile_count = sum(1 for p in percentiles if p < 30)
        if low_percentile_count / len(percentiles) > 0.3:
            weights["academic"] = min(0.5, weights["academic"] + 0.05)

        high_negative_count = sum(1 for r in negative_rates if r > 0.5)
        if high_negative_count / len(negative_rates) > 0.2:
            weights["behavior"] = min(0.45, weights["behavior"] + 0.05)

        low_activity_count = sum(1 for f in features_list if f["daily_record_count"] < 0.5)
        if low_activity_count / len(features_list) > 0.2:
            weights["attendance"] = min(0.35, weights["attendance"] + 0.05)

        # 归一化权重
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: round(v / total_weight, 2) for k, v in weights.items()}

        # 持久化训练结果，使权重重启后仍可被 predict_risk 使用
        RiskPredictService._save_model_config(
            {
                "risk_type_weights": weights,
                "optimal_thresholds": optimal_thresholds,
                "trained_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                "training_data_days": days,
                "valid_students": valid_users,
            }
        )

        return {
            "status": "success",
            "message": f"模型训练完成，使用{valid_users}个学生的风险特征数据",
            "model_info": {
                "training_data_days": days,
                "total_students": len(users),
                "valid_students": valid_users,
                "feature_distributions": feature_distributions,
                "optimal_thresholds": optimal_thresholds,
                "risk_type_weights": weights,
            },
        }

    @staticmethod
    def evaluate_risk_model(days=30):
        """
        评估风险预测结果的描述性指标（无真值对比，非精度/召回评估）。

        仅统计风险分布、风险评分统计量与各类型高风险检出率、Top 风险因子频次；
        系统目前无标注真值（ground truth），故不计算 precision/recall/accuracy。

        Args:
            days: 评估数据天数

        Returns:
            dict: 描述性评估结果（metrics）
        """
        query = User.query.filter(User.role == "student")
        users = query.all()

        if not users:
            return {
                "status": "error",
                "message": "没有学生数据",
                "metrics": {},
            }

        results = []

        for user in users:
            result = RiskPredictService.predict_risk(user.id, days)  # noqa: F841
            if "overall_risk_score" in result:
                results.append(result)

        if len(results) < 2:
            return {
                "status": "error",
                "message": "没有足够的评估数据",
                "metrics": {},
            }

        # 计算评估指标
        high_risk_count = sum(1 for r in results if r["overall_risk_level"] == "high")
        medium_risk_count = sum(1 for r in results if r["overall_risk_level"] == "medium")
        low_risk_count = sum(1 for r in results if r["overall_risk_level"] == "low")

        total_high = high_risk_count + medium_risk_count + low_risk_count

        # 风险分布
        risk_distribution = {
            "high": round(high_risk_count / total_high, 4),
            "medium": round(medium_risk_count / total_high, 4),
            "low": round(low_risk_count / total_high, 4),
        }

        # 风险评分统计
        scores = [r["overall_risk_score"] for r in results]
        score_stats = {
            "avg": round(np.mean(scores), 4),
            "std": round(np.std(scores), 4),
            "min": round(min(scores), 4),
            "max": round(max(scores), 4),
        }

        # 各风险类型的检测率
        academic_high = sum(
            1 for r in results if r["risk_details"]["academic"]["risk_level"] == "high"
        )
        behavior_high = sum(
            1 for r in results if r["risk_details"]["behavior"]["risk_level"] == "high"
        )
        attendance_high = sum(
            1 for r in results if r["risk_details"]["attendance"]["risk_level"] == "high"
        )

        detection_rates = {
            "academic_high_risk": round(academic_high / len(results), 4),
            "behavior_high_risk": round(behavior_high / len(results), 4),
            "attendance_high_risk": round(attendance_high / len(results), 4),
            "any_high_risk": round(high_risk_count / len(results), 4),
        }

        # 风险因素分析
        all_factors = []
        for r in results:
            all_factors.extend(r.get("risk_factors", []))

        factor_counts = {}
        for factor in all_factors:
            factor_name = factor.get("factor", "unknown")
            factor_counts[factor_name] = factor_counts.get(factor_name, 0) + 1

        # 按出现次数排序
        sorted_factors = sorted(factor_counts.items(), key=lambda x: x[1], reverse=True)

        return {
            "status": "success",
            "message": "模型评估完成",
            "metrics": {
                "evaluation_data_days": days,
                "total_students": len(users),
                "evaluated_students": len(results),
                "risk_distribution": risk_distribution,
                "risk_score_stats": score_stats,
                "detection_rates": detection_rates,
                "top_risk_factors": (
                    [
                        {
                            "factor": f[0],
                            "count": f[1],
                            "percentage": round(f[1] / len(all_factors) * 100, 2),
                        }
                        for f in sorted_factors[:5]
                    ]
                    if all_factors
                    else []
                ),
                "total_risk_factors": len(all_factors),
            },
        }
