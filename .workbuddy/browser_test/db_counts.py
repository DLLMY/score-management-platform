import sqlite3, json, sys
DB = "apps/backend/instance/score_management.db"
TABLES = ["user","class_info","class_periods","score_category","phone_box_policy",
          "notification","score_record","seating_seat","duty_assignment","approval",
          "alert_configs","homework_assignment","subject","course_schedules","device"]
def counts():
    c = sqlite3.connect(DB)
    out = {}
    for t in TABLES:
        try:
            out[t] = c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        except Exception as e:
            out[t] = f"ERR:{e}"
    c.close()
    return out
if __name__ == "__main__":
    print(json.dumps(counts(), ensure_ascii=False))
