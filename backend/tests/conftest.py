#!/usr/bin/env python3
"""
pytest配置文件 - 提供测试夹具和配置
"""

import pytest
import os
import sys
import tempfile
import threading

basedir = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, basedir)

# Windows 环境坑：os.environ 中可能携带超长环境变量（如 ACC_PRODUCT_CONFIG_V3，
# 约 317KB > 32767 字符上限）。任何使用 `patch.dict(os.environ, ...)` 的测试在退出
# 还原整个环境字典时会因该变量抛 `ValueError: the environment variable is longer than
# 32767 characters`。在此于会话开始时统一清除所有超长环境变量，使 patch.dict 恢复正常。
for _k, _v in list(os.environ.items()):
    if len(_v) > 32767:
        try:
            del os.environ[_k]
        except Exception:  # noqa: BLE001
            pass


# 预先发现 api 包下的所有模块名（仅一次，会话加载时执行），避免每个用例重复
# walk_packages 造成的巨大文件系统开销（全量 1600+ 用例下会被放大约 1600 倍）。
# 实际模块导入仍在 fixture 内进行（importlib 有缓存，重复 import 近乎零成本）。
_API_MODULE_NAMES = []
try:
    import pkgutil as _pkgutil
    import api as _api_pkg_disc

    for _finder, _modname, _ispkg in _pkgutil.walk_packages(
        _api_pkg_disc.__path__, _api_pkg_disc.__name__ + "."
    ):
        _API_MODULE_NAMES.append(_modname)
except Exception:  # noqa: BLE001
    _API_MODULE_NAMES = []


@pytest.fixture(scope="function")
def app():
    """创建测试用Flask应用

    改为 function 级隔离：每个测试用例拥有独立的 Flask app 与独立的
    sqlite:///:memory: 数据库，彻底消除会话级共享 :memory: 会话带来的
    执行顺序/环境敏感性（此前靠 expunge_all()、唯一 ID、容差加固，
    理论上对排序与并行敏感）。每个用例结束自动 db.drop_all()。
    """
    from flask import Flask
    from flask_restx import Api
    from sqlalchemy.pool import StaticPool
    from models import db

    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    # function 级隔离下，每个用例拥有独立的 :memory: 引擎。SQLite 的 :memory:
    # 数据库“每个连接一个独立库”，默认的 QueuePool 会让 create_all/seed 与
    # 业务查询落在不同连接上 → 查询读到空库（典型症状：test_match_rule 断言
    # len(matched_rules)>=1 失败）。改用 StaticPool + check_same_thread=False，
    # 让同一引擎内所有连接共享同一块内存库（用例间仍因独立引擎而隔离）。
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "poolclass": StaticPool,
        "connect_args": {"check_same_thread": False},
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = "test_secret_key"
    app.config["WTF_CSRF_ENABLED"] = False
    app.url_map.strict_slashes = False

    db.init_app(app)

    # 测试环境下禁用请求结束时的 session.remove：client 请求触发的 teardown 会分离
    # 用例内已加载的实例，使 session.refresh(x) 报 "not persistent within this Session"。
    # 统一关闭后，所有 .refresh() 用法（admin_routes/data_sync/mqtt 等）恢复正常。
    try:
        db.session.remove = lambda *a, **k: None
    except Exception:  # noqa: BLE001
        pass

    # 创建API并注册路由
    api = Api(app, version="1.0", title="测试API", prefix="/api")

    # 动态注册 api 包下所有 Flask-RESTX 命名空间（每个模块/命名空间独立容错），
    # 使路由测试（subjects/users/rules/devices/admin/...）能命中真实端点而非 404。
    # 模块名列表已在模块加载时通过 walk_packages 预先发现并缓存于 _API_MODULE_NAMES，
    # 此处仅做（有缓存的）import + add_namespace，开销极低。
    import importlib
    import inspect
    import flask_restx as _frx

    _registered = 0
    for _modname in _API_MODULE_NAMES:
        try:
            _mod = importlib.import_module(_modname)
        except Exception as _e:  # noqa: BLE001
            print("[conftest] 跳过模块 %s: %s" % (_modname, _e))
            continue
        for _name, _obj in inspect.getmembers(_mod):
            if isinstance(_obj, _frx.Namespace):
                try:
                    api.add_namespace(_obj)
                    _registered += 1
                except Exception:  # noqa: BLE001 - 重名/重复注册忽略
                    pass
    print("[conftest] 已注册命名空间数量: %d" % _registered)

    # 同时注册普通 Blueprint（如 api/data/download_routes.py 的 download_bp），
    # 否则依赖独立 Blueprint 的路由（/api/scores/template/download 等）在测试中会 404。
    try:
        from api.data.download_routes import download_bp

        app.register_blueprint(download_bp)
    except Exception:  # noqa: BLE001
        pass

    with app.app_context():
        db.create_all()
        # 创建测试管理员
        from models import Admin
        from utils.security import hash_password

        existing_admin = Admin.query.filter_by(id=1).first()
        if not existing_admin:
            test_admin = Admin(
                id=1,
                username="test_admin",
                password=hash_password("test_password"),
                role="admin",
                real_name="测试管理员",
                phone="13800138000",
            )
            db.session.add(test_admin)
            db.session.commit()

            # 为种子管理员补齐 RBAC：admin 角色拥有 "all" 权限，
            # 否则 @requires_permission 走 DB-RBAC 查不到任何权限码 → 全部 403。
            from models import AdminRole, RolePermissionMapping

            if not AdminRole.query.filter_by(admin_id=1, role_code="admin").first():
                db.session.add(AdminRole(admin_id=1, role_code="admin"))
            if not RolePermissionMapping.query.filter_by(
                role_code="admin", permission_code="all"
            ).first():
                db.session.add(RolePermissionMapping(role_code="admin", permission_code="all"))
            db.session.commit()

        yield app
        db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """创建测试客户端"""
    return app.test_client()


