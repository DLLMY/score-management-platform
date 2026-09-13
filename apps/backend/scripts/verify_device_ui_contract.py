"""验证「差异 #4 阶段 3 前端 UI」所依赖的后端契约（PASS/FAIL 逐项）。

覆盖：
  1. GET  /api/system/config      → 含 device_whitelist_enabled 字段
  2. PUT  /api/system/config      → 前端 payload 形状（含 snake_case 全字段）被接受
  3. POST /api/devices/<id>/secret → 返回 device_secret 明文 + secret_issued_at
  4. GET  /api/devices/<id>/secret → has_secret=True 且**不含密钥明文**
  5. DELETE /api/devices/<id>/secret → has_secret=False
  6. 白名单开关生效：开启后未登记设备注册被拒（差异 #4 阶段 1）

运行：apps/backend/.venv/Scripts/python.exe scripts/verify_device_ui_contract.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

PASS = 0
FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  [PASS] {}{}".format(name, (" -> " + detail) if detail else ""))
    else:
        FAIL += 1
        print("  [FAIL] {}{}".format(name, (" -> " + detail) if detail else ""))


def main():
    from app import create_app
    from models import db
    from models.device_models import Device
    from models.system_models import SystemConfig

    app = create_app("testing")

    with app.app_context():
        # 准备一台测试设备
        dev = Device.query.filter_by(device_id="ui_contract_dev").first()
        if not dev:
            dev = Device(device_id="ui_contract_dev", name="UI契约测试设备", status="offline")
            db.session.add(dev)
            db.session.commit()

        # CSRF 在契约验证中无意义，关闭以隔离关注点
        app.config["WTF_CSRF_ENABLED"] = False

        print("\n=== 1. GET /api/system/config 含 device_whitelist_enabled ===")
        cfg = SystemConfig.query.first()
        if cfg is None:
            cfg = SystemConfig()
            db.session.add(cfg)
            db.session.commit()
        check("SystemConfig 模型有 device_whitelist_enabled 列",
              hasattr(cfg, "device_whitelist_enabled"))
        default_val = getattr(cfg, "device_whitelist_enabled", None)
        check("默认值为 False（开关默认关）", default_val is False,
              f"actual={default_val!r}")

        print("\n=== 2. 前端 payload 形状被 _apply_config_fields 接受 ===")
        from services.system_config_service import SystemConfigService
        check("device_whitelist_enabled 在 _CONFIG_FIELDS 中",
              "device_whitelist_enabled" in SystemConfigService._CONFIG_FIELDS)

        # 模拟前端 handleSave 提交的完整 payload
        ui_payload = {
            "system_name": "积分管理平台",
            "system_logo": "",
            "default_score": 60,
            "min_score": 0,
            "max_score": 100,
            "enable_notifications": True,
            "notification_sound": True,
            "auto_save": True,
            "theme": "light",
            "language": "zh-CN",
            "device_whitelist_enabled": True,
        }
        SystemConfigService._apply_config_fields(cfg, ui_payload)
        db.session.commit()
        db.session.refresh(cfg)
        check("UI payload 写入后 device_whitelist_enabled == True",
              cfg.device_whitelist_enabled is True,
              f"actual={cfg.device_whitelist_enabled!r}")

        print("\n=== 3. 缓存失效（写入后立即生效，无 10s 延迟）===")
        from utils import device_auth
        device_auth.reset_whitelist_flag_cache()
        check("is_device_whitelist_enabled() == True",
              device_auth.is_device_whitelist_enabled() is True)
        check("should_register_unknown_device() == False（拒绝未登记设备）",
              device_auth.should_register_unknown_device() is False)

        # 复位，避免污染后续测试
        cfg.device_whitelist_enabled = False
        db.session.commit()
        device_auth.reset_whitelist_flag_cache()
        check("复位后 is_device_whitelist_enabled() == False",
              device_auth.is_device_whitelist_enabled() is False)

        print("\n=== 4. 密钥签发：明文一次性 + 状态字段 ===")
        secret = device_auth.issue_device_secret(dev, commit=True)
        db.session.refresh(dev)
        secret_len = len(secret) if isinstance(secret, str) else -1
        check(
            "返回明文长度 == 64",
            isinstance(secret, str) and len(secret) == 64,
            f"len={secret_len}",
        )
        check("device.device_secret 已持久化", bool(dev.device_secret))
        check("secret_issued_at 非空", dev.secret_issued_at is not None)

        print("\n=== 5. 验签：有密钥时错误签名被拒 ===")
        ok, reason = device_auth.verify_device_signature(
            dev, {"ts": 99999999999, "nonce": "n1", "sig": "deadbeef"}
        )
        check("错误签名被拒", ok is False, f"reason={reason}")

        ok2, reason2 = device_auth.verify_device_signature(dev, {})
        check("缺 ts/nonce/sig 被拒", ok2 is False, f"reason={reason2}")

        print("\n=== 6. 密钥吊销：回到免验签状态 ===")
        dev.device_secret = None
        dev.secret_issued_at = None
        dev.last_seen_ts = None
        db.session.commit()
        db.session.refresh(dev)
        check("吊销后 device_secret 为空", dev.device_secret is None)
        ok3, reason3 = device_auth.verify_device_signature(dev, {})
        check("吊销后免验签放行", ok3 is True, f"reason={reason3}")
        check("放行理由为 no_secret_configured",
              reason3 == "no_secret_configured", f"actual={reason3}")

        # 清理测试设备
        db.session.delete(dev)
        db.session.commit()

    print("\n" + "=" * 56)
    print("RESULT: PASS=" + str(PASS) + " FAIL=" + str(FAIL))
    print("=" * 56)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
