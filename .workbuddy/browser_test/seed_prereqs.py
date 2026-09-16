import sqlite3, os
DB = r"C:\Users\53527\Desktop\自我管理提升\自我管理提升V2.0\平台开发\管理平台设计\apps\backend\instance\score_management.db"
assert os.path.exists(DB), "DB not found: " + DB
con = sqlite3.connect(DB); cur = con.cursor()
con.execute("PRAGMA foreign_keys=OFF")

# --- 学生种子 (user 表, role=student) ---
# 课程表(idx10)/考勤(idx19)/审批(idx36)/成绩录入(idx28) 等页面需要真实学生才能落库。
STU_N = 8
ins_stu = 0
for i in range(1, STU_N + 1):
    card = f"PBT_SEED_STU_{i:03d}"
    cur.execute("SELECT id FROM user WHERE card_id=?", (card,))
    if cur.fetchone():
        continue
    cur.execute(
        "INSERT INTO user (name, class_info_id, card_id, role, is_active, gender) VALUES (?,?,?,?,?,?)",
        (f"PBT种子学生{i}", 1, card, 'student', 1, '男'))
    ins_stu += 1
con.commit()
print(f"students inserted: {ins_stu}")

# --- 节次种子 (class_periods) ---
# 课程表(idx10) 在 idx12(课程节次管理) 之前运行，节次下拉为空 → 无法落库。
# 现有行含 period 8; 此处补 1..7 的 is_active 节次。
period_defs = [
    (1, 8, 0, 8, 45), (2, 9, 5, 9, 50), (3, 10, 0, 10, 45), (4, 11, 0, 11, 45),
    (5, 14, 0, 14, 45), (6, 15, 0, 15, 45), (7, 16, 0, 16, 45),
]
ins_per = 0
for (pn, sh, sm, eh, em) in period_defs:
    cur.execute("SELECT id FROM class_periods WHERE period_number=?", (pn,))
    if cur.fetchone():
        continue
    cur.execute(
        "INSERT INTO class_periods (name, period_number, start_hour, start_minute, end_hour, end_minute, is_active, sort_order) VALUES (?,?,?,?,?,?,?,?)",
        (f"PBT种子节次{pn}", pn, sh, sm, eh, em, 1, pn))
    ins_per += 1
con.commit()
print(f"periods inserted: {ins_per}")

# --- 复核 ---
cur.execute("SELECT COUNT(*) FROM user WHERE role='student' AND card_id LIKE 'PBT%'")
print("student total (PBT):", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM class_periods WHERE period_number BETWEEN 1 AND 7 AND is_active=1")
print("periods 1..7 active:", cur.fetchone()[0])
con.close()
print("SEED_OK")
