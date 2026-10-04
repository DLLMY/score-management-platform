"""G5: OTA 部署自检（OTA_FIRMWARE_BASE_URL）单元测试。

验证 check_ota_deploy_config 在生产 / force 模式下对「缺失 / 非法 scheme / 合法」三种
配置的判定与告警行为，以及非生产环境被安全跳过（不影响开发与测试）。

真实代码落点：services/ota_negotiation_service.py::check_ota_deploy_config
启动时挂载点：app/__init__.py::create_app（仅非 TESTING 调用，失败安全）。
"""

import logging

import pytest

from services.ota_negotiation_service import check_ota_deploy_config


class TestOtaDeployConfigCheck:
    def test_missing_config_warns_and_returns_false(self, monkeypatch, caplog):
        """生产 / force 模式下，OTA_FIRMWARE_BASE_URL 为空 → 高优告警 + 返回 False。"""
        monkeypatch.setattr(
            "services.ota_negotiation_service.OTA_FIRMWARE_BASE_URL", ""
        )
        with caplog.at_level(logging.WARNING, logger="services.ota_negotiation_service"):
            result = check_ota_deploy_config(force=True)
        assert result is False
        assert any("未配置 OTA_FIRMWARE_BASE_URL" in r.message for r in caplog.records)
        assert any(r.levelno >= logging.WARNING for r in caplog.records)

    def test_invalid_scheme_warns_and_returns_false(self, monkeypatch, caplog):
        """配置存在但不是 http(s) 绝对地址（如 ftp://）→ 高优告警 + 返回 False。"""
        monkeypatch.setattr(
            "services.ota_negotiation_service.OTA_FIRMWARE_BASE_URL", "ftp://example.com"
        )
        with caplog.at_level(logging.WARNING, logger="services.ota_negotiation_service"):
            result = check_ota_deploy_config(force=True)
        assert result is False
        assert any("配置非法" in r.message for r in caplog.records)

    def test_valid_config_ok(self, monkeypatch, caplog):
        """配置为合法 https 绝对地址 → 不告警 + 返回 True。"""
        monkeypatch.setattr(
            "services.ota_negotiation_service.OTA_FIRMWARE_BASE_URL",
            "https://phonebox.example.com",
        )
        with caplog.at_level(logging.WARNING, logger="services.ota_negotiation_service"):
            result = check_ota_deploy_config(force=True)
        assert result is True
        # 合法配置不应产生任何 WARNING 及以上记录
        assert not any(r.levelno >= logging.WARNING for r in caplog.records)

    def test_http_scheme_also_valid(self, monkeypatch, caplog):
        """http:// 绝对地址同样视为合法（内网 / 测试域名场景）。"""
        monkeypatch.setattr(
            "services.ota_negotiation_service.OTA_FIRMWARE_BASE_URL",
            "http://192.168.1.10:8080",
        )
        with caplog.at_level(logging.WARNING, logger="services.ota_negotiation_service"):
            result = check_ota_deploy_config(force=True)
        assert result is True
        assert not any(r.levelno >= logging.WARNING for r in caplog.records)

    def test_non_production_skipped(self, monkeypatch, caplog):
        """非生产环境（未设 APP_ENV=production）即使缺失配置也不告警、返回 True。"""
        monkeypatch.delenv("APP_ENV", raising=False)
        monkeypatch.setattr(
            "services.ota_negotiation_service.OTA_FIRMWARE_BASE_URL", ""
        )
        with caplog.at_level(logging.WARNING, logger="services.ota_negotiation_service"):
            result = check_ota_deploy_config(force=False)
        assert result is True
        assert not any(r.levelno >= logging.WARNING for r in caplog.records)
