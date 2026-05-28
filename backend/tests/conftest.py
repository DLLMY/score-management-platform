#!/usr/bin/env python3
"""
测试配置文件 - pytest fixtures和测试环境配置
"""

import sys
import os
import pytest
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture(scope='session')
def app():
    """创建测试用的Flask应用实例"""
    import sys
    import os

    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

    from app import app as flask_app

    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    flask_app.config['WTF_CSRF_ENABLED'] = False

    from tests.test_permission import test_bp
    if 'test_permission' not in flask_app.blueprints:
        flask_app.register_blueprint(test_bp, url_prefix='/test')

    return flask_app

@pytest.fixture(scope='session')
def client(app):
    """创建测试客户端"""
    return app.test_client()

@pytest.fixture(scope='function')
def db_session(app):
    """创建测试数据库会话"""
    from models import db

    with app.app_context():
        db.create_all()
        yield db.session
        db.session.remove()
        db.drop_all()

@pytest.fixture
def sample_admin(db_session):
    """创建测试管理员账户"""
    from models import Admin
    from utils.security import hash_password

    admin = Admin(
        username='test_admin',
        password=hash_password('Test1234'),
        role='admin',
        real_name='Test Admin'
    )
    db_session.add(admin)
    db_session.commit()

    return admin

@pytest.fixture
def sample_user(db_session):
    """创建测试用户"""
    from models import User

    user = User(
        name='Test User',
        card_id='TEST_CARD_001',
        class_name='Test Class',
        current_score=60
    )
    db_session.add(user)
    db_session.commit()

    return user

@pytest.fixture
def sample_category(db_session):
    """创建测试积分分类"""
    from models import ScoreCategory

    category = ScoreCategory(
        name='Test Category',
        color='#FF0000'
    )
    db_session.add(category)
    db_session.commit()

    return category

@pytest.fixture
def sample_rule(db_session, sample_category):
    """创建测试积分规则"""
    from models import ScoreRule

    rule = ScoreRule(
        name='Test Rule',
        category_id=sample_category.id,
        score=10,
        is_active=True
    )
    db_session.add(rule)
    db_session.commit()

    return rule

@pytest.fixture
def auth_headers(sample_admin):
    """创建认证头"""
    return {
        'X-Admin-Id': str(sample_admin.id),
        'Content-Type': 'application/json'
    }

@pytest.fixture
def jwt_auth_headers(sample_admin):
    """创建JWT认证头"""
    from utils.security import generate_access_token

    token = generate_access_token(sample_admin.id, sample_admin.username, sample_admin.role)

    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
