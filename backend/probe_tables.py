import sqlite3
con=sqlite3.connect("instance/score_management.db"); cur=con.cursor()
tabs=[r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
bad=[]
for t in tabs:
    try:
        cur.execute(f"SELECT COUNT(*) FROM '{t}'").fetchone()
    except Exception as e:
        bad.append((t,str(e)[:60]))
print("tables that fail to read:", bad if bad else "NONE")
con.close()
