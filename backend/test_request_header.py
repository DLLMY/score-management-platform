#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Admin

@app.route('/api/test-header', methods=['GET'])
def test_header():
    """测试请求头是否包含X-Admin-Id"""
    admin_id = request.headers.get('X-Admin-Id')
    print(f"Received X-Admin-Id: {admin_id}")
    
    if admin_id:
        admin = Admin.query.get(int(admin_id))
        if admin:
            return {
                'success': True,
                'admin_id': admin_id,
                'username': admin.username,
                'role': admin.role,
                'class_name': admin.class_name
            }
        else:
            return {
                'success': False,
                'message': 'Admin not found',
                'admin_id': admin_id
            }
    else:
        return {
            'success': False,
            'message': 'X-Admin-Id header not found'
        }

if __name__ == '__main__':
    app.run(debug=True, port=5000)
