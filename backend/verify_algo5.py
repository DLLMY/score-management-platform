import json, urllib.request, urllib.error, statistics, time
BASE="http://127.0.0.1:3000"
def login():
    req=urllib.request.Request(BASE+"/api/auth/login",data=json.dumps({"username":"admin","password":"123456"}).encode(),headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req,timeout=30).read())["access_token"]
TOKEN=login(); AUTH={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}
def call(m,u,b=None):
    d=json.dumps(b).encode() if b is not None else b"{}"
    r=urllib.request.urlopen(urllib.request.Request(BASE+u,data=d,headers=AUTH,method=m),timeout=60); return r.status, json.loads(r.read().decode())
# re-run recalculate
s,dd=call("POST","/api/algorithm/composite-score/recalculate",{})
print("recalculate status",s)
time.sleep(1)
s2,d2=call("GET","/api/algorithm/composite-score")
rks=d2["data"]["rankings"]
have=[r for r in rks if r.get("academic_score") not in (None,0)]
print("ranked:",len(rks)," with academic>0:",len(have)," None/0:",len(rks)-len(have))
cs=[r["composite_score"] for r in rks if r.get("composite_score") is not None]
nan=[r for r in rks if r.get("composite_score") is not None and r["composite_score"]!=r["composite_score"]]
print("weights:", d2["data"]["weights"])
print("composite min=%.1f max=%.1f mean=%.1f stdev=%.1f"%(min(cs),max(cs),statistics.mean(cs),statistics.pstdev(cs)))
print("NaN:", len(nan))
print("TOP5:", [(r.get("name"),r.get("composite_score"),r.get("academic_score")) for r in rks[:5]])
