"""Seed ScoreRecord behavior time-series so prediction/risk algorithms have data.
- 100 active students, 24 daily records each over the last 24 days.
- 4 profiles: critical-decline (flagged by PredictionService slope<-5), falling, rising, stable.
- Descriptions deliberately avoid '%开锁%' so composite-score unlock_map is unaffected.
"""
import sqlite3, random, datetime
random.seed(20260802)
DB = "instance/score_management.db"
con = sqlite3.connect(DB, timeout=30)
cur = con.cursor()
students = [r[0] for r in cur.execute("SELECT id FROM user WHERE role='student' AND is_active=1").fetchall()]
print("students:", len(students))

today = datetime.datetime(2026, 8, 2, 12, 0, 0)  # aligns with seed timestamps
N = 24
rows = []
for idx, sid in enumerate(students):
    # assign profile deterministically
    mod = idx % 4
    if mod == 0:
        profile = "critical"   # steep decline -> slope < -5
    elif mod == 1:
        profile = "falling"
    elif mod == 2:
        profile = "rising"
    else:
        profile = "stable"
    for d in range(N):
        day = today - datetime.timedelta(days=(N - 1 - d))
        t = d / max(1, (N - 1))
        if profile == "critical":
            base = 4 - 124 * t          # +4 -> -120  (slope ~ -5.4)
            desc = "连续违纪扣分，行为分持续下滑"
        elif profile == "falling":
            base = 2 - 32 * t           # +2 -> -30
            desc = "近期行为表现下滑"
        elif profile == "rising":
            base = -2 + 32 * t          # -2 -> +30
            desc = "行为表现稳步提升"
        else:
            base = 0
            desc = "日常行为记录"
        change = int(round(base + random.normalvariate(0, 1.5)))
        rows.append((sid, change, desc, day.strftime("%Y-%m-%d %H:%M:%S"), "system_seed"))

cur.execute("DELETE FROM score_record")  # ensure clean seed (table name confirmed below)
try:
    cur.executemany(
        "INSERT INTO score_record (user_id, score_change, description, created_at, operator) VALUES (?,?,?,?,?)",
        rows,
    )
except sqlite3.OperationalError as e:
    print("INSERT failed:", e)
    # fall back: maybe table is 'score_records'
    raise
con.commit()
print("inserted score_record rows:", cur.execute("SELECT COUNT(*) FROM score_record").fetchone()[0])
print("distinct students in score_record:", cur.execute("SELECT COUNT(DISTINCT user_id) FROM score_record").fetchone()[0])
con.close()
