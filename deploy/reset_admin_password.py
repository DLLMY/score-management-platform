#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
重置管理员密码脚本
确保默认管理员密码统一为 123456
"""

import os
import sys

def main():
    # 设置环境变量
    basedir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backend_dir = os.path.join(basedir, 'backend')
    sys.path.insert(0, backend_dir)
    
    os.environ['FLASK_ENV'] = 'development'
    
    from app import app, db
    from models import Admin
    from utils.security import hash_password
    
    with app.app_context():
        # 查找admin用户
        admin = Admin.query.filter_by(username='admin').first()
        
        if admin:
            print(f"找到管理员用户: {admin.username}")
            print(f"当前密码哈希: {admin._password[:50]}...")
            
            # 更新密码为 123456
            admin.password = hash_password('123456')
            db.session.commit()
            
            print("✓ 管理员密码已更新为: 123456")
        else:
            print("未找到admin用户，将创建新的管理员...")
            
            # 创建默认管理员
            new_admin = Admin(
                username='admin',
                password=hash_password('123456'),
                role='admin',
                real_name='系统管理员',
                phone='13800138000'
            )
            db.session.add(new_admin)
            db.session.commit()
            
            print("✓ 已创建默认管理员: admin / 123456")
    
    print("\n操作完成！")

if __name__ == '__main__':
    main()
