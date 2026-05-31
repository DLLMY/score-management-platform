#!/usr/bin/env python3
import urllib.request
import json

def stop_all_ngrok_tunnels():
    try:
        with urllib.request.urlopen('http://localhost:4040/api/tunnels', timeout=3) as response:
            data = json.loads(response.read())
            tunnels = data.get('tunnels', [])

            for tunnel in tunnels:
                tunnel_url = tunnel.get('public_url')
                tunnel_name = tunnel.get('name')
                print(f"停止隧道: {tunnel_name} ({tunnel_url})")

                # 发送 DELETE 请求停止隧道
                delete_url = f"http://localhost:4040/api/tunnels/{tunnel_name}"
                req = urllib.request.Request(delete_url, method='DELETE')
                try:
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        print(f"  ✓ 已停止")
                except Exception as e:
                    print(f"  ✗ 停止失败: {e}")

            print("\n所有隧道已停止")
    except Exception as e:
        print(f"获取隧道列表失败: {e}")
        print("ngrok 可能未运行或无法访问 API")

if __name__ == '__main__':
    stop_all_ngrok_tunnels()