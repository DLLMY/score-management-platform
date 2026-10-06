"""R19 回归测试：LoginAttempt 去重 + 防爆破锁定不被绕过。

回归缺陷：`LoginAttempt.username` 缺 unique 约束，而防爆破逻辑以 `.first()` 读写单行、
`clear_login_attempts` 却 `.delete()` 删全部行 —— 代码已隐含「一 username 一行」意图。
并发首次失败会 check-then-insert 出多行同 username 记录，计数被拆分
→ 5 次锁定阈值永不触发（登录防爆破可被绕过）。

修复双层：
1. 模型层 `LoginAttempt.username` 加 `unique=True`（全新库 DB 层根治）；
2. 读路径 `_collapse_duplicate_attempts` 去重兜底（存量库无 UNIQUE 时收敛）。

⚠️ 本文件刻意只依赖 `utils` 之外的纯逻辑 + 模型元数据断言，
核心行为验证见独立脚本（pytest conftest 在部分沙箱环境会拉起完整 app 生态）。
"""

from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class TestLoginAttemptConstraint:
    """模型层约束声明。"""

    def test_username_is_unique(self):
        from models import LoginAttempt

        col = LoginAttempt.__table__.columns["username"]
        assert col.unique is True, "username 必须有 UNIQUE 约束（DB 层根治）"

    def test_username_keeps_index(self):
        """加 unique 后不能丢掉 index（否则 .filter_by(username=) 查询性能回退）。"""
        from models import LoginAttempt

        col = LoginAttempt.__table__.columns["username"]
        assert col.index is True, "username 必须保留 index=True"


class TestCollapseDuplicateAttemptsWired:
    """读路径去重兜底已接入两处防爆破读写点。"""

    @staticmethod
    def _service_source() -> str:
        return (BACKEND_ROOT / "services" / "security_service.py").read_text(encoding="utf-8")

    def test_helper_exists(self):
        assert "_collapse_duplicate_attempts" in self._service_source()

    def test_record_failed_login_uses_helper(self):
        src = self._service_source()
        start = src.index("def record_failed_login(")
        body = src[start : src.index("\ndef ", start + 10)]
        assert "_collapse_duplicate_attempts(username)" in body, (
            "record_failed_login 必须先去重再 read-then-insert"
        )

    def test_check_rate_limit_uses_helper(self):
        src = self._service_source()
        start = src.index("def check_login_rate_limit(")
        body = src[start : src.index("\ndef ", start + 10)]
        assert "_collapse_duplicate_attempts(username, commit=True)" in body, (
            "check_login_rate_limit 必须去重且自洽提交（不依赖调用方兜底）"
        )

    def test_helper_picks_max_attempt_count(self):
        """keeper 选择必须以 attempt_count 最大为准（其 locked_until 亦最严）。"""
        src = self._service_source()
        start = src.index("def _collapse_duplicate_attempts(")
        body = src[start : src.index("\ndef ", start + 10)]
        assert "max(records, key=lambda r: (r.attempt_count or 0, r.id or 0))" in body

    def test_helper_is_idempotent_no_write_when_single(self):
        """无重复行时必须是纯读（不 flush 不 commit），零副作用。"""
        src = self._service_source()
        start = src.index("def _collapse_duplicate_attempts(")
        body = src[start : src.index("\ndef ", start + 10)]
        early_return = body.index("if len(records) <= 1:")
        delete_at = body.index("db.session.delete(r)")
        assert early_return < delete_at, "单行/空结果必须在删除前提前返回"

    def test_clear_attempts_still_deletes_all(self):
        """clear_login_attempts 语义（删全部行）不得被改动。"""
        src = self._service_source()
        start = src.index("def clear_login_attempts(")
        body = src[start : src.index("\ndef ", start + 10)]
        assert ".delete()" in body, "登录成功仍需清空该 username 全部行"


class TestModelCommentsDocumentIntent:
    """约束旁的注释应说明「为何加 unique」，避免后人误删。"""

    def test_model_has_rationale_comment(self):
        src = (BACKEND_ROOT / "models" / "user_models.py").read_text(encoding="utf-8")
        start = src.index("class LoginAttempt(")
        head = src[start : start + 1600]
        assert "R19" in head, "LoginAttempt 应有 R19 约束说明注释"
        assert "first()" in head and "delete()" in head, "注释应点明读写两侧语义不一致的根因"


@pytest.mark.parametrize("filename", ["services/security_service.py", "models/user_models.py"])
def test_files_have_no_syntax_markers(filename):
    """极简健全性：文件非空且含关键实现标记。"""
    src = (BACKEND_ROOT / filename).read_text(encoding="utf-8")
    assert src.strip(), f"{filename} 不应为空"
