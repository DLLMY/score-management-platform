"""轻量级健康检查端点（免鉴权，供 Docker / K8s 探活使用）。

与 /api/system/health（带 system.view 权限、返回完整组件状态）不同，本端点的设计
目标是「基础设施探针」：

- 不要求任何认证令牌（Dockerfile 的 HEALTHCHECK 与 K8s livenessProbe 无法携带 JWT）；
- 仅探测数据库连通性（SELECT 1），返回极简 JSON；
- 健康返回 HTTP 200，数据库不可达返回 HTTP 503，便于编排器判定重启/剔除。

评估报告《PROJECT_TERTIARY_EVALUATION_REPORT.md》部署阻断 #1 = Dockerfile 探活路径
/api/health 与实际路由 /api/system/health（需鉴权）不匹配，导致容器持续重启。
本端点修复该路径不匹配，并额外提供 /api/healthz 与 /healthz 兼容 K8s 惯例。
"""
import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify
from sqlalchemy import text

from models import db

logger = logging.getLogger(__name__)

health_bp = Blueprint("health", __name__)


def _probe_database():
    """探测数据库连通性，返回 (status, detail)。

    status: 'ok' | 'error'。
    复用与 system_routes._check_database_health 相同的 engine.connect() + SELECT 1 探活，
    避免占用 ORM 会话、且对瞬时连接抖动最敏感。
    """
    try:
        with db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok", None
    except Exception as exc:  # noqa: BLE001 - 探活需吞掉所有异常并转成错误态
        logger.warning("健康检查: 数据库连接失败: %s", exc)
        return "error", str(exc)


def _build_health_payload():
    """构造健康检查响应体。

    同时包含信封键（success/code/message）与裸 status/db/timestamp：
    - 顶层保留 status/db/timestamp 以贴合健康检查规范（便于探针按 JSON 解析判活）；
    - 含 success 键可让全局 ResponseMiddleware 跳过二次包裹，避免响应被嵌套进 data。
    """
    db_status, _db_detail = _probe_database()
    ok = db_status == "ok"
    return {
        "success": ok,
        "code": 0 if ok else 503,
        "message": "ok" if ok else "database unavailable",
        "status": db_status,
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }, db_status


def _health_response():
    """构造健康检查 HTTP 响应（共享逻辑）。

    返回含 status/db/timestamp 的 JSON；数据库不可达时 status=error 且 HTTP 503。
    """
    payload, db_status = _build_health_payload()
    # 数据库不可达 → 503，触发编排器重启/剔除；否则 200
    status_code = 200 if db_status == "ok" else 503
    return jsonify(payload), status_code


@health_bp.route("/api/health")
def health_check():
    """健康检查探针（主路径，Docker HEALTHCHECK 使用）。"""
    return _health_response()


@health_bp.route("/api/healthz")
def health_check_api_z():
    """健康检查探针别名（/api 前缀，兼容 K8s 惯例）。"""
    return _health_response()


@health_bp.route("/healthz")
def health_check_root_z():
    """健康检查探针别名（根前缀，兼容 K8s 惯例 /healthz）。"""
    return _health_response()
