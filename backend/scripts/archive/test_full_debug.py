sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app


def test_full_debug():
    with app.test_client() as client:
        print("=" * 60)
        print("完整调试测试")
        print("=" * 60)

        print("\n1. 登录测试")
        login_response = client.post(
            "/api/auth/login", json={"username": "admin", "password": "123456"}
        )
        print(f"登录状态码: {login_response.status_code}")

        if login_response.status_code == 200:
            data = login_response.get_json()
            token = data.get("access_token")
            print(f"Token: {token[:30]}...")

            print("\n2. 测试 /api/classes 接口")
            headers = {"Authorization": f"Bearer {token}"}
            response = client.get("/api/classes", headers=headers)
            print(f"状态码: {response.status_code}")

            if response.status_code == 200:
                data = response.get_json()
                print(f"完整响应: {data}")

        print("\n" + "=" * 60)
        print("测试完成")
        print("=" * 60)


if __name__ == "__main__":
    test_full_debug()
