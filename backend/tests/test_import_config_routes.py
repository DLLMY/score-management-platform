import pytest


def _envelope(resp):
    return resp.get_json()


def _make_config(client, auth_headers, module_name="subjects", config_name="默认科目导入"):
    payload = {
        "module_name": module_name,
        "config_name": config_name,
        "field_mappings": [],
        "validation_rules": [],
        "conflict_strategy": "update",
        "default_values": {},
        "is_active": True,
        "is_default": False,
        "description": "测试配置",
    }
    resp = client.post("/api/import/configs", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    return _envelope(resp)["data"]["id"]


class TestImportConfigRoutes:
    def test_list_configs(self, client, auth_headers):
        resp = client.get("/api/import/configs", headers=auth_headers)
        assert resp.status_code == 200
        assert "data" in _envelope(resp)

    def test_create_config(self, client, auth_headers):
        cid = _make_config(client, auth_headers)
        assert isinstance(cid, int)

    def test_create_config_201_body(self, client, auth_headers):
        payload = {"module_name": "subjects", "config_name": "校验201体", "is_active": True}
        resp = client.post("/api/import/configs", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        body = _envelope(resp)
        assert body["success"] is True
        assert body["data"]["config_name"] == "校验201体"
        assert body["data"]["module_name"] == "subjects"

    def test_create_duplicate_config(self, client, auth_headers):
        _make_config(client, auth_headers, config_name="dup_name")
        resp2 = client.post(
            "/api/import/configs",
            json={"module_name": "subjects", "config_name": "dup_name"},
            headers=auth_headers,
        )
        assert resp2.status_code == 400
        assert _envelope(resp2)["success"] is False

    def test_get_config(self, client, auth_headers):
        cid = _make_config(client, auth_headers)
        resp = client.get(f"/api/import/configs/{cid}", headers=auth_headers)
        assert resp.status_code == 200
        assert _envelope(resp)["data"]["id"] == cid

    def test_get_config_404(self, client, auth_headers):
        resp = client.get("/api/import/configs/999999", headers=auth_headers)
        assert resp.status_code == 404

    def test_update_config(self, client, auth_headers):
        cid = _make_config(client, auth_headers)
        resp = client.put(
            f"/api/import/configs/{cid}",
            json={"config_name": "改名后", "description": "更新描述"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = _envelope(resp)
        assert body["data"]["config_name"] == "改名后"
        assert body["data"]["description"] == "更新描述"

    def test_update_config_rename_conflict(self, client, auth_headers):
        _make_config(client, auth_headers, config_name="a_name")
        cid2 = _make_config(client, auth_headers, config_name="b_name")
        # 将 b_name 改名为已存在的 a_name -> 400
        resp = client.put(
            f"/api/import/configs/{cid2}",
            json={"config_name": "a_name"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_set_default(self, client, auth_headers):
        cid = _make_config(client, auth_headers)
        resp = client.post(f"/api/import/configs/set-default/{cid}", headers=auth_headers)
        assert resp.status_code == 200
        assert "默认" in _envelope(resp)["message"]
        # 验证 default 查询
        resp2 = client.get("/api/import/configs/default/subjects", headers=auth_headers)
        assert _envelope(resp2)["data"]["id"] == cid

    def test_delete_config(self, client, auth_headers):
        cid = _make_config(client, auth_headers)
        resp = client.delete(f"/api/import/configs/{cid}", headers=auth_headers)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/import/configs/{cid}", headers=auth_headers)
        assert resp2.status_code == 404

    def test_delete_default_forbidden(self, client, auth_headers):
        cid = _make_config(client, auth_headers)
        client.post(f"/api/import/configs/set-default/{cid}", headers=auth_headers)
        resp = client.delete(f"/api/import/configs/{cid}", headers=auth_headers)
        assert resp.status_code == 400
        assert "默认" in _envelope(resp)["message"]
