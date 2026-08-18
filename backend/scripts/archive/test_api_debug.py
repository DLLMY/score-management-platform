BASE_URL = "http://127.0.0.1:5000"


def test_login_and_debug():
    print("\n" + "=" * 60)
    print("测试登录和调试")
    print("=" * 60)

    response = requests.post(
        f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "123456"}, timeout=10
    )

    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        print(f"获取Token成功: {token[:20]}...")

        print("\n" + "=" * 60)
        print("测试 /api/classes 接口 - 带详细调试")
        print("=" * 60)

        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/classes", headers=headers, timeout=10)

        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")

        if response.status_code == 200:
            data = response.json()
            print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
        else:
            print(f"失败: {response.text}")

        print("\n" + "=" * 60)
        print("测试 /api/rbac/admin-roles/1 接口")
        print("=" * 60)

        response = requests.get(f"{BASE_URL}/api/rbac/admin-roles/1", headers=headers, timeout=10)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
        else:
            print(f"失败: {response.text}")

    else:
        print(f"登录失败: {response.text}")


if __name__ == "__main__":
    test_login_and_debug()
