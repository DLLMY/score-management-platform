import sqlite3, shutil, time
SRC="instance/score_management_corrupt.db"   # original corrupt (only sqlite_stat1 data bad)
DST="instance/score_management_repaired.db"
shutil.copy(SRC, DST)
con=sqlite3.connect(DST, timeout=30); cur=con.cursor()
# diagnose: any 'phonebox'/'heartbeat' object in schema?
print("=== objects mentioning phonebox/heartbeat ===")
for r in cur.execute("SELECT type,name,sql FROM sqlite_master WHERE name LIKE '%phonebox%' OR sql LIKE '%phonebox%' OR name LIKE '%heartbeat%' OR sql LIKE '%heartbeat%'").fetchall():
    print(" ", r[0], r[1], "::", (r[2] or "")[:120])
# drop corrupt stats schema row (no table read under writable_schema)
cur.execute("PRAGMA writable_schema=ON")
cur.execute("DELETE FROM sqlite_master WHERE name='sqlite_stat1'")
cur.execute("PRAGMA writable_schema=OFF")
con.commit()
t0=time.time()
try:
    cur.execute("VACUUM")
    print("VACUUM ok")
except Exception as e:
    print("VACUUM err:", e)
con.close()
# verify
v=sqlite3.connect(DST, timeout=30)
print("integrity:", v.execute("PRAGMA integrity_check").fetchone())
print("scores:", v.execute("SELECT COUNT(*) FROM scores").fetchone()[0], "user:", v.execute("SELECT COUNT(*) FROM user").fetchone()[0])
print("elapsed %.1fs"%(time.time()-t0))
v.close()
