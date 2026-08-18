"""RBAC 路由行为测试（F17 防腐层迁移前后一致性基线 + 前序缺陷修复验证）。

契约：
- POST   /api/rbac/permissions                201 {success,message,data:{id}}；重复 code → 409
- PUT    /api/rbac/permissions/<code>         200 "权限更新成功"
- DELETE /api/rbac/permissions/<code>         200 "权限删除成功"；被角色使用 → 409
- POST   /api/rbac/roles                      201 "角色创建成功"；落库 RolePermission + 权限映射
- PUT    /api/rbac/roles/<role_code>          200 "角色更新成功"
- DELETE /api/rbac/roles/<role_code>          200 "角色删除成功"
- PUT    /api/rbac/admin-roles/<admin_id>     200 "角色分配成功"（覆盖式；修复原 admin.username NameError → 恒 500 缺陷）
- POST/DELETE /api/rbac/admin-roles/<admin_id>/<role_code>  200
- PUT    /api/rbac/role-permissions/<role_code>             200 "权限设置成功"
- POST/DELETE /api/rbac/role-permissions/<role_code>/<perm> 200

迁移核心契约：全部落库由 services/rbac_service 逐字节复刻；G2 闸门保持 68/68。
"""

from models import Permission, RolePermission, RolePermissionMapping, AdminRole


def _json(resp):
    return resp.get_json()


def test_create_update_delete_permission(client, app, auth_headers):
    with app.app_context():
        resp = client.post(
            "/api/rbac/permissions",
            json={"code": "test.perm1", "name": "测试权限", "category": "test"},
            headers=auth_headers,
        )
    assert resp.status_code == 201
    body = _json(resp)
    assert body["success"] is True
    assert isinstance(body["data"]["id"], int)

    # 重复 code → 409
    with app.app_context():
        dup = client.post(
            "/api/rbac/permissions", json={"code": "test.perm1", "name": "重复"}, headers=auth_headers
        )
    assert dup.status_code == 409

    # 更新
    with app.app_context():
        up = client.put("/api/rbac/permissions/test.perm1", json={"name": "改名"}, headers=auth_headers)
    assert up.status_code == 200
    assert "权限更新成功" in _json(up)["message"]
    with app.app_context():
        assert Permission.query.filter_by(code="test.perm1").first().name == "改名"

    # 删除
    with app.app_context():
        dele = client.delete("/api/rbac/permissions/test.perm1", headers=auth_headers)
    assert dele.status_code == 200
    assert "权限删除成功" in _json(dele)["message"]
    with app.app_context():
        assert Permission.query.filter_by(code="test.perm1").first() is None


def test_create_update_delete_role(client, app, auth_headers):
    with app.app_context():
        resp = client.post(
            "/api/rbac/roles",
            json={"role_code": "test_role_x", "role_name": "测试角色", "permissions": ["student.view"]},
            headers=auth_headers,
        )
    assert resp.status_code == 201
    assert "角色创建成功" in _json(resp)["message"]
    with app.app_context():
        rp = RolePermission.query.filter_by(role_code="test_role_x").first()
        assert rp is not None
        assert RolePermissionMapping.query.filter_by(role_code="test_role_x").count() == 1

    # 重复 → 409
    with app.app_context():
        dup = client.post("/api/rbac/roles", json={"role_code": "test_role_x"}, headers=auth_headers)
    assert dup.status_code == 409

    # 更新（覆盖式权限）
    with app.app_context():
        up = client.put(
            "/api/rbac/roles/test_role_x",
            json={"permissions": ["student.view", "score.view"]},
            headers=auth_headers,
        )
    assert up.status_code == 200
    assert "角色更新成功" in _json(up)["message"]
    with app.app_context():
        assert RolePermissionMapping.query.filter_by(role_code="test_role_x").count() == 2

    # 删除
    with app.app_context():
        dele = client.delete("/api/rbac/roles/test_role_x", headers=auth_headers)
    assert dele.status_code == 200
    assert "角色删除成功" in _json(dele)["message"]
    with app.app_context():
        assert RolePermission.query.filter_by(role_code="test_role_x").first() is None


def test_assign_roles_admin(client, app, auth_headers):
    """覆盖式分配角色（修复原 admin.username NameError → 恒 500 的缺陷路径）。"""
    with app.app_context():
        # 先建一个角色（conftest 未种 RolePermission 目录，须经 API 创建）
        client.post(
            "/api/rbac/roles",
            json={"role_code": "test_assign_role", "role_name": "分配测试", "permissions": []},
            headers=auth_headers,
        )
        resp = client.put(
            "/api/rbac/admin-roles/1", json={"role_codes": ["test_assign_role"]}, headers=auth_headers
        )
    assert resp.status_code == 200
    assert "角色分配成功" in _json(resp)["message"]
    with app.app_context():
        assert AdminRole.query.filter_by(admin_id=1, role_code="test_assign_role").first() is not None


def test_admin_role_add_remove(client, app, auth_headers):
    with app.app_context():
        client.post(
            "/api/rbac/roles",
            json={"role_code": "test_add_role", "role_name": "添加测试", "permissions": []},
            headers=auth_headers,
        )
        add = client.post("/api/rbac/admin-roles/1/test_add_role", headers=auth_headers)
    assert add.status_code == 200
    assert "角色添加成功" in _json(add)["message"]
    with app.app_context():
        assert AdminRole.query.filter_by(admin_id=1, role_code="test_add_role").first() is not None
    with app.app_context():
        rm = client.delete("/api/rbac/admin-roles/1/test_add_role", headers=auth_headers)
    assert rm.status_code == 200
    assert "角色移除成功" in _json(rm)["message"]
    with app.app_context():
        assert AdminRole.query.filter_by(admin_id=1, role_code="test_add_role").first() is None


def test_role_permission_set_add_remove(client, app, auth_headers):
    with app.app_context():
        resp = client.post(
            "/api/rbac/roles",
            json={"role_code": "test_role_y", "role_name": "测试角色2", "permissions": []},
            headers=auth_headers,
        )
    assert resp.status_code == 201

    # 覆盖式设置
    with app.app_context():
        setp = client.put(
            "/api/rbac/role-permissions/test_role_y",
            json={"permissions": ["student.view", "class.view"]},
            headers=auth_headers,
        )
    assert setp.status_code == 200
    assert "权限设置成功" in _json(setp)["message"]
    with app.app_context():
        assert RolePermissionMapping.query.filter_by(role_code="test_role_y").count() == 2

    # 单条添加（先建权限，conftest 未种 Permission 目录）
    with app.app_context():
        client.post(
            "/api/rbac/permissions",
            json={"code": "test.permX", "name": "单条权限", "category": "test"},
            headers=auth_headers,
        )
        addp = client.post("/api/rbac/role-permissions/test_role_y/test.permX", headers=auth_headers)
    assert addp.status_code == 200
    assert "权限添加成功" in _json(addp)["message"]

    # 单条移除
    with app.app_context():
        rmp = client.delete("/api/rbac/role-permissions/test_role_y/test.permX", headers=auth_headers)
    assert rmp.status_code == 200
    assert "权限移除成功" in _json(rmp)["message"]
    with app.app_context():
        assert (
            RolePermissionMapping.query.filter_by(role_code="test_role_y", permission_code="test.permX").first()
            is None
        )
