import uuid
import pytest
from datetime import datetime
from models import User, Admin, ScoreRecord, ScoreRule, Device
from services.redis_cache_service import get_cache_service


class TestDashboardRoutes:

    def _get_admin_token(self, client, session):
        # 直接登录 conftest 种子管理员(id=1, test_admin/test_password, 已含 RBAC "all")，
        # 顶层返回 access_token；避免测试自建明文密码 admin 触发登录失败 → token 为 None → 401。
        response = client.post('/api/auth/login', json={
            'username': 'test_admin',
            'password': 'test_password'
        })
        data = response.get_json()
        return data.get('access_token') or data.get('data', {}).get('access_token')

    def _clean_data(self, session):
        # 全清共享表，避免会话内其他测试模块留下的数据污染 dashboard 聚合断言
        # （Admin 表不受影响，登录用的 test_admin 保留）
        session.query(ScoreRecord).delete()
        session.query(Device).delete()
        session.query(ScoreRule).delete()
        session.query(User).delete()
        session.commit()

    def test_get_dashboard_data(self, client, session):
        self._clean_data(session)
        get_cache_service().delete("dashboard_data")
        token = self._get_admin_token(client, session)

        for i in range(3):
            user = User(
                name=f'测试用户{i}',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=60 + i * 10,
                is_active=True
            )
            session.add(user)

        admin2 = Admin(
            username=f'testadmin2_{uuid.uuid4().hex[:8]}',
            password='testpassword123',
            role='teacher',
            real_name='测试教师'
        )
        session.add(admin2)

        rule = ScoreRule(name='测试规则', description='规则描述', score=5, is_active=True)
        session.add(rule)

        device = Device(device_id='DEV001', name='测试设备', status='online',
                        last_heartbeat=datetime.now())
        session.add(device)

        session.add(ScoreRecord(student_id=1, score_change=5, description='测试记录'))

        session.commit()

        response = client.get('/api/dashboard/data', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        dashboard_data = data['data']

        assert 'total_users' in dashboard_data
        assert dashboard_data['total_users'] >= 3
        assert 'total_admins' in dashboard_data
        assert dashboard_data['total_admins'] >= 2
        assert 'total_rules' in dashboard_data
        assert dashboard_data['total_rules'] >= 1
        assert 'total_devices' in dashboard_data
        assert dashboard_data['total_devices'] >= 1
        assert 'online_devices' in dashboard_data
        assert dashboard_data['online_devices'] >= 1
        assert 'today_records' in dashboard_data
        assert 'weekly_records' in dashboard_data
        assert 'avg_score' in dashboard_data
        assert 'top_users' in dashboard_data
        assert 'category_stats' in dashboard_data

    def test_dashboard_cache(self, client, session):
        self._clean_data(session)
        # 该测试验证 dashboard 数据被缓存（返回与 DB 变更无关的旧值）。
        # 需要真实 Redis 才能体现缓存行为；无 Redis 时跳过，避免测试环境无缓存导致误报。
        cache = get_cache_service()
        if not cache._connect("redis://localhost:6379/0"):
            pytest.skip("Redis 不可用，跳过缓存行为验证")
        cache.delete("dashboard_data")
        token = self._get_admin_token(client, session)

        user = User(
            name='缓存测试用户',
            card_id=f'{uuid.uuid4().int % 1000000000000}',
            class_name='测试班级',
            current_score=60,
            is_active=True
        )
        session.add(user)
        session.commit()

        response1 = client.get('/api/dashboard/data', headers={'Authorization': f'Bearer {token}'})
        assert response1.status_code == 200
        data1 = response1.get_json()

        session.add(User(
            name='新用户',
            card_id=f'{uuid.uuid4().int % 1000000000000}',
            class_name='测试班级',
            current_score=70,
            is_active=True
        ))
        session.commit()

        response2 = client.get('/api/dashboard/data', headers={'Authorization': f'Bearer {token}'})
        assert response2.status_code == 200
        data2 = response2.get_json()

        assert data1['data']['total_users'] == data2['data']['total_users']

        # 验证完缓存行为后复位全局缓存连接，避免污染后续测试的隔离性
        cache.client = None

    def test_dashboard_empty_data(self, client, session):
        self._clean_data(session)
        get_cache_service().delete("dashboard_data")
        token = self._get_admin_token(client, session)

        response = client.get('/api/dashboard/data', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        dashboard_data = data['data']

        assert dashboard_data['total_users'] == 0
        assert dashboard_data['total_admins'] >= 1
        assert dashboard_data['total_rules'] == 0
        assert dashboard_data['total_devices'] == 0
        assert dashboard_data['online_devices'] == 0
        assert dashboard_data['today_records'] == 0
        assert dashboard_data['weekly_records'] == 0
        assert dashboard_data['avg_score'] == 0
        assert len(dashboard_data['top_users']) == 0
        assert len(dashboard_data['category_stats']) == 0

    def test_dashboard_top_users(self, client, session):
        self._clean_data(session)
        get_cache_service().delete("dashboard_data")
        token = self._get_admin_token(client, session)

        users = []
        for i in range(5):
            user = User(
                name=f'排名用户{i}',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=50 + i * 10,
                is_active=True
            )
            session.add(user)
            users.append(user)
        session.commit()

        response = client.get('/api/dashboard/data', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

        top_users = data['data']['top_users']
        assert len(top_users) == 5
        scores = [u['current_score'] for u in top_users]
        assert scores == sorted(scores, reverse=True)

    def test_dashboard_avg_score(self, client, session):
        self._clean_data(session)
        get_cache_service().delete("dashboard_data")
        token = self._get_admin_token(client, session)

        users = []
        for i in range(3):
            user = User(
                name=f'平均用户{i}',
                card_id=f'{uuid.uuid4().int % 1000000000000}',
                class_name='测试班级',
                current_score=50 + i * 10,
                is_active=True
            )
            session.add(user)
            users.append(user)
        session.commit()

        response = client.get('/api/dashboard/data', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

        expected_avg = (50 + 60 + 70) / 3
        assert data['data']['avg_score'] == round(expected_avg, 2)

    def test_dashboard_category_stats(self, client, session):
        self._clean_data(session)
        get_cache_service().delete("dashboard_data")
        token = self._get_admin_token(client, session)

        rule1 = ScoreRule(name='规则1', description='规则1描述', score=5, is_active=True)
        rule2 = ScoreRule(name='规则2', description='规则2描述', score=10, is_active=True)
        session.add_all([rule1, rule2])
        session.commit()

        user = User(
            name='统计用户',
            card_id=f'{uuid.uuid4().int % 1000000000000}',
            class_name='测试班级',
            current_score=60,
            is_active=True
        )
        session.add(user)
        session.commit()

        session.add(ScoreRecord(student_id=user.id, rule_id=rule1.id, score_change=5, description='规则1记录'))
        session.add(ScoreRecord(student_id=user.id, rule_id=rule1.id, score_change=5, description='规则1记录'))
        session.add(ScoreRecord(student_id=user.id, rule_id=rule2.id, score_change=10, description='规则2记录'))
        session.commit()

        response = client.get('/api/dashboard/data', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

        category_stats = data['data']['category_stats']
        assert len(category_stats) >= 2
