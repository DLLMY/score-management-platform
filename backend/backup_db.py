#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库备份脚本
功能：自动备份SQLite数据库到backups目录
"""

import os
import shutil
from datetime import datetime

def backup_database():
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = script_dir

    # 数据库路径
    db_path = os.path.join(backend_dir, 'instance', 'score_management.db')

    # 检查数据库文件是否存在
    if not os.path.exists(db_path):
        print(f"[ERROR] 数据库文件不存在: {db_path}")
        return False

    # 创建备份目录
    backup_dir = os.path.join(backend_dir, 'backups')
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)

    # 生成备份文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_filename = f'score_management_backup_{timestamp}.db'
    backup_path = os.path.join(backup_dir, backup_filename)

    try:
        # 复制数据库文件
        shutil.copy2(db_path, backup_path)
        print(f"[OK] 数据库备份成功！")
        print(f"   源文件: {db_path}")
        print(f"   备份文件: {backup_path}")
        return True
    except Exception as e:
        print(f"[ERROR] 数据库备份失败: {e}")
        return False

def restore_database(backup_file):
    """恢复数据库"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, 'instance', 'score_management.db')

    if not os.path.exists(backup_file):
        print(f"[ERROR] 备份文件不存在: {backup_file}")
        return False

    try:
        # 先停止服务！这里只做恢复操作
        shutil.copy2(backup_file, db_path)
        print(f"[OK] 数据库恢复成功！")
        print(f"   备份文件: {backup_file}")
        print(f"   恢复文件: {db_path}")
        return True
    except Exception as e:
        print(f"[ERROR] 数据库恢复失败: {e}")
        return False

def list_backups():
    """列出所有备份"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backup_dir = os.path.join(script_dir, 'backups')

    if not os.path.exists(backup_dir):
        print("[INFO] 暂无备份文件")
        return []

    backups = [f for f in os.listdir(backup_dir) if f.endswith('.db')]
    backups.sort(reverse=True)

    if not backups:
        print("[INFO] 暂无备份文件")
        return []

    print(f"[INFO] 共有 {len(backups)} 个备份文件：")
    for i, backup in enumerate(backups, 1):
        full_path = os.path.join(backup_dir, backup)
        size = os.path.getsize(full_path)
        modified = datetime.fromtimestamp(os.path.getmtime(full_path))
        print(f"  {i}. {backup}")
        print(f"     大小: {size / 1024:.2f} KB")
        print(f"     时间: {modified.strftime('%Y-%m-%d %H:%M:%S')}")
        print()

    return backups

if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == 'backup':
            backup_database()
        elif command == 'restore' and len(sys.argv) > 2:
            restore_database(sys.argv[2])
        elif command == 'list':
            list_backups()
        elif command == 'help':
            print("""
===============================================
数据库备份工具
===============================================

用法:
  python backup_db.py [command] [options]

命令:
  backup              备份数据库（推荐）
  restore <file>      恢复数据库（需要指定备份文件）
  list                列出所有备份
  help                显示帮助信息

示例:
  python backup_db.py backup           # 备份数据库
  python backup_db.py list             # 查看备份列表
  python backup_db.py restore backups/score_management_backup_20240521.db

===============================================
注意事项:
===============================================
  1. 恢复数据库前请先停止后端服务
  2. 恢复操作会覆盖当前数据库
  3. 建议定期备份重要数据
  4. 备份文件保存在 backend/backups/ 目录
            """)
        else:
            print(f"[ERROR] 未知命令: {command}")
            print("运行 'python backup_db.py help' 查看帮助")
    else:
        # 默认执行备份
        backup_database()
