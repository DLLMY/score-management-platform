"""通过 HTTP 验证 /api/nlp/parse 是否在修复后返回 200。"""
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


# 1) health
try:
    with urllib.request.urlopen(BASE + "/health", timeout=10) as r:
        print("health:", r.status, r.read().decode("utf-8", "replace")[:120])
except Exception as e:  # noqa
    print("health ERR:", e)

# 2) login
status, hdrs, body = post("/api/auth/login", {"username": "admin", "password": "123456"})
print("login status:", status)
login = {}
try:
    login = json.loads(body)
except Exception:
    pass
token = login.get("access_token")
set_cookie = hdrs.get("Set-Cookie")
print("token present:", bool(token), "| cookie present:", bool(set_cookie))

auth_headers = {}
if token:
    auth_headers["Authorization"] = "Bearer " + token

# 3) parse
status, hdrs, body = post("/api/nlp/parse", {"text": "张三 加 5 分"}, headers=auth_headers, cookie=set_cookie)
print("PARSE status:", status)
print("PARSE body:", body[:600])
