import json, urllib.request, urllib.error
BASE="http://127.0.0.1:3000"
def login():
    req=urllib.request.Request(BASE+"/api/auth/login",data=json.dumps({"username":"admin","password":"123456"}).encode(),headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req,timeout=30).read())["access_token"]
TOKEN=login(); AUTH={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}
def call(method,url,body=None):
    data=json.dumps(body).encode("utf-8") if body is not None else b"{}"
    req=urllib.request.Request(BASE+url,data=data,headers=AUTH,method=method)
    try:
        r=urllib.request.urlopen(req,timeout=60); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
print("=== recalculate composite-score (POST) ===")
s,b=call("POST","/api/algorithm/composite-score/recalculate")
print("status", s)
try:
    d=json.loads(b)
    print("method:", d.get("method"))
    print("weights:", d.get("weights"))
    rks=d.get("rankings") or []
    print("rankings count:", len(rks))
    print("top3:", [(r.get("name"), r.get("composite_score"), r.get("academic_score"), r.get("behavior_score")) for r in rks[:3]])
    print("bottom3:", [(r.get("name"), r.get("composite_score"), r.get("academic_score"), r.get("behavior_score")) for r in rks[-3:]])
    if rks:
        cs=[r["composite_score"] for r in rks]
        print("composite_score min=%.1f max=%.1f stdev=%.1f"%(min(cs),max(cs), (sum((x-sum(cs)/len(cs))**2 for x in cs)/len(cs))**0.5))
except Exception as e:
    print("parse err:", e, b[:300])
