

class TestNotifyHistoryRoutes:

    def test_get_notify_history_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/notify_history/', headers=auth_headers)
            assert response.status_code == 200

    def test_get_notify_history_detail(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/notify_history/1', headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_notify_history_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/notify_history/stats', headers=auth_headers)
            assert response.status_code == 200

    def test_clean_notify_history(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete('/api/notify_history/clean', headers=auth_headers)
            assert response.status_code in [200, 400, 403]
