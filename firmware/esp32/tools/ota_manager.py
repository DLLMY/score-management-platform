#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PhoneBox OTA 固件管理工具
=========================
功能：
  upload    - 上传固件到 GitHub Release 并获取公网直链
  send      - 通过 MQTT 向设备下发 OTA 升级指令
  monitor   - 监听 MQTT 实时查看 OTA 升级进度
  full      - 一键执行：上传 + 下发 + 监控

使用前提：
  pip install paho-mqtt requests
  设置环境变量 GITHUB_TOKEN (在 https://github.com/settings/tokens 生成)
"""

import os
import sys
import time
import json
import argparse
from datetime import datetime

# ============================================================
# 配置区（根据实际情况修改）
# ============================================================

# GitHub 仓库信息
GITHUB_OWNER = "YOUR_GITHUB_USERNAME"      # 你的 GitHub 用户名
GITHUB_REPO  = "YOUR_REPO_NAME"            # 仓库名
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")  # Personal Access Token

# MQTT 服务器配置（与 ESP32 配置保持一致）
MQTT_SERVER   = "nc5233fc.ala.cn-hangzhou.emqxsl.cn"
MQTT_PORT     = 8883
MQTT_USERNAME = "phoneboxtest"
MQTT_PASSWORD = "123456"
MQTT_USE_SSL  = True

# MQTT 主题（与 ESP32 代码保持一致）
TOPIC_OTA        = "phonebox/ota"
TOPIC_OTA_STATUS = "phonebox/ota/status"

# 固件文件路径（默认：firmware 目录下的最新固件）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ESP32_DIR = os.path.join(SCRIPT_DIR, "..")
FIRMWARE_DIR = os.path.join(ESP32_DIR, "firmware")

# 自动查找 firmware 目录下的最新 .bin 文件
def _find_firmware():
    """扫描 firmware/ 目录，返回最新的 .bin 固件路径"""
    if os.path.isdir(FIRMWARE_DIR):
        bins = sorted(
            [f for f in os.listdir(FIRMWARE_DIR) if f.endswith(".bin")],
            key=lambda f: os.path.getmtime(os.path.join(FIRMWARE_DIR, f)),
            reverse=True
        )
        if bins:
            return os.path.join(FIRMWARE_DIR, bins[0])
    # 回退到 Arduino build 目录
    fallback = os.path.join(ESP32_DIR, "phonebox", "build", "phonebox.ino.bin")
    return fallback if os.path.exists(fallback) else None

DEFAULT_FIRMWARE_PATH = _find_firmware()

# ============================================================
# 核心功能
# ============================================================

def check_dependencies():
    """检查 Python 依赖是否安装"""
    missing = []
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        missing.append("paho-mqtt")
    try:
        import requests
    except ImportError:
        missing.append("requests")
    
    if missing:
        print(f"缺少依赖: {', '.join(missing)}")
        print(f"请运行: pip install {' '.join(missing)}")
        sys.exit(1)


def get_firmware_info(firmware_path):
    """从固件文件名解析版本信息"""
    if os.path.basename(firmware_path) == "phonebox.ino.bin":
        # 尝试从源码文件读取版本号
        source_path = os.path.join(
            ESP32_DIR, "phonebox", "phonebox.ino"
        )
        if os.path.exists(source_path):
            with open(source_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if 'FIRMWARE_VERSION' in line and '"' in line:
                        # 提取版本号
                        import re
                        match = re.search(r'FIRMWARE_VERSION\s+"([^"]+)"', line)
                        if match:
                            return match.group(1)
    
    # 从文件名提取时间戳
    mtime = os.path.getmtime(firmware_path)
    return datetime.fromtimestamp(mtime).strftime("v%Y%m%d-%H%M")


def upload_to_github(firmware_path, version=None):
    """上传固件到 GitHub Release
    
    步骤：
    1. 创建或获取 GitHub Release
    2. 上传 .bin 文件作为 release asset
    3. 返回公网直链
    """
    import requests
    
    if not GITHUB_TOKEN or GITHUB_TOKEN == "":
        print("=" * 50)
        print("错误: 未设置 GITHUB_TOKEN 环境变量")
        print("=" * 50)
        print("\n请按以下步骤操作:")
        print("1. 访问 https://github.com/settings/tokens")
        print("2. 点击 'Generate new token (classic)'")
        print("3. 勾选 'repo' 权限")
        print("4. 生成后，在终端执行:")
        print('   set GITHUB_TOKEN=你的token  (Windows CMD)')
        print('   $env:GITHUB_TOKEN="你的token"  (PowerShell)')
        print("\n或直接在此脚本中设置 GITHUB_TOKEN 变量")
        sys.exit(1)
    
    if not os.path.exists(firmware_path):
        print(f"错误: 固件文件不存在: {firmware_path}")
        sys.exit(1)
    
    if version is None:
        version = get_firmware_info(firmware_path)
    
    file_size = os.path.getsize(firmware_path)
    file_name = os.path.basename(firmware_path)
    
    print(f"固件文件: {firmware_path}")
    print(f"文件大小: {file_size:,} 字节 ({file_size/1024:.1f} KB)")
    print(f"发布版本: {version}")
    print()
    
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    api_base = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}"
    
    # 1. 创建 Release
    print("正在创建 GitHub Release...")
    release_data = {
        "tag_name": version,
        "name": f"固件 {version}",
        "body": f"PhoneBox ESP32 固件自动发布\n\n"
                f"- 版本: {version}\n"
                f"- 大小: {file_size/1024:.1f} KB\n"
                f"- 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "draft": False,
        "prerelease": False
    }
    
    resp = requests.post(f"{api_base}/releases", headers=headers, json=release_data)
    
    if resp.status_code == 422 and "already_exists" in resp.text:
        print(f"  Release {version} 已存在，尝试获取已有 Release...")
        resp = requests.get(f"{api_base}/releases/tags/{version}", headers=headers)
        if resp.status_code != 200:
            print(f"  获取 Release 失败: {resp.status_code} {resp.text}")
            sys.exit(1)
    
    if resp.status_code not in [200, 201]:
        print(f"  创建 Release 失败: {resp.status_code}")
        print(resp.text)
        sys.exit(1)
    
    release = resp.json()
    release_id = release["id"]
    upload_url = release["upload_url"].replace("{?name,label}", "")
    html_url = release["html_url"]
    
    print(f"  Release 页面: {html_url}")
    
    # 2. 上传固件文件
    print(f"正在上传固件文件 '{file_name}' ...")
    upload_headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Content-Type": "application/octet-stream"
    }
    
    with open(firmware_path, 'rb') as f:
        upload_resp = requests.post(
            f"{upload_url}?name={file_name}",
            headers=upload_headers,
            data=f
        )
    
    if upload_resp.status_code != 201:
        print(f"  上传失败: {upload_resp.status_code}")
        # 可能是文件已存在，尝试查找已有 asset
        get_resp = requests.get(
            f"{api_base}/releases/{release_id}/assets", headers=headers
        )
        if get_resp.status_code == 200:
            assets = get_resp.json()
            for asset in assets:
                if asset["name"] == file_name:
                    direct_url = asset["browser_download_url"]
                    print(f"  文件已存在，使用已有直链")
                    break
            else:
                print("  找不到已有 asset")
                sys.exit(1)
        else:
            sys.exit(1)
    else:
        asset = upload_resp.json()
        direct_url = asset["browser_download_url"]
    
    print()
    print("=" * 50)
    print("上传成功！")
    print("=" * 50)
    print(f"GitHub Releases: {html_url}")
    print(f"固件直链:        {direct_url}")
    print()
    
    return direct_url


def send_ota_command(direct_url, device_id="phonebox_001"):
    """通过 MQTT 向设备发送 OTA 升级指令"""
    import paho.mqtt.client as mqtt_client
    
    ota_payload = json.dumps({
        "action": "update",
        "url": direct_url,
        "version": "latest",
        "timestamp": int(time.time())
    })
    
    print(f"目标设备:   {device_id}")
    print(f"MQTT服务器: {MQTT_SERVER}:{MQTT_PORT}")
    print(f"OTA指令:    {ota_payload}")
    print()
    
    client = mqtt_client.Client(client_id=f"ota_sender_{int(time.time())}")
    
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    if MQTT_USE_SSL:
        client.tls_set()
        client.tls_insecure_set(True)
    
    result = {"published": False, "error": None}
    
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print("MQTT 已连接")
            client.publish(TOPIC_OTA, ota_payload)
            print(f"OTA指令已发送 → {TOPIC_OTA}")
            result["published"] = True
            time.sleep(1)
            client.disconnect()
        else:
            result["error"] = f"连接失败，返回码: {rc}"
    
    client.on_connect = on_connect
    
    try:
        client.connect(MQTT_SERVER, MQTT_PORT, keepalive=10)
        client.loop_start()
        
        # 等待最多 10 秒
        for _ in range(20):
            if result["published"] or result["error"]:
                break
            time.sleep(0.5)
        
        client.loop_stop()
        client.disconnect()
        
        if result["error"]:
            print(f"错误: {result['error']}")
            sys.exit(1)
            
    except Exception as e:
        print(f"MQTT 连接异常: {e}")
        sys.exit(1)
    
    print()
    print("=" * 50)
    print("OTA 指令已下发！设备将自动下载并升级")
    print("=" * 50)


def monitor_ota_progress(duration=180):
    """监听 MQTT 主题，实时查看设备 OTA 升级进度"""
    import paho.mqtt.client as mqtt_client
    
    print(f"开始监控 OTA 升级进度...")
    print(f"监听主题: {TOPIC_OTA_STATUS}")
    print(f"监控时长: {duration} 秒")
    print(f"按 Ctrl+C 停止监控")
    print("-" * 50)
    
    client = mqtt_client.Client(client_id=f"ota_monitor_{int(time.time())}")
    
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    if MQTT_USE_SSL:
        client.tls_set()
        client.tls_insecure_set(True)
    
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            client.subscribe(TOPIC_OTA_STATUS)
            print("已连接到 MQTT 服务器")
    
    def on_message(client, userdata, msg):
        try:
            data = json.loads(msg.payload.decode())
            status = data.get("status", "unknown")
            progress = data.get("progress", -1)
            device = data.get("device_id", "unknown")
            version = data.get("from_version", "?")
            
            icon = {"started": "🚀", "downloading": "⬇️", "updating": "⚙️",
                    "success": "✅", "failed": "❌", "command_received": "📩",
                    "invalid_command": "⚠️", "parse_error": "⚠️"}.get(status, "ℹ️")
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            if progress >= 0:
                bar_len = 30
                filled = int(bar_len * progress / 100)
                bar = "█" * filled + "░" * (bar_len - filled)
                print(f"[{timestamp}] {icon} 设备:{device} {status:20s} [{bar}] {progress}%")
            else:
                print(f"[{timestamp}] {icon} 设备:{device} v{version} → {status}")
            
            if status == "success":
                print("\n" + "=" * 50)
                print("🎉 OTA 升级完成！设备将自动重启")
                print("=" * 50)
            
        except json.JSONDecodeError:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 收到: {msg.payload.decode()}")
    
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(MQTT_SERVER, MQTT_PORT, keepalive=60)
        client.loop_start()
        time.sleep(duration)
    except KeyboardInterrupt:
        print("\n监控已停止")
    except Exception as e:
        print(f"MQTT 异常: {e}")
    finally:
        client.loop_stop()
        client.disconnect()


def cmd_upload(args):
    """上传固件到 GitHub"""
    upload_to_github(args.firmware, args.version)


def cmd_send(args):
    """发送 OTA 指令"""
    send_ota_command(args.url, args.device)


def cmd_monitor(args):
    """监控升级进度"""
    monitor_ota_progress(args.duration)


def cmd_full(args):
    """一键完成：上传 + 下发 + 监控"""
    print("╔══════════════════════════════════════╗")
    print("║   PhoneBox OTA 一键升级工具          ║")
    print("╚══════════════════════════════════════╝")
    print()
    
    # 1. 上传
    print("[步骤 1/3] 上传固件到 GitHub Release")
    print("-" * 50)
    direct_url = upload_to_github(args.firmware, args.version)
    
    # 2. 下发
    print("\n[步骤 2/3] 通过 MQTT 下发升级指令")
    print("-" * 50)
    send_ota_command(direct_url, args.device)
    
    # 3. 监控
    print("\n[步骤 3/3] 监控升级进度")
    print("-" * 50)
    monitor_ota_progress(args.duration)


def main():
    check_dependencies()
    
    parser = argparse.ArgumentParser(
        description="PhoneBox ESP32 OTA 固件管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 编译后复制固件到 firmware 目录
  # copy ../phonebox/build/phonebox.ino.bin ../firmware/phonebox_v2.6.bin

  # 上传固件到 GitHub
  python ota_manager.py upload --firmware ../firmware/phonebox_v2.6.bin
  
  # 通过 MQTT 下发 OTA 指令 (从 GitHub 直链)
  python ota_manager.py send --url "https://github.com/USER/REPO/releases/download/v1.0/phonebox_v2.6.bin"
  
  # 监控升级进度
  python ota_manager.py monitor
  
  # 一键执行（上传 + 下发 + 监控，自动找 firmware 目录最新固件）
  python ota_manager.py full
  
环境变量:
  GITHUB_TOKEN    GitHub Personal Access Token (需 repo 权限)
  MQTT_SERVER     MQTT 服务器地址 (可选，脚本内已预设)
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    # upload 子命令
    p_upload = subparsers.add_parser("upload", help="上传固件到 GitHub Release")
    p_upload.add_argument("--firmware", default=DEFAULT_FIRMWARE_PATH,
                          help="固件 .bin 文件路径")
    p_upload.add_argument("--version", help="版本号 (如 v2.6)")
    
    # send 子命令
    p_send = subparsers.add_parser("send", help="发送 OTA 升级指令")
    p_send.add_argument("--url", required=True, help="固件下载直链")
    p_send.add_argument("--device", default="phonebox_001", help="目标设备ID")
    
    # monitor 子命令
    p_monitor = subparsers.add_parser("monitor", help="监控 OTA 升级进度")
    p_monitor.add_argument("--duration", type=int, default=300,
                           help="监控时长（秒），默认 300 秒")
    
    # full 子命令
    p_full = subparsers.add_parser("full", help="一键执行上传+下发+监控")
    p_full.add_argument("--firmware", default=DEFAULT_FIRMWARE_PATH,
                        help="固件 .bin 文件路径")
    p_full.add_argument("--version", help="版本号")
    p_full.add_argument("--device", default="phonebox_001", help="目标设备ID")
    p_full.add_argument("--duration", type=int, default=300,
                        help="监控时长（秒）")
    
    args = parser.parse_args()
    
    if args.command == "upload":
        cmd_upload(args)
    elif args.command == "send":
        cmd_send(args)
    elif args.command == "monitor":
        cmd_monitor(args)
    elif args.command == "full":
        cmd_full(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
