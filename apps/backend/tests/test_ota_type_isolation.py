"""OTA 多设备类型隔离测试（Step C / F1 阶段 B 验收闸门）。

验证 get_latest_active_firmware 与 negotiate 已按 device_type 维度隔离：
① 同类型取最新、异类型互不串推；② device_type=None 回退 phonebox；
③ 设备已是最新 → up_to_date；④ 该类型无固件 → 回退 phonebox（向后兼容）。

注：FirmwareVersion.version 仍为全局唯一（走计划"应用层校验"退路，未改复合唯一），
故不测试"跨类型同名版本共存"。negotiate 仅读取 device.device_type，故用 MagicMock
构建设备即可，无需真实 Device 行。
"""
from unittest.mock import MagicMock

from models import db, FirmwareVersion
from services.ota_negotiation_service import (
    get_latest_active_firmware,
    negotiate,
    resolve_rollback_target,
)


def _fw(version, device_type, is_active=True):
    return FirmwareVersion(
        version=version,
        device_type=device_type,
        is_active=is_active,
        file_path="/tmp/fw.bin",
        md5="deadbeef",
    )


def _device(device_type):
    d = MagicMock()
    d.device_type = device_type
    return d


class TestOtaTypeIsolation:
    def test_latest_distinguishes_type(self, app):
        with app.app_context():
            db.session.add_all([
                _fw("2.0.0", "phonebox"),
                _fw("1.0.0", "doorlock"),
            ])
            db.session.commit()
            pb = get_latest_active_firmware("phonebox")
            dl = get_latest_active_firmware("doorlock")
            assert pb is not None and pb.device_type == "phonebox" and pb.version == "2.0.0"
            assert dl is not None and dl.device_type == "doorlock" and dl.version == "1.0.0"

    def test_no_cross_type_push(self, app):
        with app.app_context():
            db.session.add_all([
                _fw("2.0.0", "phonebox"),
                _fw("1.0.0", "doorlock"),
            ])
            db.session.commit()
            # phonebox 设备落后 -> 应升级到 phonebox 固件，而非 doorlock
            dec_pb = negotiate(_device("phonebox"), "1.0.0")
            assert dec_pb["action"] == "upgrade"
            assert dec_pb["device_type"] == "phonebox"
            assert dec_pb["firmware"].device_type == "phonebox"
            # doorlock 设备落后 -> 应升级到 doorlock 固件，而非 phonebox
            dec_dl = negotiate(_device("doorlock"), "0.9.0")
            assert dec_dl["action"] == "upgrade"
            assert dec_dl["device_type"] == "doorlock"
            assert dec_dl["firmware"].device_type == "doorlock"

    def test_none_device_type_falls_back_to_phonebox(self, app):
        with app.app_context():
            db.session.add_all([
                _fw("2.0.0", "phonebox"),
                _fw("1.0.0", "doorlock"),
            ])
            db.session.commit()
            # device_type=None（未上报类型）-> 归一为 phonebox -> 取 phonebox 最新
            dec = negotiate(_device(None), "1.0.0")
            assert dec["action"] == "upgrade"
            assert dec["device_type"] == "phonebox"
            # 直接查 None -> 全局最新 active（按 created_at 倒序其一）
            latest = get_latest_active_firmware(None)
            assert latest is not None and latest.is_active is True

    def test_type_without_firmware_falls_back_to_phonebox(self, app):
        with app.app_context():
            db.session.add(_fw("2.0.0", "phonebox"))
            db.session.commit()
            # 仅 phonebox 固件；doorlock 类型查询应回退到 phonebox（向后兼容）
            dl = get_latest_active_firmware("doorlock")
            assert dl is not None and dl.device_type == "phonebox"

    def test_up_to_date_no_push(self, app):
        with app.app_context():
            db.session.add(_fw("2.0.0", "phonebox"))
            db.session.commit()
            dec = negotiate(_device("phonebox"), "2.0.0")
            assert dec["action"] == "up_to_date"
            assert "firmware" not in dec


class TestOtaRollback:
    def test_rollback_target_same_type(self, app):
        # 使用 98.x 唯一版本号，规避测试库跨用例非回滚隔离导致的残留串扰
        with app.app_context():
            db.session.add_all([
                _fw("98.0.0", "doorlock"),
                _fw("98.0.1", "doorlock"),
            ])
            db.session.commit()
            dl = FirmwareVersion.query.filter_by(
                version="98.0.1", device_type="doorlock"
            ).first()
            dl.rollback_to = "98.0.0"
            db.session.commit()
            target = resolve_rollback_target(dl)
            assert target is not None
            assert target.device_type == "doorlock"
            assert target.version == "98.0.0"

    def test_rollback_target_no_cross_type(self, app):
        # 使用 98.1.x 唯一版本号；phonebox 98.1.0 与 doorlock 98.1.1 共存
        with app.app_context():
            db.session.add_all([
                _fw("98.1.0", "phonebox"),
                _fw("98.1.1", "doorlock"),
            ])
            db.session.commit()
            dl = FirmwareVersion.query.filter_by(
                version="98.1.1", device_type="doorlock"
            ).first()
            dl.rollback_to = "98.1.0"
            db.session.commit()
            # 同名版本仅存在于 phonebox，同类型（doorlock）无目标 -> 必须返回 None，
            # 绝不能跨类型解析到 phonebox 的 98.1.0（否则门铃被刷成手机箱固件→变砖）。
            target = resolve_rollback_target(dl)
            assert target is None
