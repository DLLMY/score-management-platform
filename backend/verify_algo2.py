import json, urllib.request, urllib.error
BASE="http://127.0.0.1:3000"
def login():
    req=urllib.request.Request(BASE+"/api/auth/login",data=json.dumps({"username":"admin","password":"123456"}).encode(),headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req,timeout=30).read())["access_token"]
TOKEN=login(); AUTH={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}
def get(url):
    req=urllib.request.Request(BASE+url,headers=AUTH,method="GET")
    try:
        r=urllib.request.urlopen(req,timeout=60); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
s,b=get("/api/algorithm/composite-score")
print("GET composite-score status", s)
d=json.loads(b)
print("method:", d.get("method"))
print("weights:", d.get("weights"))
rks=d.get("rankings") or []
print("rankings:", len(rks))
if rks:
    cs=[r["composite_score"] for r in rks if r.get("composite_score") is not None]
    import statistics
    print("composite_score min=%.1f max=%.1f mean=%.1f stdev=%.1f"%(min(cs),max(cs),statistics.mean(cs),statistics.pstdev(cs)))
    print("TOP5 :", [(r.get("name"), r.get("composite_score"), r.get("academic_score"), r.get("behavior_score")) for r in rks[:5]])
    print("BOT5 :", [(r.get("name"), r.get("composite_score"), r.get("academic_score"), r.get("behavior_score")) for r in rks[-5:]])
    # check no NaN
    nan=[r for r in rks if r.get("composite_score") is not None and (r["composite_score"]!=r["composite_score"])]
    print("NaN composite_count:", len(nan))
