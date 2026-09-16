import json, re
f = r".workbuddy/browser_test/15_perpage.jsonl"
recs = []
with open(f, encoding="utf-8") as fh:
    for ln in fh:
        ln = ln.strip()
        if not ln:
            continue
        try:
            recs.append(json.loads(ln))
        except Exception:
            pass

def classify(r):
    note = r.get("note") or ""
    isReadOnly = ("只读/展示页" in note) or not r.get("hasAdd")
    biz = [c for c in (r.get("apiCalls") or []) if not re.search("frontend-performance", c.get("url", ""))]
    isW = lambda c: c.get("m") in ("POST", "PUT", "PATCH", "DELETE")
    if isReadOnly:
        return "readonly"
    if any(isW(c) and 200 <= c.get("status", 0) < 300 for c in biz):
        return "ok"
    if any(isW(c) and c.get("status", 0) >= 400 for c in biz):
        return "fail"
    if r.get("submitClicked"):
        return "submit-no-db"
    return "no-submit"

from collections import Counter
cnt = Counter(classify(r) for r in recs)
print("STATS:", dict(cnt), "TOTAL", len(recs))
for cls in ["fail", "no-submit", "submit-no-db"]:
    for r in recs:
        if classify(r) == cls:
            biz = [c for c in (r.get("apiCalls") or []) if not re.search("frontend-performance", c.get("url", ""))]
            apis = [c["m"] + " " + c["url"].replace("http://127.0.0.1:3000", "") + "->" + str(c["status"]) for c in biz]
            print("  [%s] idx%s %s | add=%s | %s | note=%s" % (cls, r.get("idx"), r.get("name"), r.get("addBtnText"), apis, (r.get("note") or "")[:130]))
