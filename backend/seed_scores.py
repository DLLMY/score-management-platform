import sqlite3, random, time
random.seed(20260802)
DB="instance/score_management.db"
con=sqlite3.connect(DB, timeout=30); cur=con.cursor()
now=time.strftime("%Y-%m-%d %H:%M:%S")
# students (active)
students=[r[0] for r in cur.execute("SELECT id FROM user WHERE role='student' AND is_active=1").fetchall()]
print("students:", len(students))
# exam_subjects -> (exam_id, subject_name, full_score)
es=[]
for exam_id, sname, fs in cur.execute(
    "SELECT es.exam_id, s.name, es.full_score FROM exam_subjects es JOIN subject s ON es.subject_id=s.id"):
    es.append((exam_id, sname or "未知", fs or 100.0))
print("exam_subjects:", len(es))
# per-student base ability
ability={sid: max(35.0, min(98.0, random.normalvariate(76, 11))) for sid in students}
rows=[]
for sid in students:
    base=ability[sid]
    for exam_id, sname, fs in es:
        # per (student,subject) slight stable offset + noise
        noise=random.normalvariate(0, 5)
        sc=base+noise
        sc=max(0.0, min(float(fs), round(sc,1)))
        rows.append((exam_id, sid, sname, sc, float(fs), "normal", 1, now, now))
print("score rows to insert:", len(rows))
cur.execute("DELETE FROM scores")  # ensure clean seed
cur.executemany(
    "INSERT INTO scores (exam_id, student_id, subject, score, full_score, status, entered_by, entered_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    rows)
con.commit()
print("inserted:", cur.execute("SELECT COUNT(*) FROM scores").fetchone()[0])
# quick sanity: avg academic per student variance
avgs=cur.execute("SELECT AVG(score) FROM scores GROUP BY student_id").fetchall()
vals=[r[0] for r in avgs]
print("academic avg min=%.1f max=%.1f stdev=%.1f"%(min(vals),max(vals), (sum((v-sum(vals)/len(vals))**2 for v in vals)/len(vals))**0.5))
con.close()
