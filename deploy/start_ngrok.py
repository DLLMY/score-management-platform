#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ngrok外网穿透启动脚本
用于在本地开发环境启动ngrok代理，实现外网访问
"""

import os
import sys
import subprocess
import time
import requests
import argparse
import webbrowser

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
NGROK_DIR = os.path.join(SCRIPT_DIR, 'ngrok')
NGROK_LOCAL_PATH = os.path.join(NGROK_DIR, 'ngrok.exe')
NGROK_LOCAL_PATH_ALT = os.path.join(NGROK_DIR, 'ngrok-v3-stable-windows-amd64', 'ngrok.exe')
NGROK_CONFIG_PATH = os.path.join(NGROK_DIR, 'ngrok.yml')

NGROK_DASHBOARD_URL = "https://dashboard.ngrok.com/tunnels/agents"
NGROK_API_URL = "http://127.0.0.1:4040"

def print_title(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")

def print_success(message):
    print(f"[OK] {message}")

def print_error(message):
    print(f"[ERROR] {message}")

def print_info(message):
    print(f"[INFO] {message}")

def print_warning(message):
    print(f"[WARN] {message}")

def find_ngrok():
    """查找ngrok可执行文件"""
    if os.path.exists(NGROK_LOCAL_PATH):
        return NGROK_LOCAL_PATH
    
    if os.path.exists(NGROK_LOCAL_PATH_ALT):
        return NGROK_LOCAL_PATH_ALT
    
    try:
        result = subprocess.run(
            'where ngrok',
            shell=True,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.strip().split('\n')[0]
    except:
        pass
    
    return None

def get_ngrok_tunnels(port=4040):
    """获取ngrok隧道信息"""
    try:
        response = requests.get(f'http://127.0.0.1:{port}/api/tunnels', timeout=2)
        if response.status_code == 200:
            data = response.json()
            tunnels = []
            for tunnel in data.get('tunnels', []):
                tunnels.append({
                    'name': tunnel.get('name'),
                    'public_url': tunnel.get('public_url'),
                    'proto': tunnel.get('proto'),
                })
            return tunnels
    except:
        pass
    return []

def check_ngrok_status():
    """检查ngrok是否正在运行"""
    try:
        response = requests.get(f'{NGROK_API_URL}/api/tunnels', timeout=2)
        if response.status_code == 200:
            return True
    except:
        pass
    return False

def start_ngrok_with_config(ngrok_path):
    """使用配置文件启动ngrok隧道"""
    if not os.path.exists(NGROK_CONFIG_PATH):
        print_error(f"配置文件不存在: {NGROK_CONFIG_PATH}")
        return False
    
    print_info("使用配置文件启动ngrok隧道...")
    print_info(f"配置文件: {NGROK_CONFIG_PATH}")
    
    ngrok_cmd = f'"{ngrok_path}" start --config "{NGROK_CONFIG_PATH}" --all'
    
    process = subprocess.Popen(
        ngrok_cmd,
        shell=True,
        cwd=NGROK_DIR
    )
    
    time.sleep(5)
    
    tunnels = get_ngrok_tunnels(4040)
    if tunnels:
        print_success("ngrok隧道启动成功！")
        for tunnel in tunnels:
            print(f"  [{tunnel['name']}] {tunnel['public_url']}")
        return True
    else:
        print_warning("ngrok隧道可能正在启动中...")
        print_info(f"ngrok管理界面: {NGROK_API_URL}")
        return True

def start_ngrok_single(ngrok_path, port, ngrok_port=4040):
    """启动单个ngrok隧道"""
    print_info(f"启动ngrok隧道 (端口 {port})...")
    
    ngrok_cmd = f'"{ngrok_path}" http {port}'
    
    process = subprocess.Popen(
        ngrok_cmd,
        shell=True,
        cwd=NGROK_DIR
    )
    
    time.sleep(5)
    
    tunnels = get_ngrok_tunnels(ngrok_port)
    if tunnels:
        print_success("ngrok隧道启动成功！")
        for tunnel in tunnels:
            print(f"  公网地址: {tunnel['public_url']}")
        return True
    else:
        print_warning("ngrok隧道可能正在启动中...")
        print_info(f"ngrok管理界面: http://127.0.0.1:{ngrok_port}")
        return True

def open_dashboard():
    """打开ngrok仪表板"""
    print_info("正在打开ngrok仪表板...")
    webbrowser.open(NGROK_DASHBOARD_URL)

def main():
    parser = argparse.ArgumentParser(description='Ngrok外网穿透启动脚本')
    parser.add_argument(
        '--backend-port',
        type=int,
        default=5000,
        help='后端服务端口 (默认: 5000)'
    )
    parser.add_argument(
        '--frontend-port',
        type=int,
        default=3000,
        help='前端服务端口 (默认: 3000)'
    )
    parser.add_argument(
        '--backend-only',
        action='store_true',
        help='仅启动后端ngrok隧道'
    )
    parser.add_argument(
        '--frontend-only',
        action='store_true',
        help='仅启动前端ngrok隧道'
    )
    parser.add_argument(
        '--use-config',
        action='store_true',
        default=True,
        help='使用配置文件启动 (默认: True)'
    )
    parser.add_argument(
        '--no-config',
        action='store_true',
        help='不使用配置文件，直接启动'
    )
    parser.add_argument(
        '--open-dashboard',
        action='store_true',
        help='打开ngrok仪表板'
    )
    
    args = parser.parse_args()
    
    print_title("Ngrok 外网穿透启动工具")
    
    if args.open_dashboard:
        open_dashboard()
        return
    
    print("\n检查ngrok环境...")
    ngrok_path = find_ngrok()
    
    if not ngrok_path:
        print_error("ngrok未安装！")
        print_info("下载地址: https://ngrok.com/download")
        print_info("或放置到: deploy/ngrok/ngrok.exe")
        input("\n按Enter退出...")
        sys.exit(1)
    
    print_success(f"ngrok已找到: {ngrok_path}")
    
    if check_ngrok_status():
        print_success("ngrok已在运行中！")
        tunnels = get_ngrok_tunnels()
        if tunnels:
            print("\n当前隧道:")
            for tunnel in tunnels:
                print(f"  [{tunnel['name']}] {tunnel['public_url']}")
        print_info(f"管理界面: {NGROK_API_URL}")
        return
    
    use_config = args.use_config and not args.no_config
    
    if use_config and os.path.exists(NGROK_CONFIG_PATH):
        print_success(f"配置文件: {NGROK_CONFIG_PATH}")
        start_ngrok_with_config(ngrok_path)
    else:
        if args.backend_only:
            start_ngrok_single(ngrok_path, args.backend_port, 4040)
        elif args.frontend_only:
            start_ngrok_single(ngrok_path, args.frontend_port, 4040)
        else:
            print_info("启动后端ngrok隧道...")
            start_ngrok_single(ngrok_path, args.backend_port, 4040)
    
    print_title("外网访问信息")
    print(f"\nngrok管理界面: {NGROK_API_URL}")
    print("\n注意事项:")
    print("  - ngrok免费版每次启动会生成随机外网地址")
    print("  - 请在ngrok管理界面查看实际的公网URL")
    print("  - 如果端点已在线，请先在仪表板停止现有端点")
    print("="*60)
    
    print("\n按Enter退出此窗口（ngrok将继续运行）...")
    input()

if __name__ == '__main__':
    main()
