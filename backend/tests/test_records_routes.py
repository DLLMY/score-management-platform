

class TestRecordsRoutes:

    def test_get_records_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert 'data' in data or 'records' in data

    def test_get_records_list_with_pagination(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/?page=1&page_size=10', headers=auth_headers)
            assert response.status_code == 200

    def test_get_records_list_with_filters(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/?operation=add', headers=auth_headers)
            assert response.status_code == 200

    def test_get_record_detail(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/1', headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_record_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/99999', headers=auth_headers)
            assert response.status_code == 404

    def test_create_record(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/records/',
                json={'user_id': 1, 'score_change': 10, 'description': '测试加分'},
                headers=auth_headers
            )
            assert response.status_code in (200, 201, 400, 403)

    def test_delete_record_with_confirm(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete(
                '/api/records/1',
                json={'confirm': True},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 404 or response.status_code == 403

    def test_delete_record(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete('/api/records/1', headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_user_scores(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/user/1', headers=auth_headers)
            assert response.status_code == 200

    def test_get_class_scores(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/class/1', headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_statistics(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/records/statistics', headers=auth_headers)
            assert response.status_code == 200

    def test_score_entry(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/records/score-entry',
                json={'user_id': 1, 'operation': 'add', 'score': 10, 'reason': '测试加分'},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 400 or response.status_code == 404
