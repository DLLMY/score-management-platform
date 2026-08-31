---
name: backend-reallink-smoke
description: "This skill should be used when verifying that a Flask plus SQLAlchemy backend service algorithm or business logic actually works against the REAL database, not just unit mocks, or when the user asks to verify, run a real-link smoke test, or confirm a backend module end-to-end. It codifies the project proven pattern: drive the real service function inside an app_context using the project venv, assert on real DB state, then clean up so nothing is left behind. Also covers the exact pytest invocation that avoids two environment traps: torch missing in the default python; pytest-timeout missing in the venv."
---

# Backend Real-Link Smoke Test

## Overview

Verify a backend service function end-to-end against the real SQLite database, then roll
back any created rows so the repo/data stays clean. Use it after fixing an algorithm, or
whenever the user wants proof that a fix "really works" at runtime (not just that it compiles).

The backend is `backend/` (Flask + flask-restx + SQLAlchemy, SQLite at
`backend/instance/score_management.db`). App entry: `from app import create_app`.

## When to Use

- After fixing a backend algorithm/bug and wanting real-DB confirmation before committing.
- User says "验证一下 / 跑真实链路 / 做 smoke test / 确认落库".
- Before claiming a P1 fix is resolved.

## Environment Traps (read first — they waste time)

1. **Use the project `.venv`, never bare `python`.** The default `python` lacks `torch`,
   so importing `app` (which imports NLP/BERT services) raises
   `ModuleNotFoundError: No module named 'torch'` → 17 collection errors in pytest.
   Always run scripts and tests with: `.venv/Scripts/python -m pytest ...`
2. **`.venv` lacks the `pytest-timeout` plugin**, but `pytest.ini` sets `--timeout`. Running
   plain pytest there exits with code 4 ("pytest-timeout not found"). Override with:
   `.venv/Scripts/python -m pytest FILES -q -o addopts=""`.
3. **`db_session_scope` calls `session.remove()` in its `finally`.** Any code that reads a
   model attribute *after* the `with` block (e.g. `return {"new_score": user.current_score}`)
   raises "Session not bound" even when the write succeeded. Capture needed values *inside*
   the `with` block.
4. **`numpy.bool_` is not Python `bool`.** Functions like `AnomalyDetector.detect_zscore`
   return `numpy.bool_`, so assertions like `x is True` FAIL while `json.dumps` prints `true`.
   Use `bool(x)` or `== True` for truth checks.

## Workflow

### Step 1 — Pick the entry and a real record

Find the service function to drive (e.g. `RuleExecutionEngine.execute_rules`,
`CompositeScoreService.recalculate_user_score`, `AnomalyService.detect_all_anomalies`,
`phonebox_policy.evaluate`, `AnalysisService.get_class_ranking`). For write paths, pick a
real DB row to act on (an active student with score records; a class that has a policy).
Inspect the function signature/return shape by reading the source first.

### Step 2 — Write a temporary smoke script

Create `backend/smoke_TOPIC.py` (delete it before committing). Template:
`scripts/smoke_template.py`. Key rules:

- `sys.path.insert(0, backend_dir)` then `from app import create_app`.
- Wrap all DB work in `with app.app_context():`.
- For **write** paths: create a minimal temp row (rule/user/policy), drive the function,
  assert on the REAL column value read back from the ORM, then delete the temp row and
  `db.session.commit()` (or re-RUN the function to confirm idempotency) so the DB is restored.
- For **read/pure** paths: assert structure + that a known broken behavior is now fixed
  (e.g. per-class filtering returns per-class counts; a threshold now triggers).
- Print a single `json.dumps({... "SMOKE_RESULT": "PASS"/"FAIL"})` line.

### Step 3 — Run it

```
cd PROJECT_ROOT
.venv/Scripts/python backend/smoke_TOPIC.py 2>&1 | grep -E "SMOKE_RESULT|..."
```

Cold start (torch + jieba + BERT) takes ~40–60s. Be patient; the script prints one JSON line.

### Step 4 — Confirm no regression, then clean up

Run the related unit tests (they reuse conftest's `app` fixture):

```
.venv/Scripts/python -m pytest backend/tests/test_MODULE.py -q -o addopts=""
```

Delete the smoke script (`rm backend/smoke_TOPIC.py`). Commit only source + memory; the
smoke script must NOT enter version control.

## Gotcha Checklist (assertions that falsely fail)

- Don't assert `is True` on numpy booleans → use `bool()`.
- Don't read model attrs outside `db_session_scope`'s `with` block.
- Don't assert "values differ across rows" when the DB simply has uniform/zero data for the
  time window — instead assert per-row correctness against an independent direct query.
- Verify the function's *real* return key names (e.g. `overall_risk_score`, not
  `overall_score`) before asserting, or the FAIL is a script typo, not a bug.

## Resources

- `scripts/smoke_template.py` — copy this as the starting point for a new smoke test.
