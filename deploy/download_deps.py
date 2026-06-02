#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import subprocess
import time
import urllib.request
import zipfile
import shutil

def print_title(text):
    print("\n" + "="*60)
    print("  " + text)
    print("="*60)

def print_step(step, total, title):
    print("\n[" + str(step) + "/" + str(total) + "] " + title)
    print("-"*40)

def print_success(message):
    print("[OK] " + message)

def print_error(message):
    print("[ERR] " + message)

def print_info(message):
    print("[INFO] " + message)

def print_warning(message):
    print("[WARN] " + message)

def run_command(cmd, cwd=None, quiet=False):
    try:
        result = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, encoding='utf-8')
        if result.returncode != 0 and not quiet:
            print("命令执行失败: " + cmd)
            if result.stderr:
                print("错误信息: " + result.stderr.strip())
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        print("执行命令时发生异常: " + str(e))
        return False, "", str(e)

def download_file(url, dest_path, show_progress=True):
    """下载文件并显示进度"""
    try:
        file_name = os.path.basename(dest_path)
        print(f"正在下载: {file_name}")
        
        def progress_hook(count, block_size, total_size):
            if show_progress and total_size > 0:
                percent = int(count * block_size * 100 / total_size)
                sys.stdout.write(f"\r下载进度: {percent}%")
                sys.stdout.flush()
        
        urllib.request.urlretrieve(url, dest_path, progress_hook)
        if show_progress:
            print("\n")
        return True
    except Exception as e:
        if show_progress:
            print("\n")
        print(f"下载失败: {str(e)}")
        return False

def extract_zip(zip_path, dest_dir):
    """解压ZIP文件"""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(dest_dir)
        print_success(f"解压完成: {os.path.basename(zip_path)}")
        return True
    except Exception as e:
        print(f"解压失败: {str(e)}")
        return False

def download_redis():
    """下载并安装Redis"""
    print_step(1, 2, "下载Redis")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    redis_dir = os.path.join(project_dir, 'redis')
    
    if os.path.exists(redis_dir) and os.listdir(redis_dir):
        if os.path.exists(os.path.join(redis_dir, 'redis-server.exe')):
            print_info("Redis已存在，跳过下载")
            return True
        else:
            print_info("Redis目录存在但不完整，重新下载...")
    
    os.makedirs(redis_dir, exist_ok=True)
    
    redis_url = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip"
    zip_path = os.path.join(redis_dir, 'redis.zip')
    
    print_info("从GitHub下载Redis...")
    if download_file(redis_url, zip_path):
        if extract_zip(zip_path, redis_dir):
            extracted_dir = os.path.join(redis_dir, 'Redis-x64-5.0.14.1')
            if os.path.exists(extracted_dir):
                for item in os.listdir(extracted_dir):
                    src = os.path.join(extracted_dir, item)
                    dst = os.path.join(redis_dir, item)
                    if os.path.exists(dst):
                        if os.path.isdir(dst):
                            shutil.rmtree(dst)
                        else:
                            os.remove(dst)
                    shutil.move(src, dst)
                shutil.rmtree(extracted_dir)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)
            
            if os.path.exists(os.path.join(redis_dir, 'redis-server.exe')):
                print_success("Redis下载并解压完成")
                return True
            else:
                print_error("Redis解压后文件不完整")
                return False
        else:
            print_error("Redis解压失败")
            return False
    else:
        print_info("GitHub下载失败，尝试使用国内镜像...")
        redis_url_cn = "https://mirror.ghproxy.com/" + redis_url
        if download_file(redis_url_cn, zip_path):
            if extract_zip(zip_path, redis_dir):
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                print_success("Redis下载并解压完成（使用国内镜像）")
                return True
            else:
                print_error("Redis解压失败")
                return False
        else:
            print_error("Redis下载失败，请手动安装")
            return False

def download_ngrok():
    """下载并安装ngrok"""
    print_step(2, 2, "下载ngrok")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ngrok_dir = os.path.join(script_dir, 'ngrok')
    
    if os.path.exists(ngrok_dir):
        if os.path.exists(os.path.join(ngrok_dir, 'ngrok.exe')):
            print_info("ngrok已存在，跳过下载")
            return True
        else:
            print_info("ngrok目录存在但不完整，重新下载...")
    
    os.makedirs(ngrok_dir, exist_ok=True)
    
    ngrok_url = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
    zip_path = os.path.join(ngrok_dir, 'ngrok.zip')
    
    print_info("从ngrok官网下载...")
    if download_file(ngrok_url, zip_path):
        if extract_zip(zip_path, ngrok_dir):
            if os.path.exists(zip_path):
                os.remove(zip_path)
            
            config_path = os.path.join(ngrok_dir, 'ngrok.yml')
            if not os.path.exists(config_path):
                with open(config_path, 'w', encoding='utf-8') as f:
                    f.write("""version: "3"
agent:
    authtoken: "3EAk45UyuWPNCwHFSlaCvgkscIY_87foeqFSS7brrcGX4kbVz"
    connect_url: connect.us.ngrok-agent.com:443
tunnels:
    frontend:
        proto: http
        addr: 3001
        host_header: "*"
        pooling_enabled: true
""")
            
            if os.path.exists(os.path.join(ngrok_dir, 'ngrok.exe')):
                print_success("ngrok下载并解压完成")
                return True
            else:
                print_error("ngrok解压后文件不完整")
                return False
        else:
            print_error("ngrok解压失败")
            return False
    else:
        print_info("官网下载失败，尝试使用国内镜像...")
        ngrok_url_cn = "https://mirror.ghproxy.com/" + ngrok_url
        if download_file(ngrok_url_cn, zip_path):
            if extract_zip(zip_path, ngrok_dir):
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                print_success("ngrok下载并解压完成（使用国内镜像）")
                return True
            else:
                print_error("ngrok解压失败")
                return False
        else:
            print_error("ngrok下载失败，请手动安装")
            return False

def main():
    print_title("下载依赖工具")
    print_info("此脚本将自动下载Redis和ngrok到项目目录")
    print_info("适用于新机器首次部署或依赖缺失时使用")
    
    success_count = 0
    
    if download_redis():
        success_count += 1
    
    if download_ngrok():
        success_count += 1
    
    print_title("下载完成")
    print_info(f"成功下载 {success_count}/2 个依赖")
    print_info(f"Redis已下载到: {os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'redis')}")
    print_info(f"ngrok已下载到: {os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ngrok')}")
    print_info("请运行一键部署脚本继续安装")

if __name__ == "__main__":
    main()