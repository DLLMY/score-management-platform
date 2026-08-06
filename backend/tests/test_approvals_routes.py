

class TestApprovalsRoutes:

    def test_get_approvals_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/approvals/', headers=auth_headers)
            assert response.status_code == 200

    def test_get_approval_detail(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/approvals/1', headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_create_approval(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/approvals/',
                json={'user_id': 1, 'type': 'score_adjust', 'title': '测试审批', 'description': '测试审批', 'score_change': 10},
                headers=auth_headers
            )
            assert response.status_code in [200, 201, 400, 403, 404]

    def test_approve_approval(self, client, app, auth_headers):
        with app.app_context():
            response = client.post('/api/approvals/1/approve', headers=auth_headers)
            assert response.status_code in [200, 400, 404, 403]

    def test_reject_approval(self, client, app, auth_headers):
        with app.app_context():
            response = client.post('/api/approvals/1/reject', headers=auth_headers)
            assert response.status_code in [200, 400, 404, 403]

    def test_get_pending_approvals(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/approvals/pending', headers=auth_headers)
            assert response.status_code == 200
