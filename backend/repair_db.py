import sqlite3
db="instance/score_management.db"
con=sqlite3.connect(db, timeout=30)
cur=con.cursor()
# drop the corrupt auto-stats table (requires writable_schema)
cur.execute("PRAGMA writable_schema=ON")
try:
    cur.execute("DROP TABLE IF EXISTS sqlite_stat1")
    print("dropped sqlite_stat1")
except Exception as e:
    print("drop sqlite_stat1 err:", e)
cur.execute("PRAGMA writable_schema=OFF")
# regenerate statistics cleanly
try:
    cur.execute("ANALYZE")
    print("ANALYZE done")
except Exception as e:
    print("ANALYZE err:", e)
con.commit(); con.close()
# re-check integrity
con=sqlite3.connect(db, timeout=30); cur=con.cursor()
res=cur.execute("PRAGMA integrity_check").fetchall()
print("integrity_check:", res if res else "OK (empty=clean)")
con.close()
