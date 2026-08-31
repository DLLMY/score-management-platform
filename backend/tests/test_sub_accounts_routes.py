"""子账号路由行为测试（F17 防腐层迁移前后一致性基线）。

契约（基于当前实现）：
- POST /api/sub-accounts/          创建：status 201，信封 {success,message:"子账号创建成功",data:{account_id}}；
                                   缺密码 → 400
- PUT  /api/sub-accounts/<id>      更新：status 200，"子账号更新成功"，字段落库
- DELETE /api/sub-accounts/<id>    删除：status 200，"子账号删除成功"，记录消失
- POST /api/sub-accounts/login     登录：正确凭证 200 + token；错误密码 401

迁移核心契约：create/update/delete 落库语义（密码哈希、updated_at、PermissionLog 审计）
必须由 services/sub_accounts_service 逐字节复刻。
"""

from models import SubAccount


def _json(resp):
    return resp.get_json()


def test_create_sub_account(client, app, auth_headers):
    payload = {
        "parent_admin_id": 1,
        "username": "sub_admin_1",
        "password": "secret123",
        "real_name": "测试子账号",
    }
    with app.app_context():
        resp = client.post("/api/sub-accounts/", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    body = _json(resp)
    assert body["success"] is True
    assert "子账号创建成功" in body["message"]
    assert isinstance(body["data"]["account_id"], int)
    with app.app_context():
        acc = SubAccount.query.get(body["data"]["account_id"])
        assert acc is not None
        assert acc.username == "sub_admin_1"
        assert acc.real_name == "测试子账号"


def test_create_requires_password(client, app, auth_headers):
    payload = {"parent_admin_id": 1, "username": "sub_admin_2"}
    with app.app_context():
        resp = client.post("/api/sub-accounts/", json=payload, headers=auth_headers)
    assert resp.status_code == 400


def test_update_sub_account(client, app, auth_headers):
    payload = {"parent_admin_id": 1, "username": "sub_admin_3", "password": "secret123"}
    with app.app_context():
        created = client.post("/api/sub-accounts/", json=payload, headers=auth_headers)
        sid = _json(created)["data"]["account_id"]
        resp = client.put(
            "/api/sub-accounts/%d" % sid,
            json={"real_name": "改名", "phone": "13800000000"},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert "子账号更新成功" in body["message"]
    with app.app_context():
        acc = SubAccount.query.get(sid)
        assert acc.real_name == "改名"
        assert acc.phone == "13800000000"


def test_delete_sub_account(client, app, auth_headers):
    payload = {"parent_admin_id": 1, "username": "sub_admin_4", "password": "secret123"}
    with app.app_context():
        created = client.post("/api/sub-accounts/", json=payload, headers=auth_headers)
        sid = _json(created)["data"]["account_id"]
        resp = client.delete("/api/sub-accounts/%d" % sid, headers=auth_headers)
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert "子账号删除成功" in body["message"]
    with app.app_context():
        assert SubAccount.query.get(sid) is None


def test_sub_account_login(client, app, auth_headers):
    payload = {"parent_admin_id": 1, "username": "sub_admin_5", "password": "secret123"}
    with app.app_context():
        client.post("/api/sub-accounts/", json=payload, headers=auth_headers)
        ok = client.post(
            "/api/sub-accounts/login", json={"username": "sub_admin_5", "password": "secret123"}
        )
        bad = client.post(
            "/api/sub-accounts/login", json={"username": "sub_admin_5", "password": "wrong"}
        )
    assert ok.status_code == 200
    assert _json(ok)["success"] is True
    assert _json(ok)["data"]["token"]
    assert bad.status_code == 401
