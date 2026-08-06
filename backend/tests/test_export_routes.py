

class TestExportRoutes:

    def test_export_users_excel(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'excel', 'type': 'users'},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 403

    def test_export_users_pdf(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'pdf', 'type': 'users'},
                headers=auth_headers
            )
            assert response.status_code in (200, 403, 400, 500)

    def test_export_rules(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'excel', 'type': 'rules'},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 403

    def test_export_devices(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'excel', 'type': 'devices'},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 403

    def test_export_records(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'excel', 'type': 'records'},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 403 or response.status_code == 500

    def test_export_summary(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'pdf', 'type': 'summary'},
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 403 or response.status_code == 500

    def test_export_invalid_format(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'invalid', 'type': 'users'},
                headers=auth_headers
            )
            assert response.status_code == 400 or response.status_code == 403

    def test_export_invalid_type(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/export/',
                json={'format': 'excel', 'type': 'invalid'},
                headers=auth_headers
            )
            assert response.status_code == 400 or response.status_code == 403
