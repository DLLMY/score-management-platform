"""
Export Service Tests
"""

import io
import os
import pytest
from datetime import datetime
from unittest.mock import patch

try:
    from services.export_service import ExportService
except ImportError:
    pass

try:
    import tempfile
except ImportError:
    pass

try:
    from services.export_service import EXCEL_AVAILABLE
except ImportError:
    pass

try:
    from services.export_service import PDF_AVAILABLE
except ImportError:
    pass

try:
    from services.export_service import export_service
except ImportError:
    pass


class TestExportServiceCSV:
    """Test CSV export functionality"""

    def test_export_to_csv_with_filepath(self):
        """Test export to CSV with filepath"""
        from services.export_service import ExportService
        import tempfile

        data = [
            {"name": "张三", "score": 85},
            {"name": "李四", "score": 90},
        ]
        headers = ["name", "score"]

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = os.path.join(tmpdir, "test_export.csv")
            result = ExportService.export_to_csv(data, headers, filepath=filepath)

            assert result == filepath
            assert os.path.exists(filepath)

    def test_export_to_csv_without_filepath(self):
        """Test export to CSV without filepath (returns string)"""

        data = [
            {"name": "张三", "score": 85},
            {"name": "李四", "score": 90},
        ]
        headers = ["name", "score"]

        result = ExportService.export_to_csv(data, headers)

        assert isinstance(result, str)
        assert "name,score" in result
        assert "张三,85" in result

    def test_export_users_to_csv(self):
        """Test export users to CSV"""

        users = [
            {
                "id": 1,
                "name": "张三",
                "card_id": "123",
                "class_name": "一班",
                "current_score": 100,
                "status": 1,
                "created_at": "2024-01-01",
            },
            {
                "id": 2,
                "name": "李四",
                "card_id": "456",
                "class_name": "二班",
                "current_score": 50,
                "status": 0,
                "created_at": "2024-01-02",
            },
        ]

        result = ExportService.export_users_to_csv(users)

        assert isinstance(result, str)
        assert "ID,姓名,卡号" in result
        assert "张三" in result
        assert "李四" in result

    def test_export_score_records_to_csv(self):
        """Test export score records to CSV"""

        records = [
            {
                "id": 1,
                "user_id": 1,
                "user_name": "张三",
                "rule_id": 1,
                "rule_name": "迟到",
                "score_change": -5,
                "description": "迟到扣分",
                "created_at": "2024-01-01",
            },
        ]

        result = ExportService.export_score_records_to_csv(records)

        assert isinstance(result, str)
        assert "用户ID,用户名" in result

    def test_export_exam_scores_to_csv(self):
        """Test export exam scores to CSV"""

        scores = [
            {
                "id": 1,
                "student_id": 1,
                "student_name": "张三",
                "exam_id": 1,
                "exam_name": "期中考试",
                "subject": "数学",
                "score": 90,
                "created_at": "2024-01-01",
            },
        ]

        result = ExportService.export_exam_scores_to_csv(scores)

        assert isinstance(result, str)
        assert "学生ID,学生姓名" in result


class TestExportServiceExcel:
    """Test Excel export functionality"""

    def test_export_to_excel_basic(self):
        """Test basic Excel export"""
        from services.export_service import EXCEL_AVAILABLE

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        data = [
            {"name": "张三", "score": 85},
            {"name": "李四", "score": 90},
        ]
        headers = ["name", "score"]

        result = ExportService.export_to_excel(data, headers)

        assert isinstance(result, io.BytesIO)
        assert result.tell() == 0

    def test_export_to_excel_with_datetime(self):
        """Test Excel export with datetime values"""

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        test_time = datetime(2024, 1, 15, 10, 30, 0)
        data = [
            {"name": "张三", "time": test_time},
        ]
        headers = ["name", "time"]

        result = ExportService.export_to_excel(data, headers)

        assert isinstance(result, io.BytesIO)

    def test_export_to_excel_with_none_values(self):
        """Test Excel export with None values"""

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        data = [
            {"name": "张三", "score": None},
        ]
        headers = ["name", "score"]

        result = ExportService.export_to_excel(data, headers)

        assert isinstance(result, io.BytesIO)

    def test_export_users_to_excel(self):
        """Test export users to Excel"""

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        users = [
            {
                "id": 1,
                "name": "张三",
                "gender": "男",
                "class_name": "一班",
                "phone": "13800138000",
                "card_id": "123",
                "current_score": 100,
                "created_at": "2024-01-01",
            },
        ]

        result = ExportService.export_users_to_excel(users)

        assert isinstance(result, io.BytesIO)

    def test_export_rules_to_excel(self):
        """Test export rules to Excel"""

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        rules = [
            {
                "id": 1,
                "name": "迟到",
                "description": "上课迟到",
                "category_name": "纪律",
                "score": -5,
                "is_active": True,
                "daily_limit": 3,
                "min_interval": 60,
                "created_at": "2024-01-01",
            },
        ]

        result = ExportService.export_rules_to_excel(rules)

        assert isinstance(result, io.BytesIO)

    def test_export_devices_to_excel(self):
        """Test export devices to Excel"""

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        devices = [
            {
                "id": 1,
                "device_id": "DEV001",
                "name": "教室1设备",
                "status": "online",
                "is_online": True,
                "wifi_signal": "80%",
                "class_name": "一班",
                "admin_name": "王老师",
                "created_at": "2024-01-01",
            },
        ]

        result = ExportService.export_devices_to_excel(devices)

        assert isinstance(result, io.BytesIO)

    def test_export_records_to_excel(self):
        """Test export records to Excel"""

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        records = [
            {
                "id": 1,
                "user_id": 1,
                "user_name": "张三",
                "card_id": "123",
                "score_change": -5,
                "new_score": 95,
                "rule_id": 1,
                "rule_name": "迟到",
                "category_name": "纪律",
                "description": "迟到扣分",
                "created_at": "2024-01-01",
                "operator": "王老师",
            },
        ]

        result = ExportService.export_records_to_excel(records)

        assert isinstance(result, io.BytesIO)

    def test_export_summary_to_excel(self):
        """Test export summary to Excel"""

        if not EXCEL_AVAILABLE:
            pytest.skip("openpyxl not available")

        summary_data = [
            {"统计项": "用户总数", "数值": 100},
            {"统计项": "规则总数", "数值": 20},
        ]

        result = ExportService.export_summary_to_excel(summary_data)

        assert isinstance(result, io.BytesIO)

    def test_export_to_excel_import_error(self):
        """Test Excel export when openpyxl is not available"""

        with patch("services.export_service.EXCEL_AVAILABLE", False):
            data = [{"name": "张三"}]
            headers = ["name"]

            with pytest.raises(ImportError):
                ExportService.export_to_excel(data, headers)


