"""算法分析结果导出服务层（T9 路由瘦身：把 algorithm_routes._build_export_rows 内联编排下沉）。

仅做读路径的行列组装（纯数据整形），不含任何写入/事务。三维度分别委托既有
读服务 EngagementService / AttributionService / RiskPredictService，行为与原路由内联函数逐字节一致。

导出行拼装逻辑集中在此，路由 AlgorithmExport.get 仅保留参数解析、文件流与鉴权薄壳。
"""

from services.engagement_service import EngagementService
from services.attribution_service import AttributionService
from services.risk_predict_service import RiskPredictService


def build_algorithm_export_rows(tab, class_name, days):
    """组装算法导出的 (sheet名, 表头, 行数据)。

    支持的 tab: engagement(参与度排名) / attribution(班级归因) / risk(风险评估)。
    非法 tab 抛 ValueError；各数据维度空结果返回空行（sheet 仍导出，仅表头）。

    与原 api/algorithm/algorithm_routes.py::_build_export_rows 逐字节一致。
    """
    if tab == "engagement":
        res = EngagementService.batch_rank(class_name, days)
        headers = [
            "排名",
            "姓名",
            "班级",
            "参与度",
            "等级",
            "出勤率",
            "作业率",
            "活跃度",
            "请假天数",
        ]
        rows = []
        for s in res.get("students", []):
            comp = s.get("components", {}) or {}
            rows.append(
                [
                    s.get("rank"),
                    s.get("name"),
                    s.get("class_name") or "",
                    s.get("engagement_score"),
                    s.get("level"),
                    comp.get("attendance_rate") if comp.get("attendance_rate") is not None else "",
                    comp.get("homework_rate") if comp.get("homework_rate") is not None else "",
                    comp.get("activity_rate") if comp.get("activity_rate") is not None else "",
                    comp.get("leave_days", 0),
                ]
            )
        return "参与度排名", headers, rows

    if tab == "attribution":
        res = AttributionService.batch_analyze(class_name, days)
        headers = ["姓名", "班级", "成绩变化", "主要因子", "置信度", "状态"]
        rows = []
        for s in res.get("students", []):
            if not s.get("has_data"):
                rows.append([s.get("name"), s.get("class_name") or "", "", "", "", "无数据"])
                continue
            factors = s.get("factors", [])
            top = factors[0].get("name") if factors else ""
            rows.append(
                [
                    s.get("name"),
                    s.get("class_name") or "",
                    s.get("total_change"),
                    top,
                    s.get("confidence"),
                    s.get("summary", ""),
                ]
            )
        return "班级归因", headers, rows

    if tab == "risk":
        res = RiskPredictService.predict_batch(class_name, days)
        headers = ["姓名", "班级", "总体风险", "风险分", "风险因素"]
        rows = []
        for r in res.get("results", []):
            factors = "、".join(f.get("description", "") for f in (r.get("risk_factors") or [])[:3])
            rows.append(
                [
                    r.get("name"),
                    r.get("class_name") or "",
                    r.get("overall_risk_level"),
                    r.get("overall_risk_score"),
                    factors,
                ]
            )
        return "风险评估", headers, rows

    raise ValueError("不支持的导出类型: %s" % tab)
