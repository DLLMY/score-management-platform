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

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NGROK_DIR = os.path.join(SCRIPT_DIR, 'ngrok')
NGROK_LOCAL_PATH = os.path.join(NGROK_DIR, 'ngrok.exe')
NGROK_LOCAL_PATH_ALT = os.path.join(NGROK_DIR, 'ngrok-v3-stable-windows-amd64', 'ngrok.exe')

def print_title(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️ {message}")

def print_warning(message):
    print(f"⚠️ {message}")

def find_ngrok():
    """查找ngrok可执行文件"""
    # 优先使用本地ngrok
    if os.path.exists(NGROK_LOCAL_PATH):
        return NGROK_LOCAL_PATH
    
    if os.path.exists(NGROK_LOCAL_PATH_ALT):
        return NGROK_LOCAL_PATH_ALT
    
    # 检查系统PATH
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

def check_ngrok_auth(ngrok_path):
    """检查ngrok是否已认证"""
    try:
        result = subprocess.run(
            f'"{ngrok_path}" config check',
            shell=True,
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except:
        return False

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
                    'config': tunnel.get('config', {})
                })
            return tunnels
    except:
        pass
    return []

def start_ngrok(ngrok_path, port, region='cn', ngrok_port=4040):
    """启动ngrok隧道"""
    ngrok_cmd = f'"{ngrok_path}" http {port} --region={region}'
    
    print_info(f"正在启动ngrok隧道 (端口 {port}, 区域 {region})...")
    
    process = subprocess.Popen(
        f'start "Ngrok - 端口{port}" cmd /k "{ngrok_cmd}"',
        shell=True
    )
    
    time.sleep(3)
    
    tunnels = get_ngrok_tunnels(ngrok_port)
    if tunnels:
        print_success("ngrok隧道启动成功！")
        for tunnel in tunnels:
            print(f"  🌐 公网地址: {tunnel['public_url']}")
        return True
    else:
        print_warning("ngrok隧道可能正在启动中，请稍后查看")
        print_info(f"ngrok管理界面: http://127.0.0.1:{ngrok_port}")
        return True

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
        '--region',
        type=str,
        default='cn',
        choices=['cn', 'us', 'eu', 'au', 'ap', 'in', 'jp', 'sa'],
        help='ngrok区域 (默认: cn)'
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
    
    args = parser.parse_args()
    
    print_title("Ngrok 外网穿透启动工具")
    
    # 查找ngrok
    print("\n检查ngrok环境...")
    ngrok_path = find_ngrok()
    
    if not ngrok_path:
        print_error("ngrok未安装！")
        print_info("下载地址: https://ngrok.com/download")
        print_info("或放置到: deploy/ngrok/ngrok-v3-stable-windows-amd64/ngrok.exe")
        print_info("安装后请运行: ngrok config add-authtoken <your-token>")
        input("\n按Enter退出...")
        sys.exit(1)
    
    print_success(f"ngrok已找到: {ngrok_path}")
    
    # 检查认证
    if not check_ngrok_auth(ngrok_path):
        print_error("ngrok未认证！")
        print_info("请先运行: ngrok config add-authtoken <your-token>")
        print_info("获取token: https://dashboard.ngrok.com/get-started/your-authtoken")
        input("\n按Enter退出...")
        sys.exit(1)
    
    print_success("ngrok已认证")
    
    # 启动ngrok隧道
    print(f"\n区域设置: {args.region}")
    
    if args.backend_only:
        print_title(f"启动后端ngrok隧道 (端口 {args.backend_port})")
        start_ngrok(ngrok_path, args.backend_port, args.region, 4040)
    elif args.frontend_only:
        print_title(f"启动前端ngrok隧道 (端口 {args.frontend_port})")
        start_ngrok(ngrok_path, args.frontend_port, args.region, 4041)
    else:
        # 启动后端ngrok
        print_title(f"启动后端ngrok隧道 (端口 {args.backend_port})")
        start_ngrok(ngrok_path, args.backend_port, args.region, 4040)
        
        time.sleep(2)
        
        # 启动前端ngrok
        print_title(f"启动前端ngrok隧道 (端口 {args.frontend_port})")
        start_ngrok(ngrok_path, args.frontend_port, args.region, 4041)
    
    # 显示结果
    print_title("外网访问信息")
    
    print("\n后端API外网地址:")
    print(f"  ngrok管理界面: http://127.0.0.1:4040")
    
    if not args.backend_only:
        print("\n前端应用外网地址:")
        print(f"  ngrok管理界面: http://127.0.0.1:4041")
    
    print("\n" + "="*60)
    print("注意事项:")
    print("  • ngrok免费版每次启动会生成随机外网地址")
    print("  • 请在ngrok管理界面查看实际的公网URL")
    print("  • 如需固定域名，请升级ngrok付费版")
    print("="*60)
    
    print("\n按Enter退出此窗口（ngrok将继续运行）...")
    input()

if __name__ == '__main__':
    main()
