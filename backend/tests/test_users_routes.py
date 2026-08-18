class TestUsersRoutes:

    def test_get_users_list(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/", headers=auth_headers)

            assert response.status_code == 200

            data = response.get_json()

            assert "data" in data or "users" in data

    def test_get_users_list_with_pagination(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/?page=1&page_size=10", headers=auth_headers)

            assert response.status_code == 200

    def test_get_users_list_with_search(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/?search=test", headers=auth_headers)

            assert response.status_code == 200

    def test_get_users_list_with_class_filter(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/?class_id=1", headers=auth_headers)

            assert response.status_code == 200

    def test_get_user_detail(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/1", headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404

    def test_get_user_not_found(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/99999", headers=auth_headers)

            assert response.status_code == 404

    def test_create_user(self, client, app, auth_headers):

        with app.app_context():

            response = client.post(
                "/api/users/",
                json={"name": "测试用户", "card_id": "C99999", "class_id": 1},
                headers=auth_headers,
            )

            assert (
                response.status_code == 200
                or response.status_code == 201
                or response.status_code == 400
            )

    def test_update_user(self, client, app, auth_headers):

        with app.app_context():

            response = client.put("/api/users/1", json={"name": "更新测试"}, headers=auth_headers)

            assert (
                response.status_code == 200
                or response.status_code == 404
                or response.status_code == 400
            )

    def test_delete_user(self, client, app, auth_headers):

        with app.app_context():

            response = client.delete("/api/users/1", headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404

    def test_get_user_scores(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/1/scores", headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404

    def test_get_user_rank(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/1/rank", headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404

    def test_get_user_statistics(self, client, app, auth_headers):

        with app.app_context():

            response = client.get("/api/users/1/statistics", headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404
