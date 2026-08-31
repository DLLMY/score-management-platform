"""积分规则分类路由的行为测试（F17 防腐层迁移前后一致性基线）。

契约说明：create 端点因历史双元组写法返回 `[response_dict, 200]` 列表，
其余端点返回标准 dict 信封。测试统一用 `_body()` 归一化后再断言，
确保 routes→service 迁移不改变对外契约。
"""


def _body(resp):
    """归一化响应体：create 返回列表 [dict, code]，其余为 dict。"""
    j = resp.get_json()
    if isinstance(j, list):
        return j[0]
    return j


class TestCategoriesRoutes:

    def test_get_categories_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/score-categories/", headers=auth_headers)
        assert response.status_code == 200
        body = _body(response)
        assert body["success"] is True
        assert "categories" in body["data"]

    def test_get_category_detail(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/score-categories/1", headers=auth_headers)
        assert response.status_code == 200 or response.status_code == 404

    def test_create_category(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/score-categories/",
                json={"name": "测试分类", "description": "测试描述"},
                headers=auth_headers,
            )
        assert response.status_code == 201
        body = _body(response)
        cat = body["data"]["category"]
        assert cat["name"] == "测试分类"
        assert cat["description"] == "测试描述"
        # 默认值契约：color 缺省为 #3B82F6，is_active 缺省为 True
        assert cat["color"] == "#3B82F6"
        assert cat["is_active"] is True
        assert isinstance(cat["id"], int)

    def test_create_duplicate_category_rejected(self, client, app, auth_headers):
        with app.app_context():
            first = client.post(
                "/api/score-categories/",
                json={"name": "重复名"},
                headers=auth_headers,
            )
            assert first.status_code == 201
            second = client.post(
                "/api/score-categories/",
                json={"name": "重复名"},
                headers=auth_headers,
            )
        assert second.status_code == 400
        assert "分类名称已存在" in second.get_json()["message"]

    def test_update_category(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/score-categories/",
                json={"name": "待更新"},
                headers=auth_headers,
            )
            cat_id = _body(created)["data"]["category"]["id"]
            response = client.put(
                "/api/score-categories/%d" % cat_id,
                json={"name": "更新测试", "color": "#FF0000", "is_active": False},
                headers=auth_headers,
            )
        assert response.status_code == 200
        assert response.get_json()["message"] == "分类更新成功"

    def test_update_duplicate_name_rejected(self, client, app, auth_headers):
        with app.app_context():
            client.post("/api/score-categories/", json={"name": "A类"}, headers=auth_headers)
            b = client.post("/api/score-categories/", json={"name": "B类"}, headers=auth_headers)
            b_id = _body(b)["data"]["category"]["id"]
            resp = client.put(
                "/api/score-categories/%d" % b_id,
                json={"name": "A类"},
                headers=auth_headers,
            )
        assert resp.status_code == 400
        assert "分类名称已存在" in resp.get_json()["message"]

    def test_delete_category(self, client, app, auth_headers):
        with app.app_context():
            created = client.post(
                "/api/score-categories/",
                json={"name": "待删除"},
                headers=auth_headers,
            )
            cat_id = _body(created)["data"]["category"]["id"]
            response = client.delete("/api/score-categories/%d" % cat_id, headers=auth_headers)
        assert response.status_code == 200
        assert response.get_json()["message"] == "分类删除成功"

    def test_delete_category_with_rules_rejected(self, client, app, auth_headers):
        from models import ScoreCategory, ScoreRule, db

        with app.app_context():
            created = client.post(
                "/api/score-categories/",
                json={"name": "带规则分类"},
                headers=auth_headers,
            )
            cat_id = _body(created)["data"]["category"]["id"]
            rule = ScoreRule(name="附属规则", category_id=cat_id, score=1, is_active=True)
            db.session.add(rule)
            db.session.commit()
            response = client.delete("/api/score-categories/%d" % cat_id, headers=auth_headers)
        assert response.status_code == 400
        assert "条规则" in response.get_json()["message"]

    def test_get_category_rules(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/score-categories/1/rules", headers=auth_headers)
        assert response.status_code == 200 or response.status_code == 404
