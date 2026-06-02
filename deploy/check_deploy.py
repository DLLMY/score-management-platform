#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
部署前检查脚本
检查系统环境、依赖和配置是否满足部署要求
"""

import os
import sys
import subprocess
import platform

def print_step(current, total, message):
    """打印步骤信息"""
    print(f"[{current}/{total}] {message}")

def print_success(message):
    """打印成功信息"""
    print(f"[OK] {message}")

def print_error(message):
    """打印错误信息"""
    print(f"[ERROR] {message}")

def print_warning(message):
    """打印警告信息"""
    print(f"[WARN] {message}")

def check_python_version():
    """检查Python版本"""
    try:
        version = sys.version_info
        if version >= (3, 10):
            print_success(f"Python版本: {version.major}.{version.minor}.{version.micro}")
            return True
        else:
            print_error(f"Python版本: {version.major}.{version.minor}.{version.micro} (需要3.10+)")
            return False
    except Exception as e:
        print_error(f"检查Python版本失败: {e}")
        return False

def check_node_version():
    """检查Node.js版本"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            # 提取版本号数字部分
            version_num = version.lstrip('v').split('.')[0]
            if int(version_num) >= 16:
                print_success(f"Node.js版本: {version}")
                return True
            else:
                print_error(f"Node.js版本: {version} (需要16+)")
                return False
        else:
            print_error("Node.js未安装或未添加到PATH")
            return False
    except Exception as e:
        print_error(f"检查Node.js版本失败: {e}")
        return False

def check_npm():
    """检查npm是否可用"""
    try:
        result = subprocess.run(['npm', '--version'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            print_success(f"npm版本: {result.stdout.strip()}")
            return True
        else:
            print_error("npm不可用")
            return False
    except Exception as e:
        print_error(f"检查npm失败: {e}")
        return False

def check_git():
    """检查git是否可用"""
    try:
        result = subprocess.run(['git', '--version'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            print_success(f"Git版本: {result.stdout.strip()}")
            return True
        else:
            print_warning("Git不可用（建议安装以支持版本控制）")
            return True
    except Exception as e:
        print_warning(f"检查Git失败: {e}")
        return True

def check_curl():
    """检查curl是否可用"""
    try:
        result = subprocess.run(['curl', '--version'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            print_success("curl可用")
            return True
        else:
            print_warning("curl不可用（ngrok URL获取可能受影响）")
            return True
    except Exception as e:
        print_warning(f"检查curl失败: {e}")
        return True

def check_directory_structure():
    """检查项目目录结构"""
    print_step(6, 8, "检查项目目录结构")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    
    required_dirs = [
        'backend',
        'frontend',
        'deploy'
    ]
    
    all_exists = True
    for d in required_dirs:
        dir_path = os.path.join(project_dir, d)
        if os.path.exists(dir_path):
            print_success(f"目录存在: {d}/")
        else:
            print_error(f"目录缺失: {d}/")
            all_exists = False
    
    return all_exists

def check_config_files():
    """检查配置文件"""
    print_step(7, 8, "检查配置文件")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    
    config_files = [
        ('backend/.env.example', True),
        ('frontend/.env.example', True),
        ('deploy/一键部署.bat', True),
        ('deploy/download_deps.py', True),
        ('frontend/proxy-server.js', True)
    ]
    
    all_exists = True
    for file_path, required in config_files:
        full_path = os.path.join(project_dir, file_path)
        if os.path.exists(full_path):
            print_success(f"配置文件存在: {file_path}")
        else:
            if required:
                print_error(f"配置文件缺失: {file_path}")
                all_exists = False
            else:
                print_warning(f"配置文件缺失: {file_path}")
    
    return all_exists

def check_redis():
    """检查Redis是否存在"""
    print_step(8, 8, "检查Redis")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    redis_exe = os.path.join(project_dir, 'redis', 'redis-server.exe')
    
    if os.path.exists(redis_exe):
        print_success("Redis已存在")
        return True
    else:
        print_warning("Redis未找到（部署时会自动下载）")
        return True

def main():
    """主函数"""
    # Windows下清屏
    if platform.system() == 'Windows':
        os.system('cls')
    else:
        os.system('clear')
    
    print("="*60)
    print("      学生积分管理平台 - 部署前检查")
    print("="*60)
    print()
    
    checks = [
        (1, "检查Python环境", check_python_version),
        (2, "检查Node.js环境", check_node_version),
        (3, "检查npm", check_npm),
        (4, "检查Git", check_git),
        (5, "检查curl", check_curl),
        (6, "检查目录结构", check_directory_structure),
        (7, "检查配置文件", check_config_files),
        (8, "检查Redis", check_redis)
    ]
    
    results = []
    total_checks = len(checks)
    
    for step_num, check_name, check_func in checks:
        print_step(step_num, total_checks, check_name)
        result = check_func()
        results.append(result)
        print()
    
    print("="*60)
    print("                    检查结果")
    print("="*60)
    
    passed = sum(results)
    failed = total_checks - passed
    
    if failed == 0:
        print("[OK] 所有检查通过！")
        print(f"\n已通过: {passed}/{total_checks}")
        print("\n可以运行一键部署脚本开始部署:")
        print("  cd deploy")
        print("  一键部署.bat")
        return 0
    else:
        print(f"[ERROR] 有 {failed} 项检查未通过")
        print(f"已通过: {passed}/{total_checks}")
        print("\n请先修复以下问题:")
        for i, (step_num, check_name, _) in enumerate(checks):
            if not results[i]:
                print(f"  - [{step_num}] {check_name}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
