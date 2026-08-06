"""
分层行为数据种子脚本 v2
=======================
目的：按 RiskPredictService 的 detect_* 阈值反推，构造高/中/低三档风险人群，
      使 overall_risk_score >= 0.7 的 "high" 层级真实出现。

风险合成公式（services/risk_predict_service.py:410-419）：
    overall = 0.4*academic + 0.35*behavior + 0.25*attendance
    >=0.7 -> high, >=0.4 -> medium, else low

数据窗口设计：
  - 近 30 天内的 score_record  -> 驱动风险模型（趋势/正负比/活跃度/波动率）
  - 31~90 天前的 "开锁" 记录   -> 只驱动综合分的 compliance 维度
    （综合分的开锁统计无时间过滤，风险模型只看 30 天，故二者互不干扰）

用法：  python seed_behavior_v2.py
"""

import sqlite3
import random
import statistics
from datetime import datetime, timedelta

import numpy as np

DB = "instance/score_management.db"
RNG = random.Random(20260802)

COHORT_PLAN = {"high": 12, "medium": 25, "low": 63}

POS_DESC = [
    "课堂积极发言", "作业按时优秀完成", "主动帮助同学", "值日尽责", "小测进步明显",
    "参加社团活动表现突出", "遵守纪律受表扬",
]
NEG_DESC = [
    "迟到", "上课讲话被提醒", "作业未按时提交", "自习纪律扣分", "违反宿舍规定",
    "早读缺勤", "课堂玩手机被记录",
]
UNLOCK_DESC = ["手机开锁申请通过", "临时开锁记录", "违规开锁被记录"]


# --------------------------------------------------------------------------
# 各档位的行为时序生成器
# --------------------------------------------------------------------------
def gen_changes(cohort):
    """生成 30 天窗口内的 (天偏移, 分值变化) 序列。"""
    if cohort == "high":
        # 记录稀疏 (14/30=0.47 < 0.5) -> 触发 behavior +0.15 与 attendance +0.2
        n = 14
        changes = [RNG.randint(2, 5), RNG.randint(2, 5)]  # 仅开头 2 次正向 -> positive_rate=0.14
        for i in range(n - 2):
            # 大小幅度交替 -> 抬高波动率 std > 5
            changes.append(RNG.randint(-20, -11) if i % 2 == 0 else RNG.randint(-6, -1))
    elif cohort == "medium":
        n = 20
        changes = []
        for _ in range(n - 7):
            changes.append(RNG.randint(1, 4) if RNG.random() < 0.42 else RNG.randint(-9, -1))
        # 末尾连续 7 次非正向 -> no_positive_days >= 7
        for _ in range(7):
            changes.append(RNG.randint(-8, 0))
    else:  # low
        n = RNG.randint(25, 29)
        changes = []
        for _ in range(n):
            changes.append(RNG.randint(1, 6) if RNG.random() < 0.85 else RNG.randint(-3, -1))
        if changes[-1] <= 0:
            changes[-1] = RNG.randint(1, 5)

    days = sorted(RNG.sample(range(1, 30), len(changes)), reverse=True)  # 天偏移由远及近
    return list(zip(days, changes))


def gen_unlocks(cohort):
    """生成 31~90 天前的开锁记录条数（高风险学生违规开锁更多）。"""
    if cohort == "high":
        return RNG.randint(25, 40)
    if cohort == "medium":
        return RNG.randint(8, 22)
    return RNG.randint(0, 6)


def pick_current_score(cohort):
    """风险档位与当前积分相关联（高风险 -> 班级排名靠后 -> class_percentile < 30）。"""
    if cohort == "high":
        return RNG.randint(4, 18)
    if cohort == "medium":
        return RNG.randint(26, 46)
    return RNG.randint(52, 92)


