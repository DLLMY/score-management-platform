class TestTimeRulesRoutes:

    def test_get_time_rules_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/time-rules/', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert 'rules' in data
            assert isinstance(data['rules'], list)

    def test_get_time_rule_detail(self, client, app, auth_headers):
        with app.app_context():
            cr = client.post(
                '/api/time-rules/',
                json={'name': '测试时间规则', 'start_hour': 8, 'start_minute': 0, 'end_hour': 12, 'end_minute': 0},
                headers=auth_headers,
            )
            assert cr.status_code == 201
            rid = cr.get_json()['id']
            response = client.get(f'/api/time-rules/{rid}', headers=auth_headers)
            assert response.status_code == 200
            assert response.get_json()['name'] == '测试时间规则'

    def test_create_time_rule(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/time-rules/',
                json={'name': '测试时间规则', 'start_hour': 8, 'start_minute': 0, 'end_hour': 12, 'end_minute': 0},
                headers=auth_headers,
            )
            assert response.status_code == 201
            data = response.get_json()
            assert data['name'] == '测试时间规则'
            assert 'id' in data

    def test_update_time_rule(self, client, app, auth_headers):
        with app.app_context():
            cr = client.post(
                '/api/time-rules/',
                json={'name': '旧规则', 'start_hour': 8, 'start_minute': 0, 'end_hour': 12, 'end_minute': 0},
                headers=auth_headers,
            )
            rid = cr.get_json()['id']
            response = client.put(f'/api/time-rules/{rid}', json={'name': '新规则'}, headers=auth_headers)
            assert response.status_code == 200
            assert response.get_json()['message'] == '时间规则更新成功'
            detail = client.get(f'/api/time-rules/{rid}', headers=auth_headers)
            assert detail.get_json()['name'] == '新规则'

    def test_delete_time_rule(self, client, app, auth_headers):
        with app.app_context():
            cr = client.post(
                '/api/time-rules/',
                json={'name': '删除规则', 'start_hour': 8, 'start_minute': 0, 'end_hour': 12, 'end_minute': 0},
                headers=auth_headers,
            )
            rid = cr.get_json()['id']
            response = client.delete(f'/api/time-rules/{rid}', headers=auth_headers)
            assert response.status_code == 200
            assert response.get_json()['success'] is True
            assert client.get(f'/api/time-rules/{rid}', headers=auth_headers).status_code == 404

    def test_check_time_rule(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/time-rules/check', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert 'allowed' in data
