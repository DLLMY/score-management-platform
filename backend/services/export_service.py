#!/usr/bin/env python3
"""
数据导出服务模块
支持Excel和PDF格式的数据导出
"""

import io
import json
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
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
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
        
        # 创建工作表
        worksheet = workbook.add_worksheet()
        
        # 设置表头样式
        header_style = workbook.add_format({
            'bold': True,
            'font_color': 'white',
            'bg_color': '#4A90D9',
            'align': 'center',
            'valign': 'vcenter',
            'border': 1
        })
        
        # 设置数据样式
        data_style = workbook.add_format({
            'border': 1,
            'align': 'center',
            'valign': 'vcenter'
        })
        
        # 写入表头
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_style)
        
        # 写入数据
        for row, row_data in enumerate(data, start=1):
            for col, header in enumerate(headers):
                value = row_data.get(header, '')
                # 处理日期时间格式
                if isinstance(value, datetime):
                    value = value.strftime('%Y-%m-%d %H:%M:%S')
                elif value is None:
                    value = ''
                worksheet.write(row, col, value, data_style)
        
        # 自动调整列宽
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
        headers = ['ID', '姓名', '性别', '班级', '电话', '卡片ID', '当前积分', '创建时间']
        
        data = []
        for user in users:
            data.append({
                'ID': user.get('id', ''),
                '姓名': user.get('name', ''),
                '性别': user.get('gender', ''),
                '班级': user.get('class_name', ''),
                '电话': user.get('phone', ''),
                '卡片ID': user.get('card_id', ''),
                '当前积分': user.get('current_score', 0),
                '创建时间': user.get('created_at', '')
            })
        
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
        headers = ['ID', '规则名称', '描述', '分类', '分数', '是否启用', '每日上限', '最小间隔', '创建时间']
        
        data = []
        for rule in rules:
            data.append({
                'ID': rule.get('id', ''),
                '规则名称': rule.get('name', ''),
                '描述': rule.get('description', ''),
                '分类': rule.get('category_name', rule.get('category_id', '')),
                '分数': rule.get('score', 0),
                '是否启用': '是' if rule.get('is_active') else '否',
                '每日上限': rule.get('daily_limit', 0),
                '最小间隔': rule.get('min_interval', 0),
                '创建时间': rule.get('created_at', '')
            })
        
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
        headers = ['ID', '设备标识', '设备名称', '状态', '是否在线', 'WiFi信号', '班级', '管理员', '创建时间']
        
        data = []
        for device in devices:
            data.append({
                'ID': device.get('id', ''),
                '设备标识': device.get('device_id', ''),
                '设备名称': device.get('name', ''),
                '状态': device.get('status', ''),
                '是否在线': '是' if device.get('is_online') else '否',
                'WiFi信号': device.get('wifi_signal', ''),
                '班级': device.get('class_name', ''),
                '管理员': device.get('admin_name', ''),
                '创建时间': device.get('created_at', '')
            })
        
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
        headers = ['ID', '用户ID', '用户姓名', '卡片ID', '积分变化', '操作后积分', '规则ID', '规则名称', '分类', '描述', '操作时间', '操作员']
        
        data = []
        for record in records:
            data.append({
                'ID': record.get('id', ''),
                '用户ID': record.get('user_id', ''),
                '用户姓名': record.get('user_name', ''),
                '卡片ID': record.get('card_id', ''),
                '积分变化': record.get('score_change', 0),
                '操作后积分': record.get('new_score', 0),
                '规则ID': record.get('rule_id', ''),
                '规则名称': record.get('rule_name', ''),
                '分类': record.get('category_name', ''),
                '描述': record.get('description', ''),
                '操作时间': record.get('created_at', ''),
                '操作员': record.get('operator', '')
            })
        
        return ExportService.export_to_excel(data, headers)
    
    @staticmethod
    def export_to_pdf(title: str, data: List[Dict[str, Any]], headers: List[str], 
                     filename: str = None, page_size: str = 'A4') -> io.BytesIO:
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
        
        # 设置页面大小
        pagesize = A4 if page_size == 'A4' else letter
        
        # 创建PDF文档
        doc = SimpleDocTemplate(
            output,
            pagesize=pagesize,
            rightMargin=inch,
            leftMargin=inch,
            topMargin=inch,
            bottomMargin=inch
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # 添加标题
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=18,
            alignment=1,  # 居中
            spaceAfter=12
        )
        elements.append(Paragraph(title, title_style))
        
        # 添加生成时间
        time_style = ParagraphStyle(
            'TimeStyle',
            parent=styles['Normal'],
            fontSize=10,
            alignment=1,
            textColor=colors.grey,
            spaceAfter=20
        )
        elements.append(Paragraph(f'生成时间: {datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")}', time_style))
        
        # 准备表格数据
        table_data = [headers]
        for row_data in data:
            row = []
            for header in headers:
                value = row_data.get(header, '')
                if isinstance(value, datetime):
                    value = value.strftime('%Y-%m-%d %H:%M:%S')
                elif value is None:
                    value = ''
                elif isinstance(value, bool):
                    value = '是' if value else '否'
                row.append(str(value))
            table_data.append(row)
        
        # 创建表格
        table = Table(table_data)
        
        # 设置表格样式
        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.18, 0.36, 0.83)),  # 蓝色表头
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
        ])
        
        table.setStyle(table_style)
        
        # 设置列宽
        col_widths = [1.5 * inch] + [2 * inch] * (len(headers) - 1)
        table._argW = col_widths
        
        elements.append(table)
        
        # 添加数据统计
        stats_style = ParagraphStyle(
            'StatsStyle',
            parent=styles['Normal'],
            fontSize=10,
            alignment=0,
            spaceBefore=20
        )
        elements.append(Paragraph(f'总记录数: {len(data)}', stats_style))
        
        # 构建文档
        doc.build(elements)
        
        output.seek(0)
        return output
    
    @staticmethod
    def export_users_to_pdf(users: List[Dict[str, Any]], title: str = '学生列表报告') -> io.BytesIO:
        """
        导出用户数据到PDF
        
        Args:
            users: 用户数据列表
            title: 报告标题
        
        Returns:
            PDF文件的字节流
        """
        headers = ['ID', '姓名', '性别', '班级', '电话', '卡片ID', '当前积分']
        
        data = []
        for user in users:
            data.append({
                'ID': user.get('id', ''),
                '姓名': user.get('name', ''),
                '性别': user.get('gender', ''),
                '班级': user.get('class_name', ''),
                '电话': user.get('phone', ''),
                '卡片ID': user.get('card_id', ''),
                '当前积分': user.get('current_score', 0)
            })
        
        return ExportService.export_to_pdf(title, data, headers)
    
    @staticmethod
    def export_rules_to_pdf(rules: List[Dict[str, Any]], title: str = '积分规则报告') -> io.BytesIO:
        """
        导出积分规则数据到PDF
        
        Args:
            rules: 规则数据列表
            title: 报告标题
        
        Returns:
            PDF文件的字节流
        """
        headers = ['ID', '规则名称', '描述', '分类', '分数', '是否启用', '每日上限', '最小间隔']
        
        data = []
        for rule in rules:
            data.append({
                'ID': rule.get('id', ''),
                '规则名称': rule.get('name', ''),
                '描述': rule.get('description', ''),
                '分类': rule.get('category_name', rule.get('category_id', '')),
                '分数': rule.get('score', 0),
                '是否启用': rule.get('is_active', False),
                '每日上限': rule.get('daily_limit', 0),
                '最小间隔': rule.get('min_interval', 0)
            })
        
        return ExportService.export_to_pdf(title, data, headers)
    
    @staticmethod
    def export_devices_to_pdf(devices: List[Dict[str, Any]], title: str = '设备列表报告') -> io.BytesIO:
        """
        导出设备数据到PDF
        
        Args:
            devices: 设备数据列表
            title: 报告标题
        
        Returns:
            PDF文件的字节流
        """
        headers = ['ID', '设备标识', '设备名称', '状态', '是否在线', 'WiFi信号', '班级', '管理员']
        
        data = []
        for device in devices:
            data.append({
                'ID': device.get('id', ''),
                '设备标识': device.get('device_id', ''),
                '设备名称': device.get('name', ''),
                '状态': device.get('status', ''),
                '是否在线': device.get('is_online', False),
                'WiFi信号': device.get('wifi_signal', ''),
                '班级': device.get('class_name', ''),
                '管理员': device.get('admin_name', '')
            })
        
        return ExportService.export_to_pdf(title, data, headers)
    
    @staticmethod
    def export_records_to_pdf(records: List[Dict[str, Any]], title: str = '积分记录报告') -> io.BytesIO:
        """
        导出积分记录数据到PDF
        
        Args:
            records: 积分记录数据列表
            title: 报告标题
        
        Returns:
            PDF文件的字节流
        """
        headers = ['ID', '用户姓名', '卡片ID', '积分变化', '操作后积分', '规则名称', '描述', '操作时间']
        
        data = []
        for record in records:
            data.append({
                'ID': record.get('id', ''),
                '用户姓名': record.get('user_name', ''),
                '卡片ID': record.get('card_id', ''),
                '积分变化': record.get('score_change', 0),
                '操作后积分': record.get('new_score', 0),
                '规则名称': record.get('rule_name', ''),
                '描述': record.get('description', ''),
                '操作时间': record.get('created_at', '')
            })
        
        return ExportService.export_to_pdf(title, data, headers)
    
    @staticmethod
    def export_summary_report(users_count: int, rules_count: int, devices_count: int, 
                            online_devices: int, records_count: int, 
                            title: str = '系统数据汇总报告') -> io.BytesIO:
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
        doc = SimpleDocTemplate(output, pagesize=A4,
                              rightMargin=inch, leftMargin=inch,
                              topMargin=inch, bottomMargin=inch)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # 标题
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=20,
            alignment=1,
            spaceAfter=12
        )
        elements.append(Paragraph(title, title_style))
        
        # 生成时间
        time_style = ParagraphStyle(
            'TimeStyle',
            parent=styles['Normal'],
            fontSize=10,
            alignment=1,
            textColor=colors.grey,
            spaceAfter=24
        )
        elements.append(Paragraph(f'生成时间: {datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")}', time_style))
        
        # 统计数据表格
        summary_data = [
            ['数据类别', '数量'],
            ['学生总数', str(users_count)],
            ['积分规则数', str(rules_count)],
            ['设备总数', str(devices_count)],
            ['在线设备数', str(online_devices)],
            ['积分记录数', str(records_count)],
            ['设备在线率', f'{round(online_devices / devices_count * 100, 1)}%' if devices_count > 0 else '0%']
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.18, 0.36, 0.83)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('FONTSIZE', (0, 1), (-1, -1), 11),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
        ])
        summary_table.setStyle(summary_style)
        elements.append(summary_table)
        
        # 说明文字
        note_style = ParagraphStyle(
            'NoteStyle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.grey,
            spaceBefore=30
        )
        elements.append(Paragraph('注：本报告数据为系统实时统计结果。', note_style))
        
        doc.build(elements)
        output.seek(0)
        
        return output


# 创建单例实例
export_service = ExportService()
