#!/usr/bin/env python
"""Probe /api/scores/confirm-all and check score status distribution."""
import json
import sys
import urllib.request

BASE = "http://127.0.0.1:5000"


def post_json(path: str, body: dict | None = None, token: str = "") -> tuple[int, bytes]:
    data = json.dumps(body or {}).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def get_json(path: str, token: str = "") -> tuple[int, bytes]:
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main() -> int:
    code, body = post_json("/api/auth/login", {"username": "admin", "password": "123456"})
    if code != 200:
        print("LOGIN_FAIL", code)
        return 1
    token = json.loads(body).get("access_token", "")
    if not token:
        print("NO_TOKEN")
        return 1
    print(f"TOKEN_LEN={len(token)}")

    # List exams to find a published one
    code, body = get_json("/api/exams", token)
    if code != 200:
        print("EXAMS_FAIL", code, body[:200])
        return 1
    data = json.loads(body)
    exams = data.get("data", [])
    published = [e for e in exams if e.get("status") == "published"]
    print(f"exams total={len(exams)} published={len(published)}")
    if not published:
        print("NO_PUBLISHED")
        return 1
    exam = published[0]
    print(f"picked exam id={exam['id']} name={exam.get('name')!r}")

    # List scores for that exam
    code, body = get_json(f"/api/scores?exam_id={exam['id']}", token)
    print(f"scores HTTP={code} body[:200]={body[:200]!r}")
    try:
        scores = json.loads(body)
        if isinstance(scores, dict) and "data" in scores:
            scores = scores["data"]
        by_status: dict[str, int] = {}
        for s in scores:
            st = s.get("status") or "<null>"
            by_status[st] = by_status.get(st, 0) + 1
        print(f"score_count={len(scores)} status_dist={by_status}")
        if scores:
            print(f"first_score={json.dumps(scores[0], ensure_ascii=False)[:300]}")
    except Exception as e:
        print(f"parse error: {e}")

    # Probe confirm-all
    code, body = post_json("/api/scores/confirm-all", {"exam_id": exam["id"]}, token)
    print(f"confirm-all HTTP={code} body={body[:300]!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
