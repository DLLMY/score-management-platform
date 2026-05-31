#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
内网穿透测试脚本
使用 pyngrok 实现内网穿透
"""

import time
from flask import Flask, jsonify
from flask_cors import CORS
from pyngrok import ngrok, conf

app = Flask(__name__)
CORS(app)

# 测试路由
@app.route('/')
def home():
    return "<h1>内网穿透测试成功!</h1>"

@app.route('/api/test')
def api_test():
    return jsonify({
        'success': True,
        'message': '内网穿透 API 测试成功',
        'timestamp': time.time()
    })

@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'score-management',
        'timestamp': time.time()
    })

if __name__ == '__main__':
    print("启动 Flask + pyngrok 服务...")
    print("\n" + "="*50)
    print("内网穿透服务启动中...")
    print("="*50 + "\n")
    
    try:
        # 设置 ngrok 配置
        conf.get_default().monitor_thread = True
        
        # 启动 ngrok 隧道，绑定到端口 5000
        http_tunnel = ngrok.connect(5000)
        public_url = http_tunnel.public_url
        
        print(f"✓ ngrok 隧道已创建")
        print(f"  公网地址: {public_url}")
        print(f"  本地地址: http://localhost:5000")
        print(f"  ngrok管理: http://localhost:4040")
        print("\n" + "="*50 + "\n")
        
        # 启动 Flask 服务
        app.run(port=5000)
        
    except Exception as e:
        print(f"✗ 启动失败: {e}")
        print("\n提示: 如果出现认证错误，请访问 https://dashboard.ngrok.com/signup 注册账号")
        print("然后设置环境变量: set NGROK_AUTHTOKEN=your_token")