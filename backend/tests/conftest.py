#!/usr/bin/env python3
"""
pytest配置文件 - 提供测试夹具和配置
"""

import pytest
import os
import sys
import tempfile
from datetime import datetime

basedir = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, basedir)


@pytest.fixture(scope='session')
def app():
    """创建测试用Flask应用"""
    from flask import Flask
    from flask_restx import Api
    from models import db
    
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'test_secret_key'
    app.config['WTF_CSRF_ENABLED'] = False
    app.url_map.strict_slashes = False
    
    db.init_app(app)
    
    # 创建API并注册路由
    api = Api(app, version='1.0', title='测试API', prefix='/api')
    
    from routes.users_routes import ns_users
    from routes.rules_routes import ns_rules
    from routes.devices_routes import ns_devices
    
    api.add_namespace(ns_users)
    api.add_namespace(ns_rules)
    api.add_namespace(ns_devices)
    
    with app.app_context():
        db.create_all()
        # 创建测试管理员
        from models import Admin
        from utils.security import hash_password
        
        existing_admin = Admin.query.filter_by(id=1).first()
        if not existing_admin:
            test_admin = Admin(
                id=1,
                username='test_admin',
                password=hash_password('test_password'),
                role='admin',
                real_name='测试管理员',
                phone='13800138000'
            )
            db.session.add(test_admin)
            db.session.commit()
        
        yield app
        db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    """创建测试客户端"""
    return app.test_client()


@pytest.fixture(scope='function')
def db_session(app):
    """创建数据库会话"""
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
    unique_card_id = 'TEST' + str(uuid.uuid4())[:12]
    
    user = User(
        name='测试用户',
        card_id=unique_card_id,
        class_name='测试班级',
        current_score=100
    )
    db_session.add(user)
    db_session.commit()
    
    return user


@pytest.fixture
def sample_category(db_session):
    """创建示例分类"""
    from models import ScoreCategory
    from datetime import datetime
    
    # 检查是否已存在同名分类
    existing = ScoreCategory.query.filter_by(name='测试分类').first()
    if existing:
        return existing
    
    category = ScoreCategory(
        name='测试分类',
        description='测试用分类',
        color='#FF0000',
        is_active=True,
        created_at=datetime.now()
    )
    db_session.add(category)
    db_session.commit()
    
    return category


@pytest.fixture
def sample_rule(db_session, sample_category):
    """创建示例积分规则"""
    from models import ScoreRule
    
    rule = ScoreRule(
        name='测试规则',
        description='测试用规则',
        category_id=sample_category.id,
        score=10.0,
        is_active=True
    )
    db_session.add(rule)
    db_session.commit()
    
    return rule


@pytest.fixture
def auth_headers():
    """创建认证头"""
    return {
        'Content-Type': 'application/json',
        'X-Admin-Id': '1'
    }


@pytest.fixture
def temp_dir():
    """创建临时目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir
