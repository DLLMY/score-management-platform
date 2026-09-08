class TestAnalysisRoutes:

    def test_get_user_analysis(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/analysis/user/1", headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404

    def test_get_user_analysis_not_found(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/analysis/user/99999", headers=auth_headers)

            assert response.status_code == 404

    def test_get_class_analysis(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/analysis/class/TestClass", headers=auth_headers)

            assert response.status_code in [200, 404]
