"""班级学期报告算法摘要聚合。

把参与度 / 风险 / 归因的算法结果聚合成适合写入导出文档的结构化摘要，
供 `/api/reports/class-semester` 的 Excel「算法摘要」sheet 与 CSV 头部摘要行使用。

设计要点：
- 三个维度（参与度 / 风险 / 归因）各自 try/except 隔离：单维计算失败置 None，
  不影响其余维度与主表格导出（摘要只是附加内容，失败不阻塞报告本身）；
- 全部数值转原生 float/int，避免 numpy 类型在 Excel/CSV 序列化时报错；
- 复用既有 batch 接口（batch_rank / predict_batch / batch_analyze），
  与算法 Tab 数据口径完全一致。
"""

from collections import defaultdict
from datetime import datetime

from services.engagement_service import batch_rank
from services.risk_predict_service import RiskPredictService
from services.attribution_service import AttributionService


def build_class_summary(class_name: str, days: int = 30) -> dict:
    """聚合班级算法摘要。

    Args:
        class_name: 班级名称（对应 User.class_name）
        days: 统计窗口天数（透传给各 batch 接口）

    Returns:
        dict: {
            class_name, days, generated_at,
            participation: {total, valid_students, avg_score, level_distribution} | None,
            risk:          {total, high, medium, risk_students:[{name,level,score}]} | None,
            attribution:   {total, analyzed, with_data, top_factors:[{name,count,avg_contribution}]} | None,
        }
    """
    summary = {
        "class_name": class_name,
        "days": int(days),
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "participation": None,
        "risk": None,
        "attribution": None,
    }

    # —— 参与度：均值 + 等级分布 ——
    try:
        pr = batch_rank(class_name, days)
        students = [s for s in pr.get("students", []) if s.get("has_data")]
        scores = [float(s["engagement_score"]) for s in students]
        levels: dict = defaultdict(int)
        for s in students:
            levels[s.get("level") or "low"] += 1
        summary["participation"] = {
            "total": int(pr.get("total", 0)),
            "valid_students": len(students),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "level_distribution": {
                "high": int(levels.get("high", 0)),
                "medium": int(levels.get("medium", 0)),
                "low": int(levels.get("low", 0)),
            },
        }
    except Exception:  # noqa: BLE001 - 摘要维度隔离
        summary["participation"] = None

    # —— 风险：高/中风险名单 ——
    try:
        rp = RiskPredictService.predict_batch(class_name, days)
        results = rp.get("results", [])
        risk_students = [
            {
                "name": r.get("name", ""),
                "level": r.get("overall_risk_level", "low"),
                "score": round(float(r.get("overall_risk_score", 0) or 0), 2),
            }
            for r in results
            if r.get("overall_risk_level") in ("high", "medium")
        ]
        risk_students.sort(key=lambda x: x["score"], reverse=True)
        s = rp.get("summary", {})
        summary["risk"] = {
            "total": int(s.get("total_students", 0)),
            "high": int(s.get("high_risk", 0)),
            "medium": int(s.get("medium_risk", 0)),
            "risk_students": risk_students[:10],
        }
    except Exception:  # noqa: BLE001
        summary["risk"] = None

    # —— 归因：班级 top 因子（按贡献聚合所有学生） ——
    try:
        ab = AttributionService.batch_analyze(class_name, days)
        factor_map = defaultdict(lambda: {"count": 0, "contrib": 0.0})
        for st in ab.get("students", []):
            if not st.get("has_data"):
                continue
            for f in st.get("factors", []):
                name = f.get("name", "unknown")
                factor_map[name]["count"] += 1
                factor_map[name]["contrib"] += float(f.get("contribution", 0) or 0)
        top = [
            {
                "name": name,
                "count": agg["count"],
                "avg_contribution": round(agg["contrib"] / agg["count"], 2),
            }
            for name, agg in factor_map.items()
        ]
        top.sort(key=lambda x: abs(x["avg_contribution"]) * x["count"], reverse=True)
        summary["attribution"] = {
            "total": int(ab.get("total", 0)),
            "analyzed": int(ab.get("analyzed", 0)),
            "with_data": int(ab.get("with_data", 0)),
            "top_factors": top[:5],
        }
    except Exception:  # noqa: BLE001
        summary["attribution"] = None

    return summary


def summary_to_rows(summary: dict) -> list:
    """把算法摘要转成 [项目, 内容] 二维行，供 Excel sheet / CSV 摘要行使用。

    项目列固定为「算法摘要 / 参与度… / 风险… / 归因…」，内容列聚合可读文本。
    """
    rows = [["算法摘要", "生成时间: %s" % (summary.get("generated_at") or "")]]

    p = summary.get("participation")
    if p:
        avg = p.get("avg_score")
        rows.append(["参与度均值", "%.1f" % avg if avg is not None else "无数据"])
        dist = p.get("level_distribution", {})
        rows.append(
            [
                "参与度等级分布",
                "高:%d 中:%d 低:%d"
                % (dist.get("high", 0), dist.get("medium", 0), dist.get("low", 0)),
            ]
        )
        rows.append(["参与度有效人数", "%d/%d" % (p.get("valid_students", 0), p.get("total", 0))])
    else:
        rows.append(["参与度", "无数据或计算失败"])

    r = summary.get("risk")
    if r:
        rows.append(["风险预警", "高:%d 中:%d" % (r.get("high", 0), r.get("medium", 0))])
        if r.get("risk_students"):
            names = "、".join(s["name"] for s in r["risk_students"][:8])
            rows.append(["风险名单", names])
    else:
        rows.append(["风险", "无数据或计算失败"])

    a = summary.get("attribution")
    if a and a.get("top_factors"):
        parts = ["%s(均%.2f)" % (f["name"], f["avg_contribution"]) for f in a["top_factors"]]
        rows.append(["成绩波动主因", "；".join(parts)])
    elif a:
        rows.append(["成绩波动归因", "无足够数据"])
    else:
        rows.append(["归因", "无数据或计算失败"])

    return rows
