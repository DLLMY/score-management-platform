"""通过 HTTP 验证 /api/nlp/feedback/record 是否在补列后返回 200 并落库。"""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:5000"


def post(path, payload, headers=None, cookie=None):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BASE + path, data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, dict(resp.getheaders()), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa
        return -1, {}, str(e)


def get(path, headers=None, cookie=None):
    req = urllib.request.Request(BASE + path, method="GET")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa
        return -1, str(e)


# 1) login —— 正确收集所有 Set-Cookie（可能多个）
login_status, login_hdrs, login_body = post("/api/auth/login", {"username": "admin", "password": "123456"})
print("login status:", login_status)
# 仅保留每个 cookie 的 name=value（去掉 Path/HttpOnly/SameSite 等属性）
raw_cookies = [v for k, v in login_hdrs.items() if k.lower() == "set-cookie"]
cookie_pairs = []
for c in raw_cookies:
    cookie_pairs.append(c.split(";")[0].strip())
set_cookie = "; ".join(cookie_pairs)
print("cookie raw count:", len(raw_cookies), "| assembled:", set_cookie[:80])
# 取 Bearer token（前端实际用它认证）
try:
    _lb = json.loads(login_body)
    access_token = _lb.get("access_token")
except Exception:
    access_token = None
print("token present:", bool(access_token))
auth_headers = {"Authorization": "Bearer " + access_token} if access_token else {}
print("cookie present:", bool(set_cookie))

# 2) feedback/record —— 带纠正（corrected_name != original_name 触发 NLPCorrection 构造）
fb_payload = {
    "text": "李四 加 5 分",
    "predicted_intent": "add",
    "true_intent": "add",
    "confidence": 0.9,
    "original_name": "李三",
    "corrected_name": "李四",
}
status, hdrs, body = post("/api/nlp/feedback/record", fb_payload, headers=auth_headers, cookie=set_cookie)
print("FEEDBACK status:", status)
print("FEEDBACK body:", body[:400])

# 3) corrections list
status, body = get("/api/nlp/corrections?page=1&per_page=20", headers=auth_headers, cookie=set_cookie)
print("CORRECTIONS status:", status)
try:
    d = json.loads(body)
    items = d.get("data", {}).get("items", [])
    print("CORRECTIONS total:", d.get("data", {}).get("total"), "| returned:", len(items))
    if items:
        print("first item keys:", sorted(items[0].keys()))
        print("first item sample:", json.dumps(items[0], ensure_ascii=False)[:300])
except Exception as e:  # noqa
    print("parse err:", e, "| body:", body[:300])
