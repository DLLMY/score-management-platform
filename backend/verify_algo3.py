import json, urllib.request, urllib.error, statistics
BASE="http://127.0.0.1:3000"
def login():
    req=urllib.request.Request(BASE+"/api/auth/login",data=json.dumps({"username":"admin","password":"123456"}).encode(),headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req,timeout=30).read())["access_token"]
TOKEN=login(); AUTH={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}
def get(url):
    req=urllib.request.Request(BASE+url,headers=AUTH,method="GET")
    try:
        r=urllib.request.urlopen(req,timeout=60); return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
# composite-score (parse wrapped data)
s,d=get("/api/algorithm/composite-score")
data=d.get("data",d)
rks=data.get("rankings") or []
cs=[r["composite_score"] for r in rks if r.get("composite_score") is not None]
nan=[r for r in rks if r.get("composite_score") is not None and r["composite_score"]!=r["composite_score"]]
print("[composite-score] status",s,"count",len(rks))
print("  weights:", data.get("weights"))
print("  composite min=%.1f max=%.1f mean=%.1f stdev=%.1f"%(min(cs),max(cs),statistics.mean(cs),statistics.pstdev(cs)))
print("  NaN count:", len(nan))
print("  TOP3:", [(r.get("name"),r.get("composite_score"),r.get("academic_score")) for r in rks[:3]])
print("  BOT3:", [(r.get("name"),r.get("composite_score"),r.get("academic_score")) for r in rks[-3:]])
# prediction/risk
for ep in ["/api/algorithm/prediction/risk","/api/algorithm/risk-predict/high-risk"]:
    s2,d2=get(ep)
    payload=d2.get("data",d2)
    # try to summarize
    if isinstance(payload,dict):
        keys=list(payload.keys())[:6]
        n=None
        for k in ("count","rankings","students","data","items","list"):
            if isinstance(payload.get(k),list): n=len(payload[k])
        print(f"[{ep}] status {s2} keys={keys} list_len={n}")
    else:
        print(f"[{ep}] status {s2} type={type(payload)}")
