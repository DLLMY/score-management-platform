import json, urllib.request, urllib.error
BASE="http://127.0.0.1:3000"
def login():
    req=urllib.request.Request(BASE+"/api/auth/login",data=json.dumps({"username":"admin","password":"123456"}).encode(),headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req,timeout=30).read())["access_token"]
TOKEN=login(); AUTH={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}
def get(url):
    req=urllib.request.Request(BASE+url,headers=AUTH,method="GET")
    r=urllib.request.urlopen(req,timeout=60); return r.status, json.loads(r.read().decode())
# coverage: how many ranked students actually have academic scores
s,d=get("/api/algorithm/composite-score"); rks=d["data"]["rankings"]
have_ac=[r for r in rks if r.get("academic_score") not in (None,0)]
print("ranked:",len(rks)," with academic>0:",len(have_ac)," with academic None/0:",len(rks)-len(have_ac))
# risk endpoints content
for ep in ["/api/algorithm/prediction/risk","/api/algorithm/risk-predict/high-risk"]:
    s2,d2=get(ep); lst=d2 if isinstance(d2,list) else d2.get("data")
    print(f"\n[{ep}] status {s2} len={len(lst) if isinstance(lst,list) else 'n/a'}")
    if isinstance(lst,list) and lst:
        print("  sample[0]:", json.dumps(lst[0], ensure_ascii=False)[:300])
