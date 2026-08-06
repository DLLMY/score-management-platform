

class TestSystemRoutes:

    def test_get_health_check(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/system/health', headers=auth_headers)
            assert response.status_code == 200

    def test_get_system_config(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/system/config', headers=auth_headers)
            assert response.status_code == 200

    def test_update_system_config(self, client, app, auth_headers):
        with app.app_context():
            response = client.put(
                '/api/system/config',
                json={'key': 'value'},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 400

    def test_get_backups(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/system/backups', headers=auth_headers)
            assert response.status_code == 200

    def test_create_backup(self, client, app, auth_headers):
        with app.app_context():
            response = client.post('/api/system/backup', headers=auth_headers)
            assert response.status_code in [200, 400, 404]

    def test_clear_cache(self, client, app, auth_headers):
        with app.app_context():
            response = client.post('/api/system/clear-cache', headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 400

    def test_get_cache_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/system/cache-stats', headers=auth_headers)
            assert response.status_code == 200

    def test_get_csrf_token(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/system/csrf-token', headers=auth_headers)
            assert response.status_code == 200

    def test_get_performance(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/system/performance', headers=auth_headers)
            assert response.status_code == 200

    def test_get_system_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/system/stats', headers=auth_headers)
            assert response.status_code == 200