# --------------------------------------------------------------------------
# 离线复现 risk_predict_service 的特征与判定，用于落库前自检
# --------------------------------------------------------------------------
def build_features(current_score, changes, class_scores, days=30):
    f = {"total_records": len(changes)}
    if changes:
        cumulative, cur = [], current_score - sum(changes)
        for c in changes:
            cur += c
            cumulative.append(cur)

        if len(cumulative) >= 2:
            x = np.arange(len(cumulative))
            f["score_trend_30d"] = round(float(np.polyfit(x, np.array(cumulative), 1)[0]), 2)
            if len(cumulative) >= 7:
                f["score_trend_7d"] = round(
                    float(np.polyfit(np.arange(7), np.array(cumulative[-7:]), 1)[0]), 2
                )
            else:
                f["score_trend_7d"] = 0.0
        else:
            f["score_trend_30d"] = f["score_trend_7d"] = 0.0

        f["score_volatility"] = round(float(np.std(changes)), 2)
        f["positive_rate"] = round(sum(1 for c in changes if c > 0) / len(changes), 2)
        f["negative_rate"] = round(sum(1 for c in changes if c < 0) / len(changes), 2)

        mx = cnt = 0
        for c in changes:
            cnt = cnt + 1 if c <= 0 else 0
            mx = max(mx, cnt)
        f["no_positive_days"] = mx
        f["daily_record_count"] = round(len(changes) / days, 2)
        f["score_decline_rate"] = (
            round((np.mean(cumulative[-7:]) - np.mean(cumulative[:-7])) / (np.mean(cumulative[:-7]) + 1), 2)
            if len(cumulative) >= 14
            else 0.0
        )
    else:
        f.update(
            score_trend_30d=0.0, score_trend_7d=0.0, score_volatility=0.0,
            positive_rate=0.0, negative_rate=0.0, no_positive_days=days,
            daily_record_count=0.0, score_decline_rate=0.0,
        )

    rank = sum(1 for s in class_scores if s > current_score) + 1
    f["class_percentile"] = round((len(class_scores) - rank + 1) / len(class_scores) * 100, 2)
    return f


def score_academic(f):
    s = 0.0
    if f["score_trend_30d"] < -0.5:
        s += 0.3
    if f["score_trend_7d"] < -1:
        s += 0.2
    if f["class_percentile"] < 30:
        s += 0.25
    if f["score_decline_rate"] < -0.1:
        s += 0.15
    return s


def score_behavior(f):
    s = 0.0
    if f["no_positive_days"] >= 7:
        s += 0.3
    elif f["no_positive_days"] >= 3:
        s += 0.15
    if f["negative_rate"] > 0.5:
        s += 0.25
    if f["positive_rate"] < 0.2:
        s += 0.2
    if f["daily_record_count"] < 0.5:
        s += 0.15
    return s


def score_attendance(f):
    s = 0.0
    if f["daily_record_count"] < 0.3:
        s += 0.4
    elif f["daily_record_count"] < 0.5:
        s += 0.2
    if f["score_volatility"] > 5:
        s += 0.2
    if f["total_records"] == 0:
        s += 0.3
    return s


def overall(f):
    o = 0.4 * score_academic(f) + 0.35 * score_behavior(f) + 0.25 * score_attendance(f)
    return o, ("high" if o >= 0.7 else "medium" if o >= 0.4 else "low")