@pytest.fixture(scope="function")
def db_session(app):
    """创建数据库会话"""
    from models import db

    with app.app_context():
        yield db.session
        db.session.rollback()


@pytest.fixture(scope="function")
def session(app):
    """数据库会话固件（db_session 的别名，供使用 (app, session) 签名的用例）。"""
    from models import db

    with app.app_context():
        yield db.session
        db.session.rollback()


@pytest.fixture
def sample_user(db_session):
    """创建示例用户"""
    from models import User
    import uuid

    # 使用uuid确保唯一性
    unique_card_id = "TEST" + str(uuid.uuid4())[:12]

    user = User(name="测试用户", card_id=unique_card_id, class_name="测试班级", current_score=100)
    db_session.add(user)
    db_session.commit()

    return user


@pytest.fixture
def sample_admin(db_session):
    """创建示例管理员（供 test_admin_routes / test_auth_service 等使用）"""
    from models import Admin, AdminRole, RolePermissionMapping
    from utils.security import hash_password
    import uuid

    unique_username = "TESTADMIN" + str(uuid.uuid4())[:12]
    admin = Admin(username=unique_username, password=hash_password("test123456"), role="admin")
    db_session.add(admin)
    db_session.commit()
    # 补齐 RBAC，使 has_permission 走 DB-RBAC 时命中 "all"（与 app 种子保持一致）
    if not AdminRole.query.filter_by(admin_id=admin.id, role_code="admin").first():
        db_session.add(AdminRole(admin_id=admin.id, role_code="admin"))
    if not RolePermissionMapping.query.filter_by(role_code="admin", permission_code="all").first():
        db_session.add(RolePermissionMapping(role_code="admin", permission_code="all"))
    db_session.commit()

    return admin


@pytest.fixture
def sample_category(db_session):
    """创建示例分类"""
    from models import ScoreCategory
    from datetime import datetime

    # 检查是否已存在同名分类
    existing = ScoreCategory.query.filter_by(name="测试分类").first()
    if existing:
        return existing

    category = ScoreCategory(
        name="测试分类",
        description="测试用分类",
        color="#FF0000",
        is_active=True,
        created_at=datetime.now(),
    )
    db_session.add(category)
    db_session.commit()

    return category


