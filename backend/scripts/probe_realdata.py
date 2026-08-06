"""端到端验证：班主任工作台是否真实互通系统数据（teacher 账号，绑定 class 1=一年级1班）。
证明点：(a) 工作台写入落到真实 seating 表且 FK 指向真实 user.id=1(陈洋)；
        (b) 读回 student_name='陈洋'（真实姓名，非虚构）；
        (c) 抽查考勤/作业表是否已有真实班级数据。
不破坏既有数据（建表后删表）。
"""
import json, urllib.request, urllib.error

BASE = "http://127.0.0.1:5000"

def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"raw": e.read().decode()[:200]}
    except Exception as e:
        return "ERR", {"error": str(e)[:120]}

print("=== 1) 登录 teacher ===")
st, login = req("POST", "/api/auth/login", body={"username": "teacher", "password": "123456"})
admin = login.get("data", {}).get("admin", {})
print("  status:", st, "| username:", admin.get("username"))
token = login.get("access_token") or login.get("data", {}).get("access_token")
assert token, "无 token | keys=" + str(list(login.keys()))

print("\n=== 2) 座次表 E2E：建表(一年级1班) → 排真实学生陈洋(id=1) → 读回 → 删表 ===")
st, created = req("POST", "/api/seating/charts", token=token,
                  body={"name": "E2E真实互通验证", "class_info_id": 1})
print("  建表 ->", st, "| chart_id=", created.get("data", {}).get("id"))
chart_id = created.get("data", {}).get("id")
if chart_id:
    st, seat = req("POST", f"/api/seating/charts/{chart_id}/seats", token=token,
                   body={"student_id": 1, "seat_row": 1, "seat_col": 1})
    sd = seat.get("data", {})
    print("  排座(陈洋 id=1) ->", st,
          "| 返回 student_id=", sd.get("student_id"),
          "| student_name=", sd.get("student_name"),
          "| class_id=", sd.get("class_id") or sd.get("class_info_id"))
    st, seats = req("GET", f"/api/seating/charts/{chart_id}/seats", token=token)
    rows = seats.get("data") or []
    print("  读回座次 ->", st, "| 行数:", len(rows), "| 首行:", rows[0] if rows else None)
    st, dl = req("DELETE", f"/api/seating/charts/{chart_id}", token=token)
    print("  删表(清理) ->", st, dl.get("message"))

print("\n=== 3) 抽查考勤/作业 是否已有真实班级数据 ===")
for label, path in [("考勤", "/api/attendance/records?class_info_id=1"),
                    ("作业", "/api/homework/assignments?class_info_id=1")]:
    st, resp = req("GET", path, token=token)
    data = resp.get("data")
    if isinstance(data, list):
        n = len(data); sample = data[0] if data else None
    elif isinstance(data, dict):
        n = len(data.get("items") or data.get("records") or [])
        sample = (data.get("items") or data.get("records") or [None])[0]
    else:
        n, sample = "?", data
    has_name = bool(sample and (sample.get("student_name") or sample.get("class_name")))
    print(f"  {label} -> {st} | 条数={n} | 含真实姓名/班级名={has_name} | 样例={sample}")

print("\n=== 结论 ===")
print("若第2步 排座 student_id=1 且 student_name='陈洋' 且读回一致 -> 工作台真实写入/读取真实学生数据 ✅")
