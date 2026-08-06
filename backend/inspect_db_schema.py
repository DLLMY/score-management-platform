import sqlite3, glob, os

cands = glob.glob('**/score_management.db', recursive=True)
print("DB candidates:", cands)
db = cands[0] if cands else 'instance/score_management.db'
print("Using DB:", db)
con = sqlite3.connect(db)
cur = con.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nlp_corrections'")
print("table exists:", bool(cur.fetchone()))
cur.execute("PRAGMA table_info(nlp_corrections)")
cols = [r[1] for r in cur.fetchall()]
print("columns:", cols)
con.close()
