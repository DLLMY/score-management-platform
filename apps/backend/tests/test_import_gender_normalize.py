"""R16 回归测试：批量导入行级容错 + 性别口径归一化。

⚠️ 本文件刻意只依赖 `utils.validation`（纯函数模块，不拉起 models/app 生态），
源码守卫通过直接读取源文件文本实现，避免 `import services.import_export_service`
触发完整 app 导入。
"""

from pathlib import Path

import pytest

from utils.validation import GENDER_NORMALIZE_MAP, normalize_gender

# 权威性别口径（utils.security.validate_gender 的判定集合，此处内联以避免拉起 config/app）
CANONICAL_GENDERS = {"男", "女"}

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class TestNormalizeGender:
    """性别归一化：导入层英文/缩写写法统一落库为中文。"""

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("male", "男"),
            ("MALE", "男"),
            ("m", "男"),
            ("M", "男"),
            ("female", "女"),
            ("Female", "女"),
            ("f", "女"),
            ("F", "女"),
        ],
    )
    def test_normalizes_english_and_abbrev(self, raw, expected):
        assert normalize_gender(raw) == expected

    @pytest.mark.parametrize("raw", ["男", "女"])
    def test_passthrough_chinese(self, raw):
        assert normalize_gender(raw) == raw

    @pytest.mark.parametrize("raw", ["", None, "其他", "unknown"])
    def test_passthrough_unknown_and_empty(self, raw):
        """未知/空值原样返回，交由 validate_gender 报错（不做跨语义合并）。"""
        assert normalize_gender(raw) == raw

    def test_whitespace_tolerant(self):
        assert normalize_gender("  male  ") == "男"
        assert normalize_gender("  F  ") == "女"

    def test_non_str_passthrough(self):
        assert normalize_gender(123) == 123

    def test_map_covers_all_import_aliases(self):
        """映射表必须覆盖导入层白名单中的全部英文/缩写别名。"""
        for alias in ("male", "female", "m", "f"):
            assert alias in GENDER_NORMALIZE_MAP

    def test_normalized_output_always_passes_system_validator(self):
        """归一化的核心契约：归一化结果必须落在系统权威性别口径内。"""
        for alias in GENDER_NORMALIZE_MAP:
            assert normalize_gender(alias) in CANONICAL_GENDERS


class TestBulkImportUsersRowTolerance:
    """bulk_import_users 行级容错：短行不得触发整批回滚。

    回归缺陷：行短于 5 列时 row[0] 抛 IndexError，行级 except 内引用未绑定的
    name/row_data 会抛 UnboundLocalError 逃逸出循环 → 整批 rollback（违背逐行容错设计）。
    修复：循环体 try 之前预绑定 name/row_data（对齐 CSV 导入的 locals() 守卫做法）。
    """

    @staticmethod
    def _bulk_import_users_source() -> str:
        src = (BACKEND_ROOT / "services" / "import_export_service.py").read_text(encoding="utf-8")
        # 截取 bulk_import_users 函数体（到下一个顶层 def/class 为止）
        start = src.index("def bulk_import_users(rows):")
        rest = src[start + len("def bulk_import_users(rows):") :]
        end = rest.find("\ndef ")
        return rest[:end] if end != -1 else rest

    def test_name_prebound_before_try(self):
        body = self._bulk_import_users_source()
        loop_body = body.split("for row_idx, row in enumerate(rows, start=2):", 1)[1]
        pre_try = loop_body.split("try:", 1)[0]
        assert 'name = ""' in pre_try, "name 必须在 try 之前预绑定"

    def test_row_data_prebound_before_try(self):
        body = self._bulk_import_users_source()
        loop_body = body.split("for row_idx, row in enumerate(rows, start=2):", 1)[1]
        pre_try = loop_body.split("try:", 1)[0]
        assert "row_data = {}" in pre_try, "row_data 必须在 try 之前预绑定"

    def test_gender_normalized_before_persist(self):
        """create_user_row 调用必须传入归一化后的性别。"""
        body = self._bulk_import_users_source()
        assert "normalize_gender(gender)" in body, "落库前必须归一化性别"


class TestCsvImportGenderConsistency:
    """CSV 导入路径（users_routes）同样归一化，保持两条导入路径口径一致。"""

    @staticmethod
    def _users_routes_source() -> str:
        return (BACKEND_ROOT / "api" / "users" / "users_routes.py").read_text(encoding="utf-8")

    def test_build_csv_user_normalizes_gender(self):
        src = self._users_routes_source()
        start = src.index("def _build_csv_user(row_dict, current_score_int):")
        body = src[start : src.index("def ", start + 10)]
        assert "normalize_gender(" in body, "新建用户时必须归一化性别"

    def test_build_csv_user_updates_normalizes_gender(self):
        src = self._users_routes_source()
        start = src.index("def _build_csv_user_updates(row_dict, current_score_int):")
        body = src[start : src.index("\nimport ", start)]
        assert 'updates["gender"] = normalize_gender(' in body, "更新用户时必须归一化性别"

    def test_normalize_gender_imported(self):
        src = self._users_routes_source()
        import_block = src[: src.index("ns_") if "ns_" in src else 2000]
        assert "normalize_gender" in import_block, "必须导入 normalize_gender"

    def test_gender_whitelist_case_insensitive(self):
        """校验层必须大小写不敏感且复用 GENDER_NORMALIZE_MAP（与归一化口径同源）。"""
        src = (BACKEND_ROOT / "services" / "import_export_service.py").read_text(
            encoding="utf-8"
        )
        assert "*GENDER_NORMALIZE_MAP" in src, "校验层必须复用 GENDER_NORMALIZE_MAP"
        assert '"male", "female", "m", "f"' not in src, "旧的大小写敏感白名单必须移除"

    def test_users_routes_whitelist_case_insensitive(self):
        src = self._users_routes_source()
        assert src.count("*GENDER_NORMALIZE_MAP") >= 2, "两处性别校验都应复用映射表"
        assert '"male", "female", "m", "f"' not in src, "旧白名单必须全部移除"
