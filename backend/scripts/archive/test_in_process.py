
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app


def start_server():
    port = int(os.getenv('FLASK_PORT', '5000'))
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    print(f"启动服务器在 {host}:{port}...")
    app.run(host=host, port=port, debug=False, use_reloader=False)


def test_with_requests():
    time.sleep(5)

    BASE_URL = 'http://127.0.0.1:5000'

    print("\n" + "=" * 60)
    print("使用requests库测试")
    print("=" * 60)

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
        if data['data']['classes']:
            print(f"班级列表: {[c['name'] for c in data['data']['classes']]}")
        else:
            print("班级列表为空")

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == '__main__':
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    test_with_requests()
