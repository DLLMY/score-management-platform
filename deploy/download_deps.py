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

def download_file(url, dest_path):
    """下载文件"""
    try:
        print("正在下载: " + os.path.basename(dest_path))
        urllib.request.urlretrieve(url, dest_path)
        return True
    except Exception as e:
        print("下载失败: " + str(e))
        return False

def extract_zip(zip_path, dest_dir):
    """解压ZIP文件"""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(dest_dir)
        print_success("解压完成: " + os.path.basename(zip_path))
        return True
    except Exception as e:
        print("解压失败: " + str(e))
        return False

def download_redis():
    """下载并安装Redis"""
    print_step(1, 2, "下载Redis")
    
    # 检查是否已安装
    redis_dir = os.path.join(os.path.dirname(__file__), '..', 'redis')
    if os.path.exists(redis_dir) and os.listdir(redis_dir):
        print_info("Redis已存在，跳过下载")
        return True
    
    # 创建Redis目录
    os.makedirs(redis_dir, exist_ok=True)
    
    # Windows版本Redis下载
    redis_url = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip"
    zip_path = os.path.join(redis_dir, 'redis.zip')
    
    print_info("从GitHub下载Redis...")
    if download_file(redis_url, zip_path):
        extract_zip(zip_path, redis_dir)
        
        # 移动文件到正确位置
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
        
        # 删除ZIP文件
        os.remove(zip_path)
        
        print_success("Redis下载并解压完成")
        return True
    else:
        print_info("GitHub下载失败，尝试使用国内镜像...")
        redis_url_cn = "https://mirror.ghproxy.com/" + redis_url
        if download_file(redis_url_cn, zip_path):
            extract_zip(zip_path, redis_dir)
            os.remove(zip_path)
            print_success("Redis下载并解压完成（使用国内镜像）")
            return True
        else:
            print_error("Redis下载失败，请手动安装")
            return False

def download_ngrok():
    """下载并安装ngrok"""
    print_step(2, 2, "下载ngrok")
    
    # 检查是否已安装
    ngrok_dir = os.path.join(os.path.dirname(__file__), 'ngrok')
    if os.path.exists(ngrok_dir) and os.listdir(ngrok_dir):
        print_info("ngrok已存在，跳过下载")
        return True
    
    # 创建ngrok目录
    os.makedirs(ngrok_dir, exist_ok=True)
    
    # ngrok下载
    ngrok_url = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
    zip_path = os.path.join(ngrok_dir, 'ngrok.zip')
    
    print_info("从ngrok官网下载...")
    if download_file(ngrok_url, zip_path):
        extract_zip(zip_path, ngrok_dir)
        os.remove(zip_path)
        
        # 创建示例配置
        config_path = os.path.join(ngrok_dir, 'ngrok.yml')
        if not os.path.exists(config_path):
            with open(config_path, 'w', encoding='utf-8') as f:
                f.write("""authtoken: your_auth_token_here
tunnels:
  backend:
    addr: 5000
    proto: http
    host_header: rewrite
  frontend:
    addr: 3000
    proto: http
    host_header: rewrite
""")
        
        print_success("ngrok下载并解压完成")
        return True
    else:
        print_error("ngrok下载失败，请手动安装")
        return False

def main():
    print_title("下载依赖工具")
    print_info("此脚本将下载Redis和ngrok到本地目录")
    
    # 下载Redis
    download_redis()
    
    # 下载ngrok
    download_ngrok()
    
    print_title("下载完成")
    print_info("Redis已下载到: redis/")
    print_info("ngrok已下载到: deploy/ngrok/")
    print_info("请运行一键部署脚本继续安装")

if __name__ == "__main__":
    main()
