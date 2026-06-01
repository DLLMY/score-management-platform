#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import subprocess
import time
import getpass

def print_title(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")

def print_step(step, total, title):
    print(f"\n[{step}/{total}] {title}")
    print(f"{'—'*40}")

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️ {message}")

def print_warning(message):
    print(f"⚠️ {message}")

def run_command(cmd, cwd=None, quiet=False):
    try:
        result = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, encoding='utf-8')
        if result.returncode != 0 and not quiet:
            print(f"命令执行失败: {cmd}")
            if result.stderr:
                print(f"错误信息: {result.stderr.strip()}")
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        print(f"执行命令时发生异常: {e}")
        return False, "", str(e)

def get_user_input(prompt, default=""):
    if default:
        prompt = f"{prompt} (默认: {default})"
    try:
        return input(f"\n{prompt}: ").strip() or default
    except KeyboardInterrupt:
        print("\n\n用户取消操作")
        sys.exit(0)

def create_file(file_path, content, overwrite=False):
    if os.path.exists(file_path) and not overwrite:
        print_warning(f"文件已存在，跳过创建: {file_path}")
        return False
    
    try:
        # 确保目录存在
        dir_path = os.path.dirname(file_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print_info(f"创建目录: {dir_path}")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print_success(f"创建文件: {file_path}")
        return True
    except Exception as e:
        print_error(f"创建文件失败: {file_path}")
        print(f"错误: {e}")
        return False

def main():
    print_title("学生积分管理平台 - 智能一键部署系统")
    
    # 获取路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    backend_dir = os.path.join(project_dir, 'backend')
    frontend_dir = os.path.join(project_dir, 'frontend')
    
    print_info(f"项目目录: {project_dir}")
    print_info(f"后端目录: {backend_dir}")
    print_info(f"前端目录: {frontend_dir}")
    
    # 用户配置输入
    print_title("配置信息输入")
    db_path = get_user_input(
        "请输入SQLite数据库文件路径",
        default="C:\\Users\\53527\\Desktop\\自我管理提升\\自我管理提升V2.0\\平台开发\\管理平台设计\\backend\\instance\\score_management.db"
    )
    
    flask_port = get_user_input("请输入后端服务端口", default="5000")
    frontend_port = get_user_input("请输入前端服务端口", default="3000")
    
    admin_username = get_user_input("请输入管理员用户名", default="admin")
    admin_password = getpass.getpass("请输入管理员密码 (不显示): ")
    if not admin_password:
        admin_password = "admin123"
        print(f"使用默认密码: {admin_password}")
    
    # 步骤1: 检查环境
    print_step(1, 7, "检查运行环境")
    
    print("检查 Python 环境...")
    success, stdout, stderr = run_command('py --version')
    if not success:
        print_error("Python 未安装或未添加到 PATH")
        print_info("请安装 Python 3.10+ 并添加到系统 PATH")
        print_info("下载地址: https://www.python.org/downloads/")
        input("\n按 Enter 退出...")
        sys.exit(1)
    print_success(f"Python 版本: {stdout.strip()}")
    
    print("\n检查 Node.js 环境...")
    success, stdout, stderr = run_command('node --version')
    if not success:
        print_error("Node.js 未安装或未添加到 PATH")
        print_info("请安装 Node.js 16+ 并添加到系统 PATH")
        print_info("下载地址: https://nodejs.org/")
        input("\n按 Enter 退出...")
        sys.exit(1)
    print_success(f"Node.js 版本: {stdout.strip()}")
    
    # 步骤2: 安装后端依赖
    print_step(2, 7, "安装后端 Python 依赖")
    print_info("正在安装依赖，这可能需要几分钟...")
    
    requirements_file = os.path.join(backend_dir, 'requirements.txt')
    if os.path.exists(requirements_file):
        success, stdout, stderr = run_command('py -m pip install -r requirements.txt', cwd=backend_dir)
        if success:
            print_success("Python 依赖安装完成")
        else:
            print_warning("部分依赖安装可能失败，请检查网络连接")
    else:
        print_error(f"依赖文件不存在: {requirements_file}")
    
    # 步骤3: 安装前端依赖
    print_step(3, 7, "安装前端 Node.js 依赖")
    print_info("正在安装依赖，这可能需要几分钟...")
    
    package_file = os.path.join(frontend_dir, 'package.json')
    if os.path.exists(package_file):
        success, stdout, stderr = run_command('npm install --legacy-peer-deps', cwd=frontend_dir)
        if success:
            print_success("Node.js 依赖安装完成")
        else:
            print_error("Node.js 依赖安装失败")
            print_info("请检查网络连接或手动运行: npm install --legacy-peer-deps")
            input("\n按 Enter 继续...")
    
    # 安装 typescript（修复已知问题）
    print("\n安装 TypeScript 依赖...")
    success, stdout, stderr = run_command('npm install typescript --save-dev', cwd=frontend_dir)
    if success:
        print_success("TypeScript 安装完成")
    
    # 步骤4: 创建配置文件
    print_step(4, 7, "创建配置文件")
    
    # 创建 instance 目录
    instance_dir = os.path.dirname(db_path)
    if not os.path.exists(instance_dir):
        os.makedirs(instance_dir)
        print_success(f"创建目录: {instance_dir}")
    
    # 创建 .env 文件
    env_content = f"""\
# 后端环境变量配置
# Flask 配置
FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=true
FLASK_SECRET_KEY=dev_secret_key_for_student_score_management_platform_2024
FLASK_PORT={flask_port}
FLASK_HOST=127.0.0.1

# 数据库配置
DATABASE_URI=sqlite:///{db_path.replace('\\', '/')}

# Redis 缓存配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# 安全配置
CSRF_SECRET_KEY=csrf_dev_secret_key_for_development_only

# 限流配置
RATE_LIMIT_ENABLED=false
RATE_LIMIT_PER_HOUR=1000
RATE_LIMIT_PER_MINUTE=30

# MQTT 配置
MQTT_BROKER=broker.hivemq.com
MQTT_PORT=1883
MQTT_CLIENT_ID=score_backend_dev
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_SSL=false
MQTT_TIMEOUT=10
MQTT_KEEPALIVE=60
MQTT_TOPIC_PREFIX=score/management

# JWT配置
JWT_SECRET_KEY=jwt_dev_secret_key_for_development_only_2024
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=604800

# 备份配置
BACKUP_ENABLED=false
BACKUP_INTERVAL_HOURS=24
BACKUP_MAX_COUNT=10

# CORS配置
CORS_ORIGINS=http://localhost:{frontend_port},http://127.0.0.1:{frontend_port}
"""
    env_file = os.path.join(backend_dir, '.env')
    create_file(env_file, env_content, overwrite=True)
    
    # 创建管理员初始化脚本
    init_script_content = f"""\
#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import Admin

app = create_app()

with app.app_context():
    # 检查是否已存在管理员
    existing_admin = Admin.query.filter_by(username='{admin_username}').first()
    if existing_admin:
        print(f"管理员 {admin_username} 已存在")
    else:
        from werkzeug.security import generate_password_hash
        admin = Admin(
            username='{admin_username}',
            password=generate_password_hash('{admin_password}'),
            name='系统管理员',
            email='admin@example.com'
        )
        from app import db
        db.session.add(admin)
        db.session.commit()
        print(f"管理员 {admin_username} 创建成功")
"""
    init_script = os.path.join(backend_dir, 'scripts', 'init_admin.py')
    create_file(init_script, init_script_content, overwrite=True)
    
    # 步骤5: 初始化数据库和管理员
    print_step(5, 7, "初始化数据库")
    
    print("创建数据库表...")
    success, stdout, stderr = run_command('py -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all(); print(\'数据库表创建完成\')"', cwd=backend_dir)
    if success:
        print_success("数据库表创建完成")
    else:
        print_error("数据库表创建失败")
        print_info(f"错误信息: {stderr}")
    
    print("\n创建管理员账户...")
    success, stdout, stderr = run_command('py scripts/init_admin.py', cwd=backend_dir)
    if success:
        print_success("管理员账户创建完成")
        print_info(f"用户名: {admin_username}")
        print_info(f"密码: {admin_password}")
    else:
        print_error("管理员账户创建失败")
    
    # 步骤6: 清理端口
    print_step(6, 7, "清理端口占用")
    
    print(f"检查并释放端口 {flask_port}...")
    run_command(f'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :{flask_port} ^| findstr LISTENING\') do taskkill /F /PID %a', quiet=True)
    
    print(f"检查并释放端口 {frontend_port}...")
    run_command(f'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :{frontend_port} ^| findstr LISTENING\') do taskkill /F /PID %a', quiet=True)
    
    print_success("端口清理完成")
    
    # 步骤7: 启动服务
    print_step(7, 8, "启动服务")
    
    # 检查并启动本地Redis
    redis_dir = os.path.join(project_dir, 'redis')
    redis_exe = os.path.join(redis_dir, 'redis-server.exe')
    if os.path.exists(redis_exe):
        print("检测到本地Redis，启动Redis服务...")
        redis_cmd = f'cd /d "{redis_dir}" && redis-server.exe redis.windows.conf'
        subprocess.Popen(f'start "Redis服务" cmd /k "{redis_cmd}"', shell=True)
        time.sleep(2)
        print_success("Redis服务已启动")
    else:
        print_warning("未检测到本地Redis，将使用内存缓存")
    
    print(f"启动后端服务 (端口 {flask_port})...")
    backend_cmd = f'cd /d "{backend_dir}" && py run.py --env development'
    subprocess.Popen(f'start "后端服务" cmd /k "{backend_cmd}"', shell=True)
    
    print("等待后端服务启动...")
    time.sleep(5)
    
    print(f"启动前端服务 (端口 {frontend_port})...")
    frontend_cmd = f'cd /d "{frontend_dir}" && npm start'
    subprocess.Popen(f'start "前端服务" cmd /k "{frontend_cmd}"', shell=True)
    
    print("等待前端服务启动...")
    time.sleep(3)
    
    # 部署完成
    print_title("🎉 部署完成！")
    print("\n" + "="*60)
    print("服务访问信息:")
    print(f"  📱 前端应用:  http://localhost:{frontend_port}")
    print(f"  🔗 后端API:   http://localhost:{flask_port}")
    print(f"  📚 API文档:   http://localhost:{flask_port}/apidocs")
    print("\n登录信息:")
    print(f"  👤 用户名: {admin_username}")
    print(f"  🔑 密码:   {admin_password}")
    print("\n创建的文件:")
    print(f"  • 配置文件: {env_file}")
    print(f"  • 数据库文件: {db_path}")
    print(f"  • 初始化脚本: {init_script}")
    print("\n服务窗口已打开，按 Enter 退出此窗口...")
    input()

if __name__ == '__main__':
    main()