class TestExportServicePDF:
    """Test PDF export functionality"""

    def test_export_to_pdf_basic(self):
        """Test basic PDF export"""
        from services.export_service import PDF_AVAILABLE

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        data = [
            {"name": "张三", "score": 85},
        ]
        headers = ["name", "score"]

        result = ExportService.export_to_pdf("测试报告", data, headers)

        assert isinstance(result, io.BytesIO)

    def test_export_to_pdf_with_bool_values(self):
        """Test PDF export with boolean values"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        data = [
            {"name": "张三", "active": True},
            {"name": "李四", "active": False},
        ]
        headers = ["name", "active"]

        result = ExportService.export_to_pdf("测试报告", data, headers)

        assert isinstance(result, io.BytesIO)

    def test_export_to_pdf_letter_size(self):
        """Test PDF export with letter page size"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        data = [{"name": "张三"}]
        headers = ["name"]

        result = ExportService.export_to_pdf("测试报告", data, headers, page_size="letter")

        assert isinstance(result, io.BytesIO)

    def test_export_users_to_pdf(self):
        """Test export users to PDF"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        users = [
            {
                "id": 1,
                "name": "张三",
                "gender": "男",
                "class_name": "一班",
                "phone": "13800138000",
                "card_id": "123",
                "current_score": 100,
            },
        ]

        result = ExportService.export_users_to_pdf(users)

        assert isinstance(result, io.BytesIO)

    def test_export_rules_to_pdf(self):
        """Test export rules to PDF"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        rules = [
            {
                "id": 1,
                "name": "迟到",
                "description": "上课迟到",
                "category_name": "纪律",
                "score": -5,
                "is_active": True,
                "daily_limit": 3,
                "min_interval": 60,
            },
        ]

        result = ExportService.export_rules_to_pdf(rules)

        assert isinstance(result, io.BytesIO)

    def test_export_devices_to_pdf(self):
        """Test export devices to PDF"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        devices = [
            {
                "id": 1,
                "device_id": "DEV001",
                "name": "教室1设备",
                "status": "online",
                "is_online": True,
                "wifi_signal": "80%",
                "class_name": "一班",
                "admin_name": "王老师",
            },
        ]

        result = ExportService.export_devices_to_pdf(devices)

        assert isinstance(result, io.BytesIO)

    def test_export_records_to_pdf(self):
        """Test export records to PDF"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        records = [
            {
                "id": 1,
                "user_name": "张三",
                "card_id": "123",
                "score_change": -5,
                "new_score": 95,
                "rule_name": "迟到",
                "description": "迟到扣分",
                "created_at": "2024-01-01",
            },
        ]

        result = ExportService.export_records_to_pdf(records)

        assert isinstance(result, io.BytesIO)

    def test_export_summary_report(self):
        """Test export summary report"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        result = ExportService.export_summary_report(
            users_count=100,
            rules_count=20,
            devices_count=10,
            online_devices=8,
            records_count=1000,
        )

        assert isinstance(result, io.BytesIO)

    def test_export_summary_report_zero_devices(self):
        """Test export summary report with zero devices"""

        if not PDF_AVAILABLE:
            pytest.skip("reportlab not available")

        result = ExportService.export_summary_report(
            users_count=100,
            rules_count=20,
            devices_count=0,
            online_devices=0,
            records_count=1000,
        )

        assert isinstance(result, io.BytesIO)

    def test_export_to_pdf_import_error(self):
        """Test PDF export when reportlab is not available"""

        with patch("services.export_service.PDF_AVAILABLE", False):
            data = [{"name": "张三"}]
            headers = ["name"]

            with pytest.raises(ImportError):
                ExportService.export_to_pdf("测试报告", data, headers)


class TestExportServiceSingleton:
    """Test ExportService singleton"""

    def test_export_service_singleton(self):
        """Test export_service is an instance of ExportService"""
        from services.export_service import export_service

        assert isinstance(export_service, ExportService)
