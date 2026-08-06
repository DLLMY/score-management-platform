"""只读验证：班主任手机箱开箱策略的当前判定结果。

不写库、不发 MQTT，仅基于真实数据库打印：
  - 各班策略配置（总开关 / 预设时段 / 一键放行剩余时间）
  - 此刻 evaluate() 的判定（ALLOW_OVERRIDE / ALLOW_WINDOW / BLOCK / DEFER）
  - DEFER 时会落到哪条既有逻辑（全局 TimeRule + 课表反查）

用法：
  python scripts/verify_phonebox_policy.py                 # 全部有策略的班级
  python scripts/verify_phonebox_policy.py --class-info-id 1
  python scripts/verify_phonebox_policy.py --at 14:30      # 指定时刻做假设推演
"""

import argparse
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DECISION_LABEL = {
    "allow_override": "放行（班主任一键放行中）",
    "allow_window": "放行（命中班主任预设时段）",
    "block": "拒绝（班主任已关闭本班自助开箱）",
    "defer": "交由全局规则判定",
}

WEEK = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]


def _fmt_windows(windows):
    if not windows:
        return "（未设置）"
    parts = []
    for w in windows:
        day = w.get("day", -1)
        day_label = "每天" if day == -1 else WEEK[day] if 0 <= day <= 6 else f"day={day}"
        parts.append(
            f"{day_label} {int(w.get('start_hour', 0)):02d}:{int(w.get('start_minute', 0)):02d}"
            f"-{int(w.get('end_hour', 0)):02d}:{int(w.get('end_minute', 0)):02d}"
        )
    return "; ".join(parts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--class-info-id", type=int, default=None, help="只看某个班级")
    parser.add_argument("--at", type=str, default=None, help="假设时刻 HH:MM（默认现在）")
    args = parser.parse_args()

    from app import create_app
    from models import PhoneBoxPolicy, ClassInfo
    from services import phonebox_policy as svc
    from services.class_time_checker import ClassTimeChecker

    # 只读脚本用轻量模式即可（跳过全文索引等重初始化），仍会初始化 DB
    app = create_app(lightweight=True)
    with app.app_context():
        now = datetime.now()
        if args.at:
            h, m = args.at.split(":")
            now = now.replace(hour=int(h), minute=int(m), second=0, microsecond=0)

        print("=" * 72)
        print(f"判定时刻：{now:%Y-%m-%d %H:%M}（{WEEK[now.weekday()]}）")
        print("=" * 72)

        query = PhoneBoxPolicy.query
        if args.class_info_id:
            query = query.filter_by(class_info_id=args.class_info_id)
        policies = query.all()

        if not policies:
            scope = f"班级 {args.class_info_id}" if args.class_info_id else "任何班级"
            print(f"\n{scope} 尚未配置班主任策略 —— 全部按原有全局 TimeRule + 课表逻辑执行。")
            return

        for p in policies:
            cls = ClassInfo.query.get(p.class_info_id)
            name = cls.name if cls else f"class_info_id={p.class_info_id}"
            print(f"\n【{name}】")
            print(f"  自助开箱总开关 : {'开启' if p.allow_self_unlock else '关闭'}")
            print(f"  预设允许时段   : {_fmt_windows(p.unlock_windows)}")
            if p.override_until and p.override_until > now:
                left = int((p.override_until - now).total_seconds() // 60)
                print(f"  一键临时放行   : 生效中，剩余 {left} 分钟（至 {p.override_until:%H:%M}）")
            else:
                print("  一键临时放行   : 未启用")

            result = svc.evaluate(p.class_info_id, now)
            decision = result.get("decision")
            print(f"  >> 策略判定    : {DECISION_LABEL.get(decision, decision)}")

            if decision == "defer":
                try:
                    in_session, info = ClassTimeChecker.check_class_in_session(
                        p.class_info_id, now
                    )
                    if in_session:
                        print(
                            f"  >> 回退判定    : 拒绝（正在第{info['period_number']}节"
                            f"《{info['subject_name']}》，上课时间禁止开箱）"
                        )
                    else:
                        print("  >> 回退判定    : 非上课时间，再看全局 TimeRule 与积分门槛")
                except Exception as e:  # noqa: BLE001
                    print(f"  >> 回退判定    : 课表反查异常（{e}），按放行处理")

        print("\n说明：ALLOW_* 会跳过上课硬拦截直达积分扣减，但积分 <60 仍会被拒（score_low）。")


if __name__ == "__main__":
    main()
