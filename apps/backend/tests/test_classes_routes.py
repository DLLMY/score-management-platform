class TestClassesRoutes:

    def test_get_classes_list(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/classes/", headers=auth_headers)

            assert response.status_code == 200

            data = response.get_json()

            assert "data" in data or "classes" in data

    def test_get_classes_list_with_pagination(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/classes/?page=1&page_size=10", headers=auth_headers)

            assert response.status_code == 200

    def test_get_classes_list_with_search(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/classes/?keyword=测试", headers=auth_headers)

            assert response.status_code == 200

    def test_get_class_not_found(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/classes/99999", headers=auth_headers)

            assert response.status_code == 404
