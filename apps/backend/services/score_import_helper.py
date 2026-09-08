"""成绩导入辅助函数（从 api/academics/exam_import_routes 下沉，消除 services → api 反向依赖）。"""

from models import Subject


def _resolve_subject_id(subject_name, subject_id):
    """将科目名称或科目ID解析为 subject.id；均缺失返回 None。"""
    if subject_id:
        return subject_id
    if subject_name:
        sub = Subject.query.filter_by(name=subject_name).first()
        if sub:
            return sub.id
        sub = Subject.query.filter_by(code=subject_name).first()
        if sub:
            return sub.id
    return None


class ScoreImportHelper:
    HEADER_MAPPING = {
        "card_id": ["card_id", "学号", "卡号", "id", "学生id"],
        "student_name": ["student_name", "姓名", "学生姓名"],
        "class_name": ["class_name", "班级", "班级名称"],
        "subject": ["subject", "科目", "考试科目"],
        "score": ["score", "分数", "成绩"],
        "full_score": ["full_score", "满分", "总分"],
        "remark": ["remark", "备注", "说明"],
    }

    @staticmethod
    def validate_headers(headers) -> dict:
        errors = []
        if not headers:
            errors.append("Excel文件没有数据行")
            return {"valid": False, "errors": errors, "headers": headers}

        header_lower = [str(h).lower().strip() if h else "" for h in headers]
        required_fields = ["card_id", "subject", "score"]
        for field in required_fields:
            found = False
            for alias in ScoreImportHelper.HEADER_MAPPING.get(field, []):
                if alias.lower() in header_lower:
                    found = True
                    break
            if not found:
                errors.append(f"缺少必需列: {field}（或中文表头）")
        return {"valid": len(errors) == 0, "errors": errors, "headers": headers}

    @staticmethod
    def validate_excel_format(sheet) -> dict:
        """验证Excel格式是否正确（兼容旧接口）"""
        if sheet.max_row < 2:
            return {"valid": False, "errors": ["Excel文件没有数据行"], "headers": []}
        headers = [cell.value for cell in sheet[1]]
        return ScoreImportHelper.validate_headers(headers)

    @staticmethod
    def find_column_index(headers, target_column: str) -> int:
        """查找列的索引，支持模糊匹配和中英文表头"""
        aliases = ScoreImportHelper.HEADER_MAPPING.get(target_column, [target_column])

        for i, header in enumerate(headers):
            if header:
                header_str = str(header).lower().strip()
                for alias in aliases:
                    if alias.lower() in header_str:
                        return i
        return -1

    @staticmethod
    def parse_score_value(value) -> float:
        """解析分数值"""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def validate_score_range(score: float, full_score: float = 100) -> tuple:
        """验证分数是否在合理范围内"""
        if score is None:
            return False, "分数为空"

        if score < 0:
            return False, "分数不能为负数"

        if score > full_score * 1.5:
            return False, f"分数超过满分的150% ({full_score * 1.5})"

        return True, "valid"
