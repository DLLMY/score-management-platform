"""P0-a 回归测试：生产环境密钥纵深防御（validate_secret_keys）。

覆盖：
1. _is_placeholder_secret 对占位/dev/弱密钥的识别。
2. 生产环境下使用 CHANGE_ME / dev / your_*_here 类密钥 → 拒绝启动（sys.exit）。
3. 生产环境下使用强密钥（>=32 位、非占位）→ 通过。
4. 开发环境下使用 dev 弱密钥 → 不拒绝（仅警告，服务继续启动）。
"""
import os
import sys
from unittest.mock import patch

import pytest


def _make_app(secret_key=""):
    class FakeApp:
        def __init__(self, sk):
            self.config = {"SECRET_KEY": sk}

    return FakeApp(secret_key)


def test_is_placeholder_secret_detects_patterns():
    from app.config_init import _is_placeholder_secret

    # 典型占位 / 弱密钥
    assert _is_placeholder_secret("CHANGE_ME_IN_PRODUCTION_use_at_least_32") is True
    assert _is_placeholder_secret("dev_secret_key_for_local_development_only") is True
    assert _is_placeholder_secret("your_csrf_secret_key_here_different") is True
    assert _is_placeholder_secret("") is True
    # 真正强密钥（随机、>=32、无占位片段）
    assert _is_placeholder_secret("aZ8$kQp2LmX9wRt5VbN7uYc3eF1gH4jKd") is False


def test_prod_rejects_placeholder_secret():
    """生产环境使用 .env.production 中的占位密钥必须拒绝启动。"""
    from app.config_init import validate_secret_keys

    strong = "aZ8$kQp2LmX9wRt5VbN7uYc3eF1gH4jKd"  # >=32，仅用于绕过 L40 长度校验
    env = {
        "FLASK_ENV": "production",
        "FLASK_SECRET_KEY": "CHANGE_ME_IN_PRODUCTION_use_at_least_32_characters_strong_key",
        "JWT_SECRET_KEY": "CHANGE_ME_IN_PRODUCTION_use_at_least_32_characters_strong_jwt_key",
        "CSRF_SECRET_KEY": "your_csrf_secret_key_here_different_from_flask_secret",
    }
    app = _make_app(strong)
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(SystemExit) as exc:
            validate_secret_keys(app)
        assert exc.value.code == 1


def test_prod_rejects_dev_weak_secret():
    """生产环境严禁 dev 前缀弱密钥。"""
    from app.config_init import validate_secret_keys

    dev_key = "dev_secret_key_for_local_development_only_change_in_production"
    env = {
        "FLASK_ENV": "production",
        "FLASK_SECRET_KEY": dev_key,
        "JWT_SECRET_KEY": "dev_jwt_secret_for_local_development_only_change",
        "CSRF_SECRET_KEY": "dev_csrf_secret_for_local_development_only_change",
    }
    app = _make_app(dev_key)
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(SystemExit) as exc:
            validate_secret_keys(app)
        assert exc.value.code == 1


def test_prod_accepts_strong_secret():
    """生产环境使用强密钥（>=32 位、非占位）应通过，不拒绝。"""
    from app.config_init import validate_secret_keys

    strong = "aZ8$kQp2LmX9wRt5VbN7uYc3eF1gH4jKd"
    env = {
        "FLASK_ENV": "production",
        "FLASK_SECRET_KEY": strong,
        "JWT_SECRET_KEY": "bY9%lWo3KnY8xSu6UcM2vZd4hG2iF5kLe",
        "CSRF_SECRET_KEY": "cX0&mEp4LoZ7yTv7VdN3wAe5jH3kG6mLf",
    }
    app = _make_app(strong)
    with patch.dict(os.environ, env, clear=False):
        assert validate_secret_keys(app) is True


def test_dev_allows_weak_secret():
    """非生产环境允许 dev 弱密钥（仅警告，不拒绝启动）。"""
    from app.config_init import validate_secret_keys

    dev_key = "dev_secret_key_for_local_development_only_change_in_production"
    env = {
        "FLASK_ENV": "development",
        "FLASK_SECRET_KEY": dev_key,
        "JWT_SECRET_KEY": "dev_jwt_secret_for_local_development_only_change",
        "CSRF_SECRET_KEY": "dev_csrf_secret_for_local_development_only_change",
    }
    app = _make_app(dev_key)
    with patch.dict(os.environ, env, clear=False):
        # 开发环境不应 sys.exit；返回 True（仅 warning 级别）
        assert validate_secret_keys(app) is True
