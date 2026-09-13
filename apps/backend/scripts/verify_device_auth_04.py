# -*- coding: utf-8 -*-
"""差异 #4 验证：设备认证凭证体系（阶段 1 白名单 + 阶段 2 签名 + 阶段 3 下发）。

纯逻辑验证，不依赖 Flask app_context —— 用轻量 stub 替代 Device 实例。
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.device_auth import (  # noqa: E402
    DEVICE_SIGNATURE_MAX_SKEW_SEC,
    compute_signature,
    should_register_unknown_device,
    verify_device_signature,
)

PASS = FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


class StubDevice:
    def __init__(self, device_id="pb-001", secret=None):
        self.device_id = device_id
        self.device_secret = secret


def main():
    global PASS, FAIL
    now = int(time.time())

    print("=== 阶段 2：无密钥设备必须放行（灰度兼容，零破坏） ===")
    dev_nosecret = StubDevice(secret=None)
    ok, reason = verify_device_signature(dev_nosecret, {"device_id": "pb-001"})
    check("无密钥 → 放行", ok is True and reason == "no_secret_configured", f"{ok},{reason}")

    ok, reason = verify_device_signature(None, {"device_id": "pb-001"})
    check("未登记设备(None) → 放行", ok is True and reason == "no_secret_configured", f"{ok},{reason}")

    print("=== 阶段 2：有密钥设备必须验签 ===")
    secret = "a" * 64
    dev = StubDevice(secret=secret)

    # 缺字段
    ok, reason = verify_device_signature(dev, {"device_id": "pb-001"})
    check("缺 ts/nonce/sig → 拒绝", ok is False and reason == "missing_signature_fields", f"{ok},{reason}")

    # 过期时间戳
    stale = now - DEVICE_SIGNATURE_MAX_SKEW_SEC - 60
    payload = {"device_id": "pb-001", "ts": stale, "nonce": "n1", "wifi_signal": -50}
    payload["sig"] = compute_signature(secret, "pb-001", stale, "n1", payload)
    ok, reason = verify_device_signature(dev, payload)
    check("时间戳超窗 → 拒绝", ok is False and reason == "timestamp_out_of_window", f"{ok},{reason}")

    # 未来时间戳超窗
    future = now + DEVICE_SIGNATURE_MAX_SKEW_SEC + 60
    payload = {"device_id": "pb-001", "ts": future, "nonce": "n1", "wifi_signal": -50}
    payload["sig"] = compute_signature(secret, "pb-001", future, "n1", payload)
    ok, reason = verify_device_signature(dev, payload)
    check("未来时间戳超窗 → 拒绝", ok is False and reason == "timestamp_out_of_window", f"{ok},{reason}")

    # 签名错误
    payload = {"device_id": "pb-001", "ts": now, "nonce": "n1", "wifi_signal": -50, "sig": "deadbeef"}
    ok, reason = verify_device_signature(dev, payload)
    check("签名不匹配 → 拒绝", ok is False and reason == "signature_mismatch", f"{ok},{reason}")

    # 合法签名
    payload = {"device_id": "pb-001", "ts": now, "nonce": "n1", "wifi_signal": -50}
    payload["sig"] = compute_signature(secret, "pb-001", now, "n1", payload)
    ok, reason = verify_device_signature(dev, payload)
    check("合法签名 → 通过", ok is True and reason == "ok", f"{ok},{reason}")

    # 篡改 payload 内容 → 签名失效
    tampered = dict(payload)
    tampered["wifi_signal"] = -20
    ok, reason = verify_device_signature(dev, tampered)
    check("篡改 payload → 拒绝", ok is False and reason == "signature_mismatch", f"{ok},{reason}")

    # 签名内容确定性（设备侧与后端须一致）
    s1 = compute_signature(secret, "pb-001", now, "n1", {"b": 2, "a": 1})
    s2 = compute_signature(secret, "pb-001", now, "n1", {"a": 1, "b": 2})
    check("签名字典序无关（确定性）", s1 == s2, f"{s1} vs {s2}")

    # 换 device_id 签名失效
    payload2 = {"device_id": "pb-999", "ts": now, "nonce": "n1", "wifi_signal": -50}
    payload2["sig"] = compute_signature(secret, "pb-001", now, "n1", payload2)
    dev999 = StubDevice(device_id="pb-999", secret=secret)
    ok, reason = verify_device_signature(dev999, payload2)
    check("换 device_id → 拒绝", ok is False and reason == "signature_mismatch", f"{ok},{reason}")

    print("=== 阶段 1：白名单开关默认关闭（零变化） ===")
    # 无 app_context 时读取失败 → 必须按关闭处理
    check("读取失败/未配置 → 允许注册（保持历史行为）", should_register_unknown_device() is True)

    print(f"\n=== 汇总: PASS={PASS} FAIL={FAIL} ===")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
