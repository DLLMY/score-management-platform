#!/usr/bin/env python3
import urllib.request
import json

try:
    with urllib.request.urlopen('http://localhost:4040/api/tunnels', timeout=3) as response:
        data = json.loads(response.read())
        print("="*50)
        print("Ngrok 内网穿透状态")
        print("="*50)
        for tunnel in data.get('tunnels', []):
            print(f"公网地址: {tunnel.get('public_url')}")
            print(f"隧道名称: {tunnel.get('name')}")
            print("-"*50)
        print(f"本地前端: http://localhost:3000")
        print(f"本地后端: http://localhost:5000")
        print(f"Ngrok管理: http://localhost:4040")
        print("="*50)
except Exception as e:
    print(f"获取Ngrok状态失败: {e}")