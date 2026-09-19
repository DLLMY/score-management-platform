"""健康检查端点（免鉴权探针）回归测试。

覆盖 D-M2 部署阻断 #1 修复：/api/health 必须免鉴权、探活 DB、返回极简 JSON。
复用 conftest 的 :memory: + StaticPool 极简 app 范式，仅注册 health_bp，不拉起全量服务。
"""
import pytest
from flask import Flask
from sqlalchemy.pool import StaticPool

from api.system.health_routes import health_bp
from models import db


@pytest.fixture
def app():
    """构造仅含 health_bp 的极简 app（内存库）。"""
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "poolclass": StaticPool,
        "connect_args": {"check_same_thread": False},
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = "test_secret_key"
    db.init_app(app)
    app.register_blueprint(health_bp)
    with app.app_context():
        db.create_all()
        yield app


def test_health_ok_without_auth(app):
    """核心：不带任何 Authorization 头也应返回 200（修复 Docker/K8s 探活需鉴权问题）。"""
    client = app.test_client()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"
    assert data["db"] == "ok"
    assert "timestamp" in data


def test_healthz_aliases(app):
    """兼容 K8s 惯例的别名路径。"""
    client = app.test_client()
    assert client.get("/api/healthz").status_code == 200
    assert client.get("/healthz").status_code == 200


def test_health_payload_shape(app):
    """返回体顶层含 status/db/timestamp（含信封键，避免被中间件二次包裹）。"""
    client = app.test_client()
    data = client.get("/api/health").get_json()
    assert {"status", "db", "timestamp"} <= set(data.keys())
    assert data["status"] == data["db"] == "ok"
    assert data["success"] is True


def test_health_no_duplicate_endpoint_false_positive(app):
    """三个别名路由使用独立 endpoint，不应触发 check_route_duplicates 误报。

    此前同一视图函数叠 @bp.route 会让 endpoint 同名、被 route_registry 误判为重复，
    导致每次启动打 ERROR 日志。本断言锁定该回归。
    """
    from utils.route_registry import check_route_duplicates

    assert check_route_duplicates(app) is True
