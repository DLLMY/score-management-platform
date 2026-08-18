"""积分盒子（box）路由行为测试 — F17 防腐层迁移前基线 + 迁移后回归。

捕获 box_routes.BoxVerify.POST /verify 的真实契约：
- 缺参 → 400；用户不存在 → 404；设备离线 → 400；规则未启用 → 400
- 带 rule_id 且校验通过 → 200，current_score += rule.score，落库一条 ScoreRecord
- 不带 rule_id → 200，只返回用户身份（含 class_name），不改分、不落明细

这些断言在迁移前（原路由）与迁移后（service 化）必须完全一致（零契约漂移）。
"""

from models import Device, User, ScoreRecord


class TestBoxRoutes:

    def test_box_verify_missing_params(self, client, app, auth_headers, db_session):
        with app.app_context():
            # 仅 card_id，缺 device_id → 400
            response = client.post('/api/box/verify', json={'card_id': '123456'}, headers=auth_headers)
            assert response.status_code == 400

    def test_box_verify_user_not_found(self, client, app, auth_headers, db_session):
        with app.app_context():
            device = Device(device_id='box_dev_uf', name='盒子', status='online')
            db_session.add(device)
            db_session.commit()
            response = client.post(
                '/api/box/verify',
                json={'card_id': 'nope_card', 'device_id': 'box_dev_uf'},
                headers=auth_headers,
            )
            assert response.status_code == 404

    def test_box_verify_device_offline(self, client, app, auth_headers, db_session):
        with app.app_context():
            device = Device(device_id='box_dev_off', name='离线盒子', status='offline')
            db_session.add(device)
            user = User(name='离线用户', card_id='BOXCARD_OFF', class_name='一班', current_score=50)
            db_session.add(user)
            db_session.commit()
            response = client.post(
                '/api/box/verify',
                json={'card_id': 'BOXCARD_OFF', 'device_id': 'box_dev_off'},
                headers=auth_headers,
            )
            assert response.status_code == 400

    def test_box_verify_no_rule(self, client, app, auth_headers, db_session):
        with app.app_context():
            device = Device(device_id='box_dev_nr', name='盒子', status='online')
            db_session.add(device)
            user = User(name='无规则用户', card_id='BOXCARD_NR', class_name='二班', current_score=60)
            db_session.add(user)
            db_session.commit()
            before = user.current_score
            response = client.post(
                '/api/box/verify',
                json={'card_id': 'BOXCARD_NR', 'device_id': 'box_dev_nr'},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert data['data']['user']['current_score'] == before
            assert data['data']['user']['class_name'] == '二班'
            # 不带 rule_id 不应产生积分明细
            assert ScoreRecord.query.filter_by(student_id=user.id).count() == 0

    def test_box_verify_score_added(self, client, app, auth_headers, db_session, sample_rule):
        with app.app_context():
            device = Device(device_id='box_dev_add', name='盒子', status='online')
            db_session.add(device)
            user = User(name='加分用户', card_id='BOXCARD_ADD', class_name='三班', current_score=70)
            db_session.add(user)
            db_session.commit()
            before = user.current_score
            response = client.post(
                '/api/box/verify',
                json={'card_id': 'BOXCARD_ADD', 'device_id': 'box_dev_add', 'rule_id': sample_rule.id},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert data['data']['user']['current_score'] == before + sample_rule.score
            assert data['message'] == f"积分添加成功 +{sample_rule.score}"
            rec = ScoreRecord.query.filter_by(student_id=user.id, rule_id=sample_rule.id).first()
            assert rec is not None
            assert rec.score_change == sample_rule.score

    def test_box_verify_rule_inactive(self, client, app, auth_headers, db_session, sample_rule):
        with app.app_context():
            device = Device(device_id='box_dev_ia', name='盒子', status='online')
            db_session.add(device)
            user = User(name='未启用规则用户', card_id='BOXCARD_IA', class_name='四班', current_score=80)
            db_session.add(user)
            db_session.commit()
            sample_rule.is_active = False
            db_session.commit()
            response = client.post(
                '/api/box/verify',
                json={'card_id': 'BOXCARD_IA', 'device_id': 'box_dev_ia', 'rule_id': sample_rule.id},
                headers=auth_headers,
            )
            assert response.status_code == 400
