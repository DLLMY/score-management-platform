"""实证探测班主任工作台 12 个功能的后端列表端点，定位'全部有问题'的根因。"""

import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:5000"

ENDPOINTS = [
    ("seating", "/api/seating/charts"),
    ("duty", "/api/duty/groups"),
    ("committee", "/api/committee/members"),
    ("parent", "/api/parent/contacts"),
    ("homework", "/api/homework/assignments"),
    ("attendance", "/api/attendance/records"),
    ("study-group", "/api/study-group/groups"),
    ("mental-health", "/api/mental-health/records"),
    ("activity", "/api/activity"),
    ("culture", "/api/culture/records"),
    ("study-guide", "/api/study-guide/guides"),
    ("phonebox-policy", "/api/phonebox-policy"),
]


def login():
    req = urllib.request.Request(
        BASE + "/api/auth/login",
        data=json.dumps({"username": "admin", "password": "123456"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        body = json.loads(r.read().decode())
    print("LOGIN status body keys:", list(body.keys()))
    # 尝试常见 token 字段
    token = body.get("access_token") or body.get("token") or body.get("accessToken")
    print("TOKEN field used: access_token present=", "access_token" in body)
    return token


def probe(token, path):
    for hdr in (f"Bearer {token}", token):
        req = urllib.request.Request(
            BASE + path,
            headers={"Authorization": hdr, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                data = r.read().decode()
                return r.status, data[:240]
        except urllib.error.HTTPError as e:
            data = e.read().decode()
            if e.code == 401 and hdr == f"Bearer {token}":
                continue  # 试无 Bearer
            return e.code, data[:240]
    return None, ""


def main():
    token = login()
    print("=" * 60)
    for name, path in ENDPOINTS:
        status, snippet = probe(token, path)
        ok = status and 200 <= status < 300
        print(f"[{'OK' if ok else 'XX'}] {name:16s} {path:32s} -> {status}")
        if not ok:
            print("       ", snippet.replace("\n", " ")[:200])


if __name__ == "__main__":
    main()