@pytest.fixture
def sample_rule(db_session, sample_category):
    """创建示例积分规则"""
    from models import ScoreRule

    rule = ScoreRule(
        name="测试规则",
        description="测试用规则",
        category_id=sample_category.id,
        score=10.0,
        is_active=True,
    )
    db_session.add(rule)
    db_session.commit()

    return rule


@pytest.fixture
def sample_class(db_session):
    """创建示例班级（ClassInfo），供 test_admin_routes 等使用。"""
    from models import ClassInfo
    import uuid

    unique_name = "TESTCLASS" + str(uuid.uuid4())[:8]
    cls = ClassInfo(name=unique_name, grade="高一", description="测试班级")
    db_session.add(cls)
    db_session.commit()

    return cls


@pytest.fixture
def clean_db(app):
    """清空业务数据（保留 Admin 种子），供 *_empty 测试使用。"""
    from models import db, Admin
    from utils.security import hash_password

    with app.app_context():
        # 按外键逆序清空所有表，保留表结构
        for table in reversed(db.metadata.sorted_tables):
            db.session.execute(table.delete())
        db.session.commit()
        # 重建测试管理员，避免影响后续依赖 admin id=1 的用例
        if not Admin.query.filter_by(id=1).first():
            db.session.add(
                Admin(
                    id=1,
                    username="test_admin",
                    password=hash_password("test_password"),
                    role="admin",
                    real_name="测试管理员",
                    phone="13800138000",
                )
            )
            db.session.commit()
        # 同步补齐 RBAC，使 auth_headers 签发的 token 拥有 "all" 权限
        from models import AdminRole, RolePermissionMapping

        if not AdminRole.query.filter_by(admin_id=1, role_code="admin").first():
            db.session.add(AdminRole(admin_id=1, role_code="admin"))
        if not RolePermissionMapping.query.filter_by(
            role_code="admin", permission_code="all"
        ).first():
            db.session.add(RolePermissionMapping(role_code="admin", permission_code="all"))
        db.session.commit()
        yield
        db.session.rollback()


@pytest.fixture
def auth_headers():
    """创建认证头：为种子管理员(id=1, test_admin, role=admin)签发合法 JWT access token。

    当前 app 的 @requires_permission 只认 Authorization: Bearer <token>（见
    utils/permission.py），旧的 X-Admin-Id 写法会触发 401。token 用 utils.security
    的同一 JWT_SECRET_KEY 常量签发/校验，确保一致。
    """
    from utils.security import generate_tokens

    tokens = generate_tokens(admin_id=1, username="test_admin", role="admin")
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tokens["access_token"],
    }


@pytest.fixture
def temp_dir():
    """创建临时目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def app_context(app):
    """应用上下文固件（供 test_permission_service / test_mqtt_message_processor /
    test_rule_engine_service 等需要在应用上下文中执行用例的测试）。"""
    with app.app_context() as ctx:
        yield ctx


def pytest_unconfigure(config):
    """
    收尾强制退出钩子。

    部分测试（设备 OTA、心跳、socket / MQTT 服务等）会启动后台线程且未清理，
    若遗留非守护线程，pytest 进程在所有用例跑完后仍无法退出，表现为“跑到末尾卡死”。

    此处先显式关闭由 init_scheduler 启动的调度器（非守护线程）使其干净退出，
    再检测残留非守护线程并以 os._exit(0) 兜底，保证全量跑批必然结束。
    """
    # 优先显式关闭调度器：让线程被正确停止（而非被强制杀死），进程干净退出。
    try:
        from app.service_init import shutdown_all_schedulers

        shutdown_all_schedulers()
    except Exception:  # noqa: BLE001
        pass
    try:
        from tasks.scheduler import shutdown_scheduler

        shutdown_scheduler()
    except Exception:  # noqa: BLE001
        pass

    lingering = [
        t.name
        for t in threading.enumerate()
        if t is not threading.main_thread() and t is not threading.current_thread() and not t.daemon
    ]
    if lingering:
        # 汇总已输出，直接退出，不被遗留线程拖死
        os._exit(0)
