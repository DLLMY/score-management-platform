"""班级学期积分/成绩报告导出（P1 科任老师效率模块）

GET /api/reports/class-semester?class_id=<id>&format=excel|csv
- 权限：score.view（班主任/任课教师/年级组长均持有）
- 聚合：班级全体学生 + 各考试总分（跨科目求和）+ 当前积分余额
- 输出：Excel（默认）/ CSV，文件名含班级名
"""
from io import BytesIO

from flask import request, send_file
from flask_restx import Namespace, Resource

from models import ClassInfo, Exam, Score, User
from utils.excel_utils import ExcelUtils
from utils.permission import requires_permission
from utils.response import APIResponse

ns_reports = Namespace("reports", description="报表导出")

EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@ns_reports.route("/class-semester")
class ClassSemesterReport(Resource):
    @ns_reports.doc(
        "class_semester_report",
        params={
            "class_id": "班级ID（必填）",
            "format": "导出格式: excel（默认）或 csv",
        },
    )
    @requires_permission("score.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        fmt = (request.args.get("format") or "excel").lower()
        if not class_id:
            return APIResponse.bad_request(message="缺少 class_id 参数")
        class_info = ClassInfo.query.get(class_id)
        if not class_info:
            return APIResponse.not_found(message="班级不存在")

        try:
            students = (
                User.query.filter_by(class_info_id=class_id, is_active=True)
                .order_by(User.name)
                .all()
            )
            exams = (
                Exam.query.filter_by(class_id=class_id).order_by(Exam.id).all()
            )
            exam_ids = [e.id for e in exams]
            scores = (
                Score.query.filter(Score.exam_id.in_(exam_ids)).all()
                if exam_ids
                else []
            )

            # (student_id, exam_id) -> 该考试跨科目总分
            score_map = {}
            for s in scores:
                score_map[(s.student_id, s.exam_id)] = score_map.get(
                    (s.student_id, s.exam_id), 0
                ) + (s.score or 0)

            headers = ["姓名", "学号", "性别", "当前积分"]
            for e in exams:
                headers.append(e.name)
            headers += ["总分", "平均分"]

            rows = []  # 与 headers 顺序一致的二维数组
            for stu in students:
                row = [stu.name, stu.card_id, stu.gender or "", stu.current_score or 0]
                total = 0.0
                for e in exams:
                    v = score_map.get((stu.id, e.id))
                    if v is None:
                        row.append("")
                    else:
                        row.append(round(v, 1))
                        total += v
                avg = round(total / len(exams), 1) if exams else 0
                row.append(round(total, 1))
                row.append(avg)
                rows.append(row)

            safe_name = (class_info.name or "班级").replace("/", "_")
            filename = f"{safe_name}_学期报告"

            if fmt == "csv":
                content = ExcelUtils.export_to_csv(rows, headers)
                return send_file(
                    BytesIO(content),
                    mimetype="text/csv",
                    as_attachment=True,
                    download_name=f"{filename}.csv",
                )

            sheets = [{"name": "学期报告", "headers": headers, "data": rows}]
            content = ExcelUtils.export_to_excel(sheets)
            return send_file(
                BytesIO(content),
                mimetype=EXCEL_MIME,
                as_attachment=True,
                download_name=f"{filename}.xlsx",
            )
        except Exception as exc:  # noqa: BLE001 - 统一兜底，避免 5xx
            return APIResponse.error(message=f"生成报表失败: {exc}", status_code=500)
