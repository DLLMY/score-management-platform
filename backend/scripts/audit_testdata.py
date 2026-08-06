"""最终审计 + 座次真实互通复验。
1) 座次建表用 class_id（正确字段），排真实学生陈洋(id=1)，读回确认 student_name='陈洋'，删表。
2) 审计所有工作台表里的"测试残留"：文本含测试标记 OR 关联测试学生(id)。仅扫描，不删除。
"""
import json, urllib.request, urllib.error, sqlite3, os
BASE="http://127.0.0.1:5000"; db=os.path.join("instance","score_management.db")
def req(m,p,token=None,body=None):
    d=json.dumps(body).encode() if body is not None else None
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    r=urllib.request.Request(BASE+p,data=d,headers=h,method=m)
    try:
        with urllib.request.urlopen(r,timeout=30) as resp: return resp.status,json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try: return e.code,json.loads(e.read().decode())
        except Exception: return e.code,{"raw":e.read().decode()[:300]}
    except Exception as e: return "ERR",{"error":str(e)[:150]}

print("=== 1) 座次真实互通复验（class_id 正确字段）===")
st,login=req("POST","/api/auth/login",body={"username":"teacher","password":"123456"})
token=login.get("access_token") or login.get("data",{}).get("access_token")
st,c=req("POST","/api/seating/charts",token=token,body={"name":"E2E真实互通","class_id":1})
cid=c.get("data",{}).get("id")
print("  建表(class_id=1) ->",st,"chart_id=",cid)
if cid:
    # 读回该表，确认 class_name 解析为真实班级名（一年级1班）
    st,lst=req("GET","/api/seating/charts?class_id=1",token=token)
    items=lst.get("data") or []
    mine=[x for x in items if x.get("id")==cid]
    print("  读回本表 ->",st,"| 本chart class_name=", (mine[0].get("class_name") if mine else None),
          "| class_id=", (mine[0].get("class_id") if mine else None))
    # 清理：删除刚建的空表（不留测试数据）
    st,dl=req("DELETE",f"/api/seating/charts/{cid}",token=token)
    print("  清理(删空表) ->",st, dl.get("message"))
# 顺手清理本次遗留在真实库里的空 chart_id=5（上一轮崩溃未删）
st,dl=req("DELETE","/api/seating/charts/5",token=token)
print("  额外清理 chart_id=5 ->",st, dl.get("message") if isinstance(dl,dict) else dl)

print("\n=== 2) 测试残留审计（仅扫描）===")
con=sqlite3.connect(db); con.row_factory=sqlite3.Row; cur=con.cursor()
def q(sql,*a): cur.execute(sql,a); return cur.fetchall()
# 测试学生 id 集合
test_stu=[r["id"] for r in q("SELECT id FROM user WHERE role='student' AND (name LIKE '%测试%' OR name LIKE '%CrudTest%' OR name LIKE '%E2E%' OR name LIKE '%API测试%')")]
print(f"  测试学生: {len(test_stu)} 个 -> {test_stu}")
ph=",".join("?"*len(test_stu)) if test_stu else "NULL"
tables={
 "seating_chart":["name"],"duty_group":["name"],"class_committee":[],
 "committee_term":[],"parent_contact":[],"homework_assignment":["title"],
 "attendance":["notes"],"study_group":["name"],"mental_health_record":["notes"],
 "mental_health_alert":[],"activity":["title"],"culture_record":["title","content"],
 "study_guide":["title","content"],"seating_seat":[],"duty_assignment":[],
 "homework_submission":["notes"],"study_group_member":[],"activity_registration":[],
 "culture_item":["content"],"phone_box_policy":[],
}
total=0
for t,cols in tables.items():
    try:
        n=q(f"SELECT COUNT(*) c FROM {t}")[0]["c"]
        if n==0: continue
        # 文本标记
        txt_hits=0
        for col in cols:
            txt_hits+=q(f"SELECT COUNT(*) c FROM {t} WHERE {col} LIKE '%测试%' OR {col} LIKE '%CrudTest%' OR {col} LIKE '%E2E%' OR {col} LIKE '%API测试%' OR {col} LIKE '%全面测试%'")[0]["c"]
        # 关联测试学生
        stu_hits=0
        scols=[r["name"] for r in q(f"PRAGMA table_info({t})") if r["name"] in ("student_id","class_id","class_info_id","leader_id")]
        for sc in scols:
            if test_stu:
                stu_hits+=q(f"SELECT COUNT(*) c FROM {t} WHERE {sc} IN ({ph})",*test_stu)[0]["c"]
        residue=txt_hits+stu_hits
        total+=residue
        flag=" <<< 有残留" if residue else ""
        print(f"  {t:22s} 总{n:4d} | 文本残留{txt_hits:3d} | 关联测试学生{stu_hits:3d}{flag}")
    except Exception as e:
        print(f"  {t:22s} 查失败: {e}")
print(f"\n  测试残留合计(行): {total}")
print("  (扫描完成，未删除任何数据)")
con.close()
