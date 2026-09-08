class TestRankRoutes:

    def test_get_rank_rules_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/rank-rules/", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["success"] is True
            assert "rules" in data["data"]
            assert isinstance(data["data"]["rules"], list)

    def test_create_rank_rule(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/rank-rules/",
                json={"name": "测试排名", "min_score": 0, "max_score": 100},
                headers=auth_headers,
            )
            assert response.status_code == 201
            data = response.get_json()
            assert data["success"] is True
            assert data["message"] == "排名规则创建成功"
            assert "rule_id" in data["data"]

    def test_get_rank_rule_detail(self, client, app, auth_headers):
        with app.app_context():
            create_response = client.post(
                "/api/rank-rules/",
                json={"name": "详情排名测试", "min_score": 0, "max_score": 50},
                headers=auth_headers,
            )
            assert create_response.status_code == 201
            rule_id = create_response.get_json()["data"]["rule_id"]

            response = client.get(f"/api/rank-rules/{rule_id}", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["data"]["id"] == rule_id
            assert data["data"]["name"] == "详情排名测试"

    def test_get_rank_rule_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/rank-rules/99999", headers=auth_headers)
            assert response.status_code == 404

    def test_update_rank_rule(self, client, app, auth_headers):
        with app.app_context():
            create_response = client.post(
                "/api/rank-rules/",
                json={"name": "旧排名", "min_score": 0, "max_score": 50},
                headers=auth_headers,
            )
            assert create_response.status_code == 201
            rule_id = create_response.get_json()["data"]["rule_id"]

            response = client.put(
                f"/api/rank-rules/{rule_id}",
                json={"name": "新排名", "min_score": 50, "max_score": 100},
                headers=auth_headers,
            )
            assert response.status_code == 200
            assert response.get_json()["message"] == "排名规则更新成功"

            detail = client.get(f"/api/rank-rules/{rule_id}", headers=auth_headers)
            assert detail.get_json()["data"]["name"] == "新排名"

    def test_delete_rank_rule(self, client, app, auth_headers):
        with app.app_context():
            create_response = client.post(
                "/api/rank-rules/",
                json={"name": "测试排名", "min_score": 0, "max_score": 50},
                headers=auth_headers,
            )
            rule_id = create_response.get_json()["data"]["rule_id"]

            response = client.delete(f"/api/rank-rules/{rule_id}", headers=auth_headers)
            assert response.status_code == 200
            assert response.get_json()["success"] is True

            not_found = client.get(f"/api/rank-rules/{rule_id}", headers=auth_headers)
            assert not_found.status_code == 404

    def test_delete_rank_rule_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete("/api/rank-rules/99999", headers=auth_headers)
            assert response.status_code == 404
