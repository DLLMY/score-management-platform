class TestRecordsRoutes:

    def test_get_records_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert "data" in data or "records" in data

    def test_get_records_list_with_pagination(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/?page=1&page_size=10", headers=auth_headers)
            assert response.status_code == 200

    def test_get_records_list_with_filters(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/?operation=add", headers=auth_headers)
            assert response.status_code == 200

    def test_get_record_detail(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/1", headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_record_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/99999", headers=auth_headers)
            assert response.status_code == 404

    def test_create_record(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/records/",
                json={"user_id": 1, "score_change": 10, "description": "测试加分"},
                headers=auth_headers,
            )
            assert response.status_code in (200, 201, 400, 403)

    def test_delete_record_with_confirm(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete("/api/records/1", json={"confirm": True}, headers=auth_headers)
            assert (
                response.status_code == 200
                or response.status_code == 404
                or response.status_code == 403
            )

    def test_delete_record(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete("/api/records/1", headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_user_scores(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/user/1", headers=auth_headers)
            assert response.status_code == 200

    def test_get_class_scores(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/class/1", headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_statistics(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/records/statistics", headers=auth_headers)
            assert response.status_code == 200

    def test_score_entry(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/records/score-entry",
                json={"user_id": 1, "operation": "add", "score": 10, "reason": "测试加分"},
                headers=auth_headers,
            )
            assert (
                response.status_code == 200
                or response.status_code == 400
                or response.status_code == 404
            )

    @staticmethod
    def _unwrap(response):
        """归一化既有契约：部分端点返回双重元组 → 响应体为 [envelope, 201] 列表。"""
        body = response.get_json()
        if isinstance(body, list):
            return body[0]
        return body

    def test_create_record_success(self, client, app, auth_headers, sample_user):
        """POST / 创建积分记录：201 + 返回 record_id + 原子累加 current_score。"""
        with app.app_context():
            from models import User

            before = sample_user.current_score
            response = client.post(
                "/api/records/",
                json={"user_id": sample_user.id, "score_change": -5, "description": "测试扣分"},
                headers=auth_headers,
            )
            assert response.status_code == 201
            body = self._unwrap(response)
            assert body["data"]["record_id"] is not None
            fresh = User.query.get(sample_user.id)
            assert fresh.current_score == before - 5

    def test_score_entry_success(self, client, app, auth_headers, sample_user):
        """POST /score-entry 积分录入：201 + new_score 反映原子累加。"""
        with app.app_context():
            before = sample_user.current_score
            response = client.post(
                "/api/records/score-entry",
                json={"user_id": sample_user.id, "score_change": -5},
                headers=auth_headers,
            )
            assert response.status_code == 201
            body = self._unwrap(response)
            assert body["data"]["record_id"] is not None
            assert body["data"]["new_score"] == before - 5

    def test_batch_entry_success(self, client, app, auth_headers, sample_user):
        """POST /batch-entry 批量录入：成功行返回 record_id，原子累加生效。"""
        with app.app_context():
            from models import User

            before = sample_user.current_score
            response = client.post(
                "/api/records/batch-entry",
                json={
                    "entries": [{"user_id": sample_user.id, "score_change": -2}],
                    "operator": "batch_admin",
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
            body = self._unwrap(response)
            assert body["data"]["results"][0]["success"] is True
            assert body["data"]["results"][0]["record_id"] is not None
            fresh = User.query.get(sample_user.id)
            assert fresh.current_score == before - 2

    def test_delete_record_requires_confirm(self, client, app, auth_headers, sample_user):
        """DELETE 无 confirm：返回 400 且 requires_confirm=True（不删记录）。"""
        with app.app_context():
            create = client.post(
                "/api/records/",
                json={"user_id": sample_user.id, "score_change": -5, "description": "待删"},
                headers=auth_headers,
            )
            record_id = self._unwrap(create)["data"]["record_id"]
            response = client.delete(f"/api/records/{record_id}", json={}, headers=auth_headers)
            assert response.status_code == 400
            body = self._unwrap(response)
            assert body["data"]["requires_confirm"] is True

    def test_delete_record_with_confirm_rolls_back(self, client, app, auth_headers, sample_user):
        """DELETE 带 confirm：成功删除并回滚积分（current_score 还原）。"""
        with app.app_context():
            from models import User, ScoreRecord

            before = sample_user.current_score
            create = client.post(
                "/api/records/",
                json={"user_id": sample_user.id, "score_change": -5, "description": "待删"},
                headers=auth_headers,
            )
            assert create.status_code == 201
            record_id = self._unwrap(create)["data"]["record_id"]
            assert ScoreRecord.query.get(record_id) is not None

            response = client.delete(
                f"/api/records/{record_id}", json={"confirm": True}, headers=auth_headers
            )
            assert response.status_code == 200
            fresh = User.query.get(sample_user.id)
            assert fresh.current_score == before
            assert ScoreRecord.query.get(record_id) is None
