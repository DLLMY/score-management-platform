try:
    from services.wol_service import is_valid_mac
except ImportError:
    pass

try:
    from services.wol_service import wake_on_lan
except ImportError:
    pass

try:
    from services.wol_service import wake_multiple
except ImportError:
    pass


class TestWolService:
    """WOL唤醒服务测试"""

    def test_is_valid_mac_valid(self):
        """测试验证有效MAC地址"""
        from services.wol_service import is_valid_mac

        assert is_valid_mac("AA:BB:CC:DD:EE:FF") is True
        assert is_valid_mac("AA-BB-CC-DD-EE-FF") is True
        assert is_valid_mac("AABBCCDDEEFF") is True

    def test_is_valid_mac_invalid(self):
        """测试验证无效MAC地址"""

        assert is_valid_mac("AA:BB:CC:DD:EE") is False
        assert is_valid_mac("AA:BB:CC:DD:EE:FF:GG") is False
        assert is_valid_mac("XX:BB:CC:DD:EE:FF") is False
        assert is_valid_mac("") is False

    def test_wake_on_lan_invalid_mac(self):
        """测试唤醒无效MAC地址"""
        from services.wol_service import wake_on_lan

        result = wake_on_lan("invalid_mac")

        assert result is False

    def test_wake_multiple(self):
        """测试批量唤醒"""
        from services.wol_service import wake_multiple

        results = wake_multiple(["AA:BB:CC:DD:EE:FF", "invalid_mac"])

        assert isinstance(results, dict)
        assert "AA:BB:CC:DD:EE:FF" in results
        assert "invalid_mac" in results
