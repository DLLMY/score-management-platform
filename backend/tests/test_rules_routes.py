

class TestRulesRoutes:

    def test_get_rules_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/rules/', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert 'rules' in data['data']
            assert 'total' in data['data']
            assert 'page' in data['data']
            assert 'per_page' in data['data']

    def test_get_rules_list_with_pagination(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/rules/?page=1&per_page=10', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data['data']['page'] == 1
            assert data['data']['per_page'] == 10

    def test_get_rules_list_with_filter(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/rules/?is_active=true', headers=auth_headers)
            assert response.status_code == 200

    def test_create_rule(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/rules/',
                json={'name': '测试规则', 'score': 10, 'description': '测试描述'},
                headers=auth_headers
            )
            assert response.status_code == 201
            data = response.get_json()
            assert data['success'] is True
            assert data['data']['name'] == '测试规则'
            assert data['data']['score'] == 10.0
            assert data['data']['is_active'] is True

    def test_create_rule_validation_error(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/rules/',
                json={'name': '', 'score': 10},
                headers=auth_headers
            )
            assert response.status_code == 400

    def test_create_rule_missing_score(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/rules/',
                json={'name': '测试规则'},
                headers=auth_headers
            )
            assert response.status_code == 400

    def test_get_rule_detail(self, client, app, auth_headers):
        with app.app_context():
            create_response = client.post(
                '/api/rules/',
                json={'name': '测试规则', 'score': 5},
                headers=auth_headers
            )
            rule_id = create_response.get_json()['data']['id']

            response = client.get(f'/api/rules/{rule_id}', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data['data']['id'] == rule_id
            assert data['data']['name'] == '测试规则'

    def test_get_rule_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/rules/99999', headers=auth_headers)
            assert response.status_code == 404

    def test_update_rule(self, client, app, auth_headers):
        with app.app_context():
            create_response = client.post(
                '/api/rules/',
                json={'name': '旧规则', 'score': 5},
                headers=auth_headers
            )
            rule_id = create_response.get_json()['data']['id']

            response = client.put(
                f'/api/rules/{rule_id}',
                json={'name': '新规则', 'score': 10},
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert data['message'] == '规则更新成功'

    def test_update_rule_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.put(
                '/api/rules/99999',
                json={'name': '新规则', 'score': 10},
                headers=auth_headers
            )
            assert response.status_code == 404

    def test_delete_rule(self, client, app, auth_headers):
        with app.app_context():
            create_response = client.post(
                '/api/rules/',
                json={'name': '测试规则', 'score': 5},
                headers=auth_headers
            )
            rule_id = create_response.get_json()['data']['id']

            response = client.delete(f'/api/rules/{rule_id}', headers=auth_headers)
            assert response.status_code == 200

            get_response = client.get(f'/api/rules/{rule_id}', headers=auth_headers)
            assert get_response.status_code == 404

    def test_delete_rule_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete('/api/rules/99999', headers=auth_headers)
            assert response.status_code == 404
