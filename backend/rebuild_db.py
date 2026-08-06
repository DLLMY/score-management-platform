import sqlite3, time
SRC="instance/score_management.db"
DST="instance/score_management_rebuilt.db"
t0=time.time()
src=sqlite3.connect(SRC, timeout=30)
new=sqlite3.connect(DST, timeout=30)
new.execute("PRAGMA foreign_keys=OFF")
# attach source
new.execute(f"ATTACH '{SRC}' AS old")
# gather object definitions from source (exclude sqlite_* system tables)
objs=src.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type DESC").fetchall()
tables=[(n,s) for (ty,n,s) in objs if ty=='table']
indexes=[(n,s) for (ty,n,s) in objs if ty=='index']
print(f"tables={len(tables)} indexes={len(indexes)}")
for n,sql in tables:
    try:
        new.execute(sql)  # recreate table schema
        try:
            new.execute(f'INSERT INTO "{n}" SELECT * FROM old."{n}"')
            cnt=new.execute(f'SELECT COUNT(*) FROM "{n}"').fetchone()[0]
            print(f"  table {n}: copied {cnt}")
        except Exception as e:
            print(f"  table {n}: schema ok but data copy FAILED: {e}")
    except Exception as e:
        print(f"  table {n}: CREATE FAILED: {e}")
for n,sql in indexes:
    try:
        new.execute(sql); print(f"  index {n}: created")
    except Exception as e:
        print(f"  index {n}: FAILED: {e}")
new.commit()
new.execute("DETACH old")
new.execute("ANALYZE")
src.close(); new.close()
# verify
v=sqlite3.connect(DST, timeout=30); cur=v.cursor()
res=v.execute("PRAGMA integrity_check").fetchall()
print("integrity_check:", res if res else "CLEAN")
print("elapsed %.1fs"%(time.time()-t0))
v.close()