# --------------------------------------------------------------------------
def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    student_ids = [r[0] for r in cur.execute("SELECT DISTINCT student_id FROM scores ORDER BY student_id")]
    print(f"目标学生数: {len(student_ids)}")

    # 分配档位
    shuffled = student_ids[:]
    RNG.shuffle(shuffled)
    cohort_of, i = {}, 0
    for name, cnt in COHORT_PLAN.items():
        for sid in shuffled[i:i + cnt]:
            cohort_of[sid] = name
        i += cnt
    for sid in shuffled[i:]:
        cohort_of[sid] = "low"

    # 1) 依据档位重设 current_score（风险档位需与班级排名一致）
    new_scores = {sid: pick_current_score(cohort_of[sid]) for sid in student_ids}
    cur.executemany("UPDATE user SET current_score=? WHERE id=?",
                    [(v, k) for k, v in new_scores.items()])

    # 2) 清空历史种子记录
    deleted = cur.execute("DELETE FROM score_record WHERE operator='system_seed'").rowcount
    print(f"清理旧种子记录: {deleted} 条")

    # 3) 生成行为时序 + 开锁记录
    now = datetime.now()
    rows, series_of, unlock_of = [], {}, {}
    for sid in student_ids:
        cohort = cohort_of[sid]

        seq = gen_changes(cohort)
        series_of[sid] = [c for _, c in seq]
        for day_off, change in seq:
            ts = now - timedelta(days=day_off, hours=RNG.randint(0, 10), minutes=RNG.randint(0, 59))
            desc = RNG.choice(POS_DESC if change > 0 else NEG_DESC)
            rows.append((sid, change, desc, "system_seed", ts.strftime("%Y-%m-%d %H:%M:%S")))

        # 开锁记录固定落在 31~90 天前，避开风险模型的 30 天窗口
        n_unlock = gen_unlocks(cohort)
        unlock_of[sid] = n_unlock
        for _ in range(n_unlock):
            ts = now - timedelta(days=RNG.randint(31, 90), hours=RNG.randint(0, 23))
            rows.append((sid, -1, RNG.choice(UNLOCK_DESC), "system_seed",
                         ts.strftime("%Y-%m-%d %H:%M:%S")))

    cur.executemany(
        "INSERT INTO score_record (user_id, score_change, description, operator, created_at) "
        "VALUES (?,?,?,?,?)",
        rows,
    )
    conn.commit()
    print(f"写入 score_record: {len(rows)} 条"
          f"（30天窗口内 {sum(len(v) for v in series_of.values())}，"
          f"开锁 {sum(unlock_of.values())}）")

    # 4) 落库前自检：离线复现风险判定
    class_of = dict(cur.execute(
        "SELECT id, class_name FROM user WHERE id IN (%s)" % ",".join("?" * len(student_ids)),
        student_ids,
    ).fetchall())
    by_class = {}
    for sid in student_ids:
        by_class.setdefault(class_of.get(sid), []).append(new_scores[sid])

    dist, samples = {"high": 0, "medium": 0, "low": 0}, []
    for sid in student_ids:
        f = build_features(new_scores[sid], series_of[sid], by_class[class_of.get(sid)])
        o, lvl = overall(f)
        dist[lvl] += 1
        samples.append((sid, cohort_of[sid], lvl, round(o, 3), f))

    print("\n=== 离线预测风险分布 ===")
    print(f"high={dist['high']}  medium={dist['medium']}  low={dist['low']}")

    print("\n=== high 档样例（前 3 名）===")
    for sid, coh, lvl, o, f in [s for s in samples if s[2] == "high"][:3]:
        print(f"  user {sid} 设计档={coh} 实测={lvl} overall={o} "
              f"| 学业={score_academic(f):.2f} 行为={score_behavior(f):.2f} 出勤={score_attendance(f):.2f}")
        print(f"      trend30={f['score_trend_30d']} trend7={f['score_trend_7d']} "
              f"pct={f['class_percentile']} decline={f['score_decline_rate']} "
              f"noPos={f['no_positive_days']} neg={f['negative_rate']} "
              f"pos={f['positive_rate']} daily={f['daily_record_count']} vol={f['score_volatility']}")

    mism = [s for s in samples if s[1] != s[2]]
    print(f"\n设计档位与实测不一致: {len(mism)} 人")
    for sid, coh, lvl, o, f in mism[:5]:
        print(f"  user {sid}: 设计={coh} 实测={lvl} overall={o}")

    us = list(unlock_of.values())
    print(f"\n开锁次数分布: min={min(us)} max={max(us)} avg={statistics.mean(us):.1f}")
    conn.close()


if __name__ == "__main__":
    main()
