class TestClassPeriodsRoutes:

    def test_list_class_periods(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/class-periods/", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert "periods" in data and "total" in data
            assert isinstance(data["periods"], list)

    def test_create_class_period(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/class-periods/",
                json={
                    "name": "测试节次",
                    "period_number": 991,
                    "start_hour": 8,
                    "start_minute": 0,
                    "end_hour": 8,
                    "end_minute": 40,
                },
                headers=auth_headers,
            )
            assert response.status_code == 201
            data = response.get_json()
            assert data["success"] is True
            assert data["data"]["name"] == "测试节次"

            pid = data["data"]["id"]
            detail = client.get(f"/api/class-periods/{pid}", headers=auth_headers)
            assert detail.status_code == 200
            assert detail.get_json()["name"] == "测试节次"

    def test_create_duplicate_period_number(self, client, app, auth_headers):
        with app.app_context():
            r1 = client.post(
                "/api/class-periods/",
                json={
                    "name": "A节",
                    "period_number": 992,
                    "start_hour": 8,
                    "start_minute": 0,
                    "end_hour": 8,
                    "end_minute": 40,
                },
                headers=auth_headers,
            )
            assert r1.status_code == 201
            r2 = client.post(
                "/api/class-periods/",
                json={
                    "name": "B节",
                    "period_number": 992,
                    "start_hour": 9,
                    "start_minute": 0,
                    "end_hour": 9,
                    "end_minute": 40,
                },
                headers=auth_headers,
            )
            assert r2.status_code == 400
            assert "已存在" in r2.get_json()["message"]

    def test_update_class_period(self, client, app, auth_headers):
        with app.app_context():
            cr = client.post(
                "/api/class-periods/",
                json={
                    "name": "旧节次",
                    "period_number": 993,
                    "start_hour": 8,
                    "start_minute": 0,
                    "end_hour": 8,
                    "end_minute": 40,
                },
                headers=auth_headers,
            )
            pid = cr.get_json()["data"]["id"]
            response = client.put(
                f"/api/class-periods/{pid}", json={"name": "新节次"}, headers=auth_headers
            )
            assert response.status_code == 200
            assert response.get_json()["data"]["name"] == "新节次"

    def test_delete_class_period(self, client, app, auth_headers):
        with app.app_context():
            cr = client.post(
                "/api/class-periods/",
                json={
                    "name": "删节次",
                    "period_number": 994,
                    "start_hour": 8,
                    "start_minute": 0,
                    "end_hour": 8,
                    "end_minute": 40,
                },
                headers=auth_headers,
            )
            pid = cr.get_json()["data"]["id"]
            response = client.delete(f"/api/class-periods/{pid}", headers=auth_headers)
            assert response.status_code == 200
            assert response.get_json()["success"] is True
            assert client.get(f"/api/class-periods/{pid}", headers=auth_headers).status_code == 404

    def test_batch_update_class_periods(self, client, app, auth_headers):
        with app.app_context():
            cr = client.post(
                "/api/class-periods/",
                json={
                    "name": "批节次",
                    "period_number": 995,
                    "start_hour": 8,
                    "start_minute": 0,
                    "end_hour": 8,
                    "end_minute": 40,
                },
                headers=auth_headers,
            )
            pid = cr.get_json()["data"]["id"]
            response = client.put(
                "/api/class-periods/batch",
                json={"periods": [{"id": pid, "name": "批改节次"}]},
                headers=auth_headers,
            )
            assert response.status_code == 200
            detail = client.get(f"/api/class-periods/{pid}", headers=auth_headers)
            assert detail.get_json()["name"] == "批改节次"

    def test_reset_class_periods(self, client, app, auth_headers):
        with app.app_context():
            response = client.post("/api/class-periods/reset", headers=auth_headers)
            assert response.status_code == 200
            assert response.get_json()["success"] is True
            listing = client.get("/api/class-periods/", headers=auth_headers).get_json()
            assert listing["total"] == 12
