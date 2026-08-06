"""
数据导出服务模块
支持Excel和PDF格式的数据导出
"""

import io
from datetime import datetime
from typing import List, Dict, Any

try:
    import xlsxwriter

    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch

    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


class ExportService:
    """数据导出服务"""

    @staticmethod
    def export_to_excel(data: List[Dict[str, Any]], headers: List[str], filename: str = None) -> io.BytesIO:
        """
        导出数据到Excel格式

        Args:
            data: 数据列表，每个元素是字典
            headers: 表头列表
            filename: 文件名（可选）

        Returns:
            Excel文件的字节流
        """
        if not EXCEL_AVAILABLE:
            raise ImportError("xlsxwriter模块未安装，请执行 pip install xlsxwriter")
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet()
        header_style = workbook.add_format(
            {
                "bold": True,
                "font_color": "white",
                "bg_color": "#4A90D9",
                "align": "center",
                "valign": "vcenter",
                "border": 1,
            }
        )
        data_style = workbook.add_format({"border": 1, "align": "center", "valign": "vcenter"})
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_style)
        for row, row_data in enumerate(data, start=1):
            for col, header in enumerate(headers):
                value = row_data.get(header, "")
                if isinstance(value, datetime):
                    value = value.strftime("%Y-%m-%d %H:%M:%S")
                elif value is None:
                    value = ""
                worksheet.write(row, col, value, data_style)
        for col in range(len(headers)):
            worksheet.set_column(col, col, 15)
        workbook.close()
        output.seek(0)
        return output

    @staticmethod
    def export_users_to_excel(users: List[Dict[str, Any]]) -> io.BytesIO:
        """
        导出用户数据到Excel

        Args:
            users: 用户数据列表

        Returns:
            Excel文件的字节流
        """
        headers = ["ID", "姓名", "性别", "班级", "电话", "卡片ID", "当前积分", "创建时间"]
        data = []
        for user in users:
            data.append(
                {
                    "ID": user.get("id", ""),
                    "姓名": user.get("name", ""),
                    "性别": user.get("gender", ""),
                    "班级": user.get("class_name", ""),
                    "电话": user.get("phone", ""),
                    "卡片ID": user.get("card_id", ""),
                    "当前积分": user.get("current_score", ""),
                    "创建时间": user.get("created_at", ""),
                }
            )
        return ExportService.export_to_excel(data, headers)

    @staticmethod
    def export_rules_to_excel(rules: List[Dict[str, Any]]) -> io.BytesIO:
        """
        导出积分规则数据到Excel

        Args:
            rules: 规则数据列表

        Returns:
            Excel文件的字节流
        """
        headers = ["ID", "规则名称", "描述", "分类", "分数", "是否启用", "每日上限", "最小间隔", "创建时间"]
        data = []
        for rule in rules:
            data.append(
                {
                    "ID": rule.get("id", ""),
                    "规则名称": rule.get("name", ""),
                    "描述": rule.get("description", ""),
                    "分类": rule.get("category_name", rule.get("category_id", "")),
                    "分数": rule.get("score", 0),
                    "是否启用": rule.get("is_active", True),
                    "每日上限": rule.get("daily_limit", ""),
                    "最小间隔": rule.get("min_interval", ""),
                    "创建时间": rule.get("created_at", ""),
                }
            )
        return ExportService.export_to_excel(data, headers)

    @staticmethod
    def export_devices_to_excel(devices: List[Dict[str, Any]]) -> io.BytesIO:
        """
        导出设备数据到Excel

        Args:
            devices: 设备数据列表

        Returns:
            Excel文件的字节流
        """
        headers = ["ID", "设备标识", "设备名称", "状态", "是否在线", "WiFi信号", "班级", "管理员", "创建时间"]
        data = []
        for device in devices:
            data.append(
                {
                    "ID": device.get("id", ""),
                    "设备标识": device.get("device_id", ""),
                    "设备名称": device.get("name", ""),
                    "状态": device.get("status", ""),
                    "是否在线": "是" if device.get("is_online") else "否",
                    "WiFi信号": device.get("wifi_signal", ""),
                    "班级": device.get("class_name", ""),
                    "管理员": device.get("admin_name", ""),
                    "创建时间": device.get("created_at", ""),
                }
            )
        return ExportService.export_to_excel(data, headers)

    @staticmethod
    def export_records_to_excel(records: List[Dict[str, Any]]) -> io.BytesIO:
        """
        导出积分记录数据到Excel

        Args:
            records: 积分记录数据列表

        Returns:
            Excel文件的字节流
        """
        headers = [
            "ID",
            "用户ID",
            "用户姓名",
            "卡片ID",
            "积分变化",
            "操作后积分",
            "规则ID",
            "规则名称",
            "分类",
            "描述",
            "操作时间",
            "操作员",
        ]
        data = []
        for record in records:
            data.append(
                {
                    "ID": record.get("id", ""),
                    "用户ID": record.get("user_id", ""),
                    "用户姓名": record.get("user_name", ""),
                    "卡片ID": record.get("card_id", ""),
                    "积分变化": record.get("score_change", 0),
                    "操作后积分": record.get("new_score", 0),
                    "规则ID": record.get("rule_id", ""),
                    "规则名称": record.get("rule_name", ""),
                    "分类": record.get("category_name", ""),
                    "描述": record.get("description", ""),
                    "操作时间": record.get("created_at", ""),
                    "操作员": record.get("operator", ""),
                }
            )
        return ExportService.export_to_excel(data, headers)

    @staticmethod
    def export_to_pdf(
        title: str, data: List[Dict[str, Any]], headers: List[str], filename: str = None, page_size: str = "A4"
    ) -> io.BytesIO:
        """
        导出数据到PDF格式

        Args:
            title: 报告标题
            data: 数据列表，每个元素是字典
            headers: 表头列表
            filename: 文件名（可选）
            page_size: 页面大小（A4或letter）

        Returns:
            PDF文件的字节流
        """
        if not PDF_AVAILABLE:
            raise ImportError("reportlab模块未安装，请执行 pip install reportlab")
        output = io.BytesIO()
        pagesize = A4 if page_size == "A4" else letter
        doc = SimpleDocTemplate(
            output, pagesize=pagesize, rightMargin=inch, leftMargin=inch, topMargin=inch, bottomMargin=inch
        )
        elements = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("TitleStyle", parent=styles["Heading1"], fontSize=18, alignment=1, spaceAfter=12)
        elements.append(Paragraph(title, title_style))
        time_style = ParagraphStyle(
            "TimeStyle", parent=styles["Normal"], fontSize=10, alignment=1, textColor=colors.grey, spaceAfter=20
        )
        elements.append(Paragraph(f"生成时间: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}", time_style))
        table_data = [headers]
        for row_data in data:
            row = []
            for header in headers:
                value = row_data.get(header, "")
                if isinstance(value, datetime):
                    value = value.strftime("%Y-%m-%d %H:%M:%S")
                elif value is None:
                    value = ""
                elif isinstance(value, bool):
                    value = "是" if value else "否"
                row.append(str(value))
            table_data.append(row)
        table = Table(table_data)
        table_style = TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.18, 0.36, 0.83)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
            ]
        )  # noqa: E501
        table.setStyle(table_style)
        col_widths = [1.5 * inch] + [2 * inch] * (len(headers) - 1)
        table._argW = col_widths
        elements.append(table)
        stats_style = ParagraphStyle("StatsStyle", parent=styles["Normal"], fontSize=10, alignment=0, spaceBefore=20)
        elements.append(Paragraph(f"总记录数: {len(data)}", stats_style))
        doc.build(elements)
        output.seek(0)
        return output

    @staticmethod
    def export_users_to_pdf(users: List[Dict[str, Any]], title: str = "学生列表报告") -> io.BytesIO:
        """
        导出用户数据到PDF

        Args:
            users: 用户数据列表
            title: 报告标题

        Returns:
            PDF文件的字节流
        """
        headers = ["ID", "姓名", "性别", "班级", "电话", "卡片ID", "当前积分"]
        data = []
        for user in users:
            data.append(
                {
                    "ID": user.get("id", ""),
                    "姓名": user.get("name", ""),
                    "性别": user.get("gender", ""),
                    "班级": user.get("class_name", ""),
                    "电话": user.get("phone", ""),
                    "卡片ID": user.get("card_id", ""),
                    "当前积分": user.get("current_score", ""),
                }
            )
        return ExportService.export_to_pdf(title, data, headers)

    @staticmethod
    def export_rules_to_pdf(rules: List[Dict[str, Any]], title: str = "积分规则报告") -> io.BytesIO:
        """
        导出积分规则数据到PDF

        Args:
            rules: 规则数据列表
            title: 报告标题

        Returns:
            PDF文件的字节流
        """
        headers = ["ID", "规则名称", "描述", "分类", "分数", "是否启用", "每日上限", "最小间隔"]
        data = []
        for rule in rules:
            data.append(
                {
                    "ID": rule.get("id", ""),
                    "规则名称": rule.get("name", ""),
                    "描述": rule.get("description", ""),
                    "分类": rule.get("category_name", rule.get("category_id", "")),
                    "分数": rule.get("score", 0),
                    "是否启用": rule.get("is_active", True),
                    "每日上限": rule.get("daily_limit", ""),
                    "最小间隔": rule.get("min_interval", ""),
                }
            )
        return ExportService.export_to_pdf(title, data, headers)

    @staticmethod
    def export_devices_to_pdf(devices: List[Dict[str, Any]], title: str = "设备列表报告") -> io.BytesIO:
        """
        导出设备数据到PDF

        Args:
            devices: 设备数据列表
            title: 报告标题

        Returns:
            PDF文件的字节流
        """
        headers = ["ID", "设备标识", "设备名称", "状态", "是否在线", "WiFi信号", "班级", "管理员"]
        data = []
        for device in devices:
            data.append(
                {
                    "ID": device.get("id", ""),
                    "设备标识": device.get("device_id", ""),
                    "设备名称": device.get("name", ""),
                    "状态": device.get("status", ""),
                    "是否在线": device.get("is_online", False),
                    "WiFi信号": device.get("wifi_signal", ""),
                    "班级": device.get("class_name", ""),
                    "管理员": device.get("admin_name", ""),
                }
            )
        return ExportService.export_to_pdf(title, data, headers)

    @staticmethod
    def export_records_to_pdf(records: List[Dict[str, Any]], title: str = "积分记录报告") -> io.BytesIO:
        """
        导出积分记录数据到PDF

        Args:
            records: 积分记录数据列表
            title: 报告标题

        Returns:
            PDF文件的字节流
        """
        headers = ["ID", "用户姓名", "卡片ID", "积分变化", "操作后积分", "规则名称", "描述", "操作时间"]
        data = []
        for record in records:
            data.append(
                {
                    "ID": record.get("id", ""),
                    "用户姓名": record.get("user_name", ""),
                    "卡片ID": record.get("card_id", ""),
                    "积分变化": record.get("score_change", 0),
                    "操作后积分": record.get("new_score", 0),
                    "规则名称": record.get("rule_name", ""),
                    "描述": record.get("description", ""),
                    "操作时间": record.get("created_at", ""),
                }
            )
        return ExportService.export_to_pdf(title, data, headers)

    @staticmethod
    def export_summary_report(
        users_count: int,
        rules_count: int,
        devices_count: int,
        online_devices: int,
        records_count: int,
        title: str = "系统数据汇总报告",
    ) -> io.BytesIO:
        """
        导出系统数据汇总报告

        Args:
            users_count: 用户总数
            rules_count: 规则总数
            devices_count: 设备总数
            online_devices: 在线设备数
            records_count: 记录总数
            title: 报告标题

        Returns:
            PDF文件的字节流
        """
        if not PDF_AVAILABLE:
            raise ImportError("reportlab模块未安装，请执行 pip install reportlab")
        output = io.BytesIO()
        doc = SimpleDocTemplate(
            output, pagesize=A4, rightMargin=inch, leftMargin=inch, topMargin=inch, bottomMargin=inch
        )
        elements = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("TitleStyle", parent=styles["Heading1"], fontSize=20, alignment=1, spaceAfter=12)
        elements.append(Paragraph(title, title_style))
        time_style = ParagraphStyle(
            "TimeStyle", parent=styles["Normal"], fontSize=10, alignment=1, textColor=colors.grey, spaceAfter=24
        )
        elements.append(Paragraph(f"生成时间: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}", time_style))
        summary_data = [
            ["数据类别", "数量"],
            ["学生总数", str(users_count)],
            ["积分规则数", str(rules_count)],
            ["设备总数", str(devices_count)],
            ["在线设备数", str(online_devices)],
            ["积分记录数", str(records_count)],
            ["设备在线率", f"{online_devices/devices_count*100:.1f}%" if devices_count > 0 else "0%"],
        ]  # noqa: E501
        summary_table = Table(summary_data, colWidths=[3 * inch, 2 * inch])
        summary_style = TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.18, 0.36, 0.83)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
            ]
        )  # noqa: E501
        summary_table.setStyle(summary_style)
        elements.append(summary_table)
        note_style = ParagraphStyle(
            "NoteStyle", parent=styles["Normal"], fontSize=10, textColor=colors.grey, spaceBefore=30
        )
        elements.append(Paragraph("注：本报告数据为系统实时统计结果。", note_style))
        doc.build(elements)
        output.seek(0)
        return output


    @staticmethod
    def export_to_csv(data: List[Dict[str, Any]], headers: List[str], filepath: str = None):
        """导出数据为 CSV（兼容旧测试接口）。有 filepath 则写文件并返回路径，否则返回 CSV 字符串。
        只输出 headers 指定的列，容忍传入 dict 含多余字段。"""
        import csv as _csv
        import io as _io
        # 投影为仅含 headers 列的字典，避免 DictWriter 因多余字段报错
        projected = [
            {h: (row.get(h, "") if isinstance(row, dict) else "") for h in headers}
            for row in data
        ]
        if filepath:
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                writer = _csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(projected)
            return filepath
        buf = _io.StringIO()
        writer = _csv.DictWriter(buf, fieldnames=headers)
        writer.writeheader()
        writer.writerows(projected)
        return buf.getvalue()

    @staticmethod
    def export_users_to_csv(users: List[Dict[str, Any]]) -> str:
        """导出用户为 CSV 字符串。测试数据使用英文键，映射到中文表头。"""
        headers = ["ID", "姓名", "卡号", "班级", "当前积分", "状态", "创建时间"]
        key_map = {
            "ID": "id", "姓名": "name", "卡号": "card_id", "班级": "class_name",
            "当前积分": "current_score", "状态": "status", "创建时间": "created_at",
        }
        mapped = [
            {h: (u.get(key_map[h], "") if isinstance(u, dict) else "") for h in headers}
            for u in users
        ]
        return ExportService.export_to_csv(mapped, headers)

    @staticmethod
    def export_score_records_to_csv(records: List[Dict[str, Any]]) -> str:
        """导出积分记录为 CSV 字符串。测试数据使用英文键，映射到中文表头。"""
        headers = ["用户ID", "用户名", "规则ID", "规则名", "积分变化", "描述", "时间"]
        key_map = {
            "用户ID": "user_id", "用户名": "user_name", "规则ID": "rule_id",
            "规则名": "rule_name", "积分变化": "score_change", "描述": "description", "时间": "created_at",
        }
        mapped = [
            {h: (r.get(key_map[h], "") if isinstance(r, dict) else "") for h in headers}
            for r in records
        ]
        return ExportService.export_to_csv(mapped, headers)

    @staticmethod
    def export_exam_scores_to_csv(scores: List[Dict[str, Any]]) -> str:
        """导出考试成绩为 CSV 字符串。测试数据使用英文键，映射到中文表头。"""
        headers = ["学生ID", "学生姓名", "考试ID", "考试名", "科目", "分数", "时间"]
        key_map = {
            "学生ID": "student_id", "学生姓名": "student_name", "考试ID": "exam_id",
            "考试名": "exam_name", "科目": "subject", "分数": "score", "时间": "created_at",
        }
        mapped = [
            {h: (s.get(key_map[h], "") if isinstance(s, dict) else "") for h in headers}
            for s in scores
        ]
        return ExportService.export_to_csv(mapped, headers)

    @staticmethod
    def export_summary_to_excel(summary_data: List[Dict[str, Any]]):
        """兼容旧测试接口：以汇总数据生成报告（返回 BytesIO）。"""
        mapping = {d.get("统计项"): d.get("数值") for d in summary_data}
        return ExportService.export_summary_report(
            users_count=mapping.get("用户总数", 0),
            rules_count=mapping.get("规则总数", 0),
            devices_count=mapping.get("设备总数", 0),
            online_devices=mapping.get("在线设备数", 0),
            records_count=mapping.get("记录总数", 0),
        )


export_service = ExportService()
