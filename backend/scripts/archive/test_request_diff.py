
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app


def test_with_flask_client():
    print("=" * 60)
    print("1. 使用Flask测试客户端")
    print("=" * 60)

    with app.test_client() as client:
        login_response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': '123456'
        })
        data = login_response.get_json()
        token = data.get('access_token')
        print(f"Token: {token[:20]}...")

        headers = {'Authorization': f'Bearer {token}'}
        response = client.get('/api/classes', headers=headers)
        print(f"状态码: {response.status_code}")

        if response.status_code == 200:
            data = response.get_json()
            print(f"班级数量: {len(data['data']['classes'])}")
            print(f"响应头: {dict(response.headers)}")


def test_with_requests():
    print("\n" + "=" * 60)
    print("2. 使用requests库")
    print("=" * 60)

    BASE_URL = 'http://127.0.0.1:5000'

    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        'username': 'admin',
        'password': '123456'
    })
    data = login_response.json()
    token = data.get('access_token')
    print(f"Token: {token[:20]}...")

    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f"{BASE_URL}/api/classes", headers=headers)
    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"班级数量: {len(data['data']['classes'])}")
        print(f"响应头: {dict(response.headers)}")


def test_health():
    print("\n" + "=" * 60)
    print("3. 测试健康检查接口")
    print("=" * 60)

    BASE_URL = 'http://127.0.0.1:5000'
    response = requests.get(f"{BASE_URL}/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.text}")

if __name__ == '__main__':
    print("启动后端服务后运行此测试...")
    test_with_requests()
    test_health()
