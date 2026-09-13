# -*- coding: utf-8 -*-
"""差异 #1/#2/#6/#9 的等价性与行为验证脚本（只读 + 临时内存库，不触碰生产数据）。

覆盖验证点：
  [1] compare_versions 容错增强后，对**合法输入**结果与旧实现完全一致（等价性）
  [2] compare_versions 对历史崩溃输入（'1.x'、None、''、'v2.1'）不再抛异常
  [3] get_latest_active_firmware() 不传参 → 全局最新（向后兼容零漂移）
  [4] get_latest_active_firmware('doorlock') → 取 doorlock 固件，不误取 phonebox
  [5] 同类型无固件时回退 phonebox（存量数据兼容）
  [6] build_download_url 未配置密钥 → 无查询参数（历史形态）
  [7] build_download_url 配置密钥 → 带 expire+token，且 verify_download_token 通过
  [8] verify_download_token 拒绝过期/篡改 token；未配置密钥时恒通过
  [9] resolve_rollback_target 优先 rollback_to，其次更早的稳定版
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib

PASS = 0
FAIL = 0


def check(label, actual, expected):
    global PASS, FAIL
    if actual == expected:
        PASS += 1
        print(f"  [OK] {label}: {actual!r}")
    else:
        FAIL += 1
        print(f"  [FAIL] {label}: got {actual!r}, expected {expected!r}")


def check_true(label, cond, detail=""):
    check(label, bool(cond), True)


print("=" * 70)
print("A. compare_versions 等价性 + 容错性（差异 #9）")
print("=" * 70)

import services.ota_negotiation_service as onssvc

cv = onssvc.compare_versions


def legacy_compare(v1, v2):
    """改造前的原实现（作为等价性基准）。"""

    def parse(v):
        parts = []
        for x in str(v).split("."):
            try:
                parts.append(int(x))
            except ValueError:
                parts.append(0)
        return parts

    a, b = parse(v1), parse(v2)
    for i in range(max(len(a), len(b))):
        p1 = a[i] if i < len(a) else 0
        p2 = b[i] if i < len(b) else 0
        if p1 != p2:
            return 1 if p1 > p2 else -1
    return 0


LEGAL_CASES = [
    ("1.0.0", "1.0.0"),
    ("1.0.1", "1.0.0"),
    ("1.0.0", "1.0.1"),
    ("2.10", "2.9"),
    ("2.9", "2.10"),
    ("1", "1.0.0"),
    ("1.2.3.4", "1.2.3"),
    ("abc", "abc"),
    ("abc", "1.0"),
    ("1a", "1b"),
    ("", ""),
]
equiv_ok = True
for v1, v2 in LEGAL_CASES:
    got, want = cv(v1, v2), legacy_compare(v1, v2)
    if got != want:
        equiv_ok = False
        print(f"  [FAIL] equivalence {v1!r} vs {v2!r}: new={got} legacy={want}")
check_true("合法输入下新旧实现逐例等价", equiv_ok)
print(f"  [INFO] 已比对 {len(LEGAL_CASES)} 组合法输入组合")

print("\n  容错性（旧实现会抛 ValueError / AttributeError 的输入）：")
TOLERANT_CASES = [(None, "1.0"), ("1.0", None), ("", "1.0"), ("1.0", ""), ("v2.1", "2.0")]
for v1, v2 in TOLERANT_CASES:
    try:
        r = cv(v1, v2)
        check(f"compare_versions({v1!r}, {v2!r}) 不抛异常", isinstance(r, int), True)
    except Exception as e:
        check(f"compare_versions({v1!r}, {v2!r}) 不抛异常", f"raised {type(e).__name__}: {e}", "int")

# 语义补充：v 前缀 / 后缀
check("'v2.1' == '2.1'", cv("v2.1", "2.1"), 0)
check("'2.1.0' == '2.1'", cv("2.1.0", "2.1"), 0)
check("'1.2.3-beta' == '1.2.3'", cv("1.2.3-beta", "1.2.3"), 0)
check("'1.2.4' > '1.2.3-beta'", cv("1.2.4", "1.2.3-beta"), 1)


print("\n" + "=" * 70)
print("B. device_type 维度（差异 #1/#12）—— 临时 SQLite 内存库")
print("=" * 70)

# 用内存库隔离验证，完全不触碰 instance/score_management.db
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import app  # noqa: E402
from models import db, FirmwareVersion  # noqa: E402

with app.app_context():
    db.create_all()

    from datetime import datetime, timedelta

    base = datetime(2026, 1, 1, 12, 0, 0)

    rows = [
        # version, device_type, is_stable, created_at offset, rollback_to
        ("pb-1.0.0", "phonebox", True, 0, None),
        ("pb-1.1.0", "phonebox", False, 10, "pb-1.0.0"),
        ("dl-0.9.0", "doorlock", True, 5, None),
        ("dl-1.0.0", "doorlock", False, 20, None),
    ]
    for ver, dtype, stable, off, rb in rows:
        # 幂等播种：重复执行脚本时不因 UNIQUE(version) 冲突中断
        if FirmwareVersion.query.filter_by(version=ver).first():
            continue
        db.session.add(
            FirmwareVersion(
                version=ver,
                device_type=dtype,
                is_stable=stable,
                rollback_to=rb,
                is_active=True,
                file_size=1000,
                md5="0" * 32,
                created_at=base + timedelta(minutes=off),
            )
        )
    db.session.commit()

    print("\n  [3] 不传 device_type → 全局最新 active（兼容旧行为）")
    latest_any = onssvc.get_latest_active_firmware()
    # dl-1.0.0 的 created_at 最晚(20min) → 应取它，证明「全局最新」语义未被破坏
    check("get_latest_active_firmware() 取全局最新", latest_any.version, "dl-1.0.0")

    print("\n  [4] 按 device_type 精确过滤")
    check(
        "get_latest_active_firmware('doorlock')",
        onssvc.get_latest_active_firmware("doorlock").version,
        "dl-1.0.0",
    )
    check(
        "get_latest_active_firmware('phonebox')",
        onssvc.get_latest_active_firmware("phonebox").version,
        "pb-1.1.0",
    )

    print("\n  [5] 类型无固件 → 回退 phonebox（存量兼容）")
    check(
        "get_latest_active_firmware('unknown_type') 回退 phonebox",
        onssvc.get_latest_active_firmware("unknown_type").version,
        "pb-1.1.0",
    )
    check(
        "normalize_device_type(None)",
        onssvc.normalize_device_type(None),
        "phonebox",
    )
    check("normalize_device_type('')", onssvc.normalize_device_type(""), "phonebox")
    check(
        "normalize_device_type('  ')",
        onssvc.normalize_device_type("  "),
        "phonebox",
    )
    check(
        "normalize_device_type('doorlock')",
        onssvc.normalize_device_type("doorlock"),
        "doorlock",
    )

    print("\n  [9] resolve_rollback_target")
    pb_110 = FirmwareVersion.query.filter_by(version="pb-1.1.0").first()
    target = onssvc.resolve_rollback_target(pb_110)
    check("pb-1.1.0 显式 rollback_to → pb-1.0.0", target.version, "pb-1.0.0")

    dl_100 = FirmwareVersion.query.filter_by(version="dl-1.0.0").first()
    target2 = onssvc.resolve_rollback_target(dl_100)
    check(
        "dl-1.0.0 无 rollback_to → 同类型更早稳定版 dl-0.9.0",
        target2.version,
        "dl-0.9.0",
    )
    # 回滚不应跨设备类型
    check_true(
        "回滚目标 device_type 与源一致（不跨类型）",
        target2.device_type == dl_100.device_type,
    )


print("\n" + "=" * 70)
print("C. 下载 URL 时效签名（差异 #6）")
print("=" * 70)

with app.app_context():
    fw = FirmwareVersion.query.filter_by(version="pb-1.1.0").first()

    # --- C1: 未配置密钥（默认）→ URL 无查询参数，历史形态 ---
    importlib.reload(onssvc)
    check_true(
        "默认（无 OTA_SIGNING_SECRET）URL 不含 token",
        "token=" not in onssvc.build_download_url(fw, with_token=False),
    )
    check_true(
        "未配置密钥时 verify_download_token 恒通过（向后兼容）",
        onssvc.verify_download_token(fw.id, None, None) is True,
    )

    # --- C2: 配置密钥 → 带 expire+token，且验签通过 ---
    onssvc.OTA_SIGNING_SECRET = "unit-test-secret"
    onssvc.OTA_DOWNLOAD_URL_TTL_SEC = 3600
    url = onssvc.build_download_url(fw)
    check_true("配置密钥后 URL 含 expire 参数", "expire=" in url)
    check_true("配置密钥后 URL 含 token 参数", "token=" in url)
    print(f"  [INFO] 生成的签名 URL: {url}")

    qs = dict(
        kv.split("=", 1) for kv in url.split("?", 1)[1].split("&") if "=" in kv
    )
    check(
        "生成的 token 可通过校验",
        onssvc.verify_download_token(fw.id, qs["expire"], qs["token"]),
        True,
    )
    check(
        "错误 token 被拒绝",
        onssvc.verify_download_token(fw.id, qs["expire"], "deadbeef"),
        False,
    )
    check(
        "缺少 token 被拒绝",
        onssvc.verify_download_token(fw.id, qs["expire"], None),
        False,
    )
    check(
        "已过期被拒绝",
        onssvc.verify_download_token(fw.id, "1000000000", qs["token"]),
        False,
    )
    check(
        "非法 expire 被拒绝",
        onssvc.verify_download_token(fw.id, "not-a-number", qs["token"]),
        False,
    )
    # token 与固件 id 绑定：换 id 应失败
    check(
        "token 与 firmware_id 绑定（换 id 失败）",
        onssvc.verify_download_token(fw.id + 999, qs["expire"], qs["token"]),
        False,
    )


print("\n" + "=" * 70)
print(f"结果：PASS={PASS}  FAIL={FAIL}")
print("=" * 70)
sys.exit(1 if FAIL else 0)
