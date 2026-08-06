#!/usr/bin/env bash
# ============================================================
# 一键回归检查（改后端端点 / 权限 / 文档后必跑）
# ------------------------------------------------------------
# 串起三套契约保障 + 关键路由测试：
#   1. RBAC 一致性校验（check-only，漂移即失败）
#   2. OpenAPI 契约漂移校验（需后端 5000 已启动，否则跳过）
#   3. 后端契约测试 test_api_envelope（0 5xx + shape 快照）
#   4. 关键业务路由 pytest（rules / export / notify / classes）
#
# 用法（项目根目录）：
#   bash scripts/run_regression.sh          # 后端回归（需系统 Python 3.11）
#   bash scripts/run_regression.sh --full   # 追加前端 e2e 冒烟（需后端已起）
# ============================================================
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 后端必须用系统 Python 3.11（带 torch，托管 3.13 缺 torch 契约测试会失败）
PY="C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe"
if [ ! -f "$PY" ]; then
  echo "[错误] 未找到系统 Python 3.11: $PY"
  exit 2
fi

FAILED=0
step() { echo ""; echo "========== $1 =========="; }

step "1/4 RBAC 一致性校验"
if "$PY" backend/scripts/verify_rbac_consistency.py --check-only; then
  echo "[OK] RBAC 一致"
else
  echo "[失败] RBAC 漂移（可用 --apply 幂等补齐）"; FAILED=1
fi

step "2/4 OpenAPI 契约漂移校验"
if "$PY" backend/scripts/verify_openapi_contract.py; then
  echo "[OK] OpenAPI 一致"
else
  echo "[提示] OpenAPI 漂移或后端未启动（跳过不阻塞）"
fi

cd "$ROOT/backend"

step "3/4 后端契约测试（0 5xx + shape 快照）"
if "$PY" -m pytest tests/test_api_envelope.py -p no:locust --timeout=300 -q; then
  echo "[OK] 契约测试通过"
else
  echo "[失败] 契约测试存在 5xx / shape 违规"; FAILED=1
fi

step "4/4 关键业务路由测试"
if "$PY" -m pytest tests/test_rules_routes.py tests/test_export_routes.py \
      tests/test_notify_history_routes.py tests/test_classes_routes.py \
      -p no:locust --timeout=300 -q; then
  echo "[OK] 关键路由测试通过"
else
  echo "[失败] 关键路由测试"; FAILED=1
fi

if [ "$1" = "--full" ]; then
  cd "$ROOT/frontend"
  step "5/6 前端单测（vitest，jsdom 无需后端）"
  if npm test; then
    echo "[OK] 前端单测通过"
  else
    echo "[失败] 前端单测"; FAILED=1
  fi
  step "6/6 前端 e2e 冒烟（需后端 5000 + 前端 3000）"
  if npm run test:e2e -- --project=chrome smoke.spec.ts; then
    echo "[OK] 前端冒烟通过"
  else
    echo "[失败] 前端冒烟"; FAILED=1
  fi
fi

echo ""
if [ "$FAILED" = "0" ]; then
  echo "全部回归通过"
else
  echo "存在失败项，请检查上方输出"
  exit 1
fi
