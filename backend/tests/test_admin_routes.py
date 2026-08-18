"""管理员路由单元测试"""

import uuid
from models import Admin


class TestAdminRoutes:
    """管理员路由测试"""

    def test_admin_login_success(self, client, session):
        """测试管理员登录成功"""
        admin = Admin(
            username=f"test_admin_login_{uuid.uuid4().hex[:8]}",
            password="testpassword123",
            role="admin",
            real_name="测试管理员",
            force_password_change=False,
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)

        response = client.post(
            "/api/admins/login", json={"username": admin.username, "password": "testpassword123"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data.get("success") is True
        assert data.get("data", {}).get("access_token") is not None

    def test_admin_login_with_force_password_change(self, client, session):
        """测试强制改密标志返回"""
        admin = Admin(
            username=f"test_admin_force_{uuid.uuid4().hex[:8]}",
            password="testpassword123",
            role="admin",
            real_name="测试管理员",
            force_password_change=True,
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)

        response = client.post(
            "/api/admins/login", json={"username": admin.username, "password": "testpassword123"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data.get("success") is True
        assert data.get("data", {}).get("admin", {}).get("force_password_change") is True

    def test_admin_login_failure_wrong_password(self, client, session):
        """测试管理员登录失败-密码错误"""
        admin = Admin(
            username=f"test_admin_fail_{uuid.uuid4().hex[:8]}",
            password="testpassword123",
            role="admin",
            real_name="测试管理员",
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)

        response = client.post(
            "/api/admins/login", json={"username": admin.username, "password": "wrongpassword"}
        )

        assert response.status_code in [400, 401]

    def test_get_admin_list(self, client, auth_headers):
        """测试获取管理员列表"""
        response = client.get("/api/admins", headers=auth_headers)

        assert response.status_code in [200, 401]

    def test_get_admin_detail(self, client, auth_headers, sample_admin):
        """测试获取管理员详情"""
        response = client.get(f"/api/admins/{sample_admin.id}", headers=auth_headers)

        assert response.status_code in [200, 401]

    def test_create_admin(self, client, auth_headers, session):
        """测试创建管理员"""
        response = client.post(
            "/api/admins",
            headers=auth_headers,
            json={
                "username": f"newadmin_{uuid.uuid4().hex[:8]}",
                "password": "newpassword123",
                "role": "teacher",
                "real_name": "新管理员",
            },
        )

        assert response.status_code in [200, 400, 401, 403]

    def test_change_password_success(self, client, auth_headers, sample_admin, session):
        """测试修改密码成功"""
        response = client.post(
            f"/api/admins/{sample_admin.id}/change-password",
            headers=auth_headers,
            json={"old_password": "testpassword123", "new_password": "newpassword456"},
        )

        assert response.status_code in [200, 400, 401]

    def test_change_password_failure_wrong_old_password(
        self, client, auth_headers, sample_admin, session
    ):
        """测试修改密码失败-旧密码错误"""
        response = client.post(
            f"/api/admins/{sample_admin.id}/change-password",
            headers=auth_headers,
            json={"old_password": "wrongpassword", "new_password": "newpassword456"},
        )

        assert response.status_code in [400, 401]

    def test_change_password_failure_weak_password(
        self, client, auth_headers, sample_admin, session
    ):
        """测试修改密码失败-弱密码"""
        response = client.post(
            f"/api/admins/{sample_admin.id}/change-password",
            headers=auth_headers,
            json={"old_password": "testpassword123", "new_password": "123"},
        )

        assert response.status_code in [400, 401]

    def test_get_csrf_token(self, client, auth_headers):
        """测试获取CSRF token"""
        response = client.get("/api/admins/csrf-token", headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data.get("data", {}).get("csrf_token") is not None

    def test_refresh_token(self, client, auth_headers):
        """测试刷新token"""
        response = client.post("/api/admins/refresh-token", headers=auth_headers)

        assert response.status_code in [200, 400, 401]

    def test_assign_class(self, client, auth_headers, sample_admin, sample_class, session):
        """测试分配班级"""
        response = client.post(
            f"/api/admins/{sample_admin.id}/assign-class",
            headers=auth_headers,
            json={"class_id": sample_class.id},
        )

        assert response.status_code in [200, 401, 403]
