import os
import sys
import subprocess
import time
import threading
import logging
import json
import socket
from datetime import datetime
from logging.handlers import RotatingFileHandler

# 默认配置
DEFAULT_CONFIG = {
    'backend_port': 5000,
    'frontend_port': 3000,
    'ngrok_port': 4040,
    'max_restarts': 5,
    'monitor_interval': 5,
    'startup_delay': {
        'backend': 6,
        'frontend': 12,
        'ngrok': 3
    },
    'health_check_timeout': 10
}


def load_config():
    """加载配置文件"""
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                user_config = json.load(f)
                return {**DEFAULT_CONFIG, **user_config}
        except Exception as e:
            print(f"加载配置文件失败，使用默认配置: {e}")
    return DEFAULT_CONFIG


# 加载配置
CONFIG = load_config()

# 配置日志（自动轮转）
log_handler = RotatingFileHandler(
    'service_manager.log',
    maxBytes=1024 * 1024 * 10,  # 10MB
    backupCount=5,
    encoding='utf-8'
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        log_handler,
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class ServiceManager:
    def __init__(self):
        self.project_dir = os.path.dirname(os.path.abspath(__file__))
        self.backend_dir = os.path.join(self.project_dir, '..', 'backend')
        self.frontend_dir = os.path.join(self.project_dir, '..', 'frontend')
        self.ngrok_dir = os.path.join(self.project_dir, 'ngrok')
        
        self.backend_process = None
        self.frontend_process = None
        self.ngrok_process = None
        
        self.running = True
        self.restart_counts = {
            'backend': 0,
            'frontend': 0,
            'ngrok': 0
        }
        self.max_restarts = CONFIG['max_restarts']
        self.monitor_interval = CONFIG['monitor_interval']
        
        # 端口配置
        self.ports = {
            'backend': CONFIG['backend_port'],
            'frontend': CONFIG['frontend_port'],
            'ngrok': CONFIG['ngrok_port']
        }
        
        # 启动延迟配置
        self.delays = CONFIG['startup_delay']
    
    def check_port(self, port):
        """检查端口是否被占用"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', port))
            sock.close()
            return result == 0
        except Exception:
            return False
    
    def kill_process_by_port(self, port):
        """根据端口杀掉进程（Windows）"""
        try:
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True,
                encoding='gbk',
                errors='ignore'
            )
            for line in result.stdout.splitlines():
                if f':{port}' in line:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        try:
                            subprocess.run(['taskkill', '/F', '/PID', pid], 
                                         capture_output=True)
                            logger.info(f"已终止占用端口 {port} 的进程 (PID: {pid})")
                        except Exception as e:
                            logger.warning(f"终止进程失败: {e}")
        except Exception as e:
            logger.warning(f"清理端口 {port} 时出错: {e}")
    
    def check_backend_health(self):
        """检查后端API健康状态"""
        try:
            import urllib.request
            url = f"http://localhost:{self.ports['backend']}/api/health"
            response = urllib.request.urlopen(url, timeout=CONFIG['health_check_timeout'])
            return response.status == 200
        except Exception:
            return False
    
    def check_frontend_health(self):
        """检查前端服务健康状态"""
        try:
            import urllib.request
            url = f"http://localhost:{self.ports['frontend']}"
            response = urllib.request.urlopen(url, timeout=CONFIG['health_check_timeout'])
            return response.status == 200
        except Exception:
            return False
    
    def start_backend(self):
        try:
            os.chdir(self.backend_dir)
            logger.info("启动后端服务...")
            self.backend_process = subprocess.Popen(
                ['python', 'run.py', '--env', 'development'],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='ignore',
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            time.sleep(self.delays['backend'])
            if self.check_backend_health():
                logger.info(f"后端服务已启动 (端口: {self.ports['backend']})")
                return True
            elif self.check_port(self.ports['backend']):
                logger.info(f"后端服务已启动但健康检查未通过 (端口: {self.ports['backend']})")
                return True
            else:
                logger.warning("后端服务可能未完全启动")
                return True
        except Exception as e:
            logger.error(f"启动后端服务失败: {e}")
            return False
    
    def start_frontend(self):
        try:
            os.chdir(self.frontend_dir)
            logger.info("启动前端服务...")
            self.frontend_process = subprocess.Popen(
                ['npm', 'start'],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='ignore',
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            time.sleep(self.delays['frontend'])
            if self.check_frontend_health():
                logger.info(f"前端服务已启动 (端口: {self.ports['frontend']})")
                return True
            elif self.check_port(self.ports['frontend']):
                logger.info(f"前端服务已启动 (端口: {self.ports['frontend']})")
                return True
            else:
                logger.warning("前端服务可能未完全启动")
                return True
        except Exception as e:
            logger.error(f"启动前端服务失败: {e}")
            return False
    
    def start_ngrok(self):
        try:
            os.chdir(self.ngrok_dir)
            logger.info("启动ngrok...")
            self.ngrok_process = subprocess.Popen(
                ['ngrok.exe', 'http', str(self.ports['frontend'])],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='ignore',
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            time.sleep(self.delays['ngrok'])
            logger.info(f"ngrok已启动 (管理面板: http://localhost:{self.ports['ngrok']})")
            return True
        except Exception as e:
            logger.error(f"启动ngrok失败: {e}")
            return False
    
    def check_process(self, process, name, port=None, health_check=None):
        if process is None:
            return False
        try:
            ret = process.poll()
            if ret is None:
                # 进程还在运行，检查端口和健康状态
                if port and not self.check_port(port):
                    logger.warning(f"{name}进程存在但端口 {port} 无响应")
                if health_check and callable(health_check):
                    if not health_check():
                        logger.warning(f"{name}进程存在但健康检查失败")
                return True
            else:
                logger.warning(f"{name}服务已停止，退出码: {ret}")
                return False
        except Exception as e:
            logger.error(f"检查{name}服务失败: {e}")
            return False
    
    def restart_service(self, service_name):
        if self.restart_counts[service_name] >= self.max_restarts:
            logger.error(f"{service_name}服务已达到最大重启次数，停止尝试")
            return False
        
        self.restart_counts[service_name] += 1
        logger.info(f"重新启动{service_name}服务 (第{self.restart_counts[service_name]}次)")
        
        if service_name == 'backend':
            self.kill_process_by_port(self.ports['backend'])
            if self.backend_process:
                try:
                    self.backend_process.kill()
                except:
                    pass
            return self.start_backend()
        elif service_name == 'frontend':
            self.kill_process_by_port(self.ports['frontend'])
            if self.frontend_process:
                try:
                    self.frontend_process.kill()
                except:
                    pass
            return self.start_frontend()
        elif service_name == 'ngrok':
            self.kill_process_by_port(self.ports['ngrok'])
            if self.ngrok_process:
                try:
                    self.ngrok_process.kill()
                except:
                    pass
            return self.start_ngrok()
    
    def monitor_loop(self):
        while self.running:
            try:
                if not self.check_process(self.backend_process, '后端', self.ports['backend'], self.check_backend_health):
                    self.restart_service('backend')
                
                if not self.check_process(self.frontend_process, '前端', self.ports['frontend'], self.check_frontend_health):
                    self.restart_service('frontend')
                
                if not self.check_process(self.ngrok_process, 'ngrok'):
                    self.restart_service('ngrok')
                
                time.sleep(self.monitor_interval)
            except Exception as e:
                logger.error(f"监控循环异常: {e}")
                time.sleep(self.monitor_interval)
    
    def start_all(self):
        logger.info("="*60)
        logger.info("启动学生积分管理平台...")
        logger.info(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("="*60)
        
        # 停止已有进程
        self.kill_existing_processes()
        
        # 启动后端
        if not self.start_backend():
            logger.error("后端服务启动失败")
            return False
        
        # 启动前端
        if not self.start_frontend():
            logger.error("前端服务启动失败")
            return False
        
        # 启动ngrok
        if not self.start_ngrok():
            logger.warning("ngrok启动失败，但本地服务可用")
        
        logger.info("="*60)
        logger.info("所有服务已启动！")
        logger.info(f"本地访问: http://localhost:{self.ports['frontend']}")
        logger.info(f"后端API: http://localhost:{self.ports['backend']}")
        logger.info(f"ngrok面板: http://localhost:{self.ports['ngrok']}")
        logger.info("="*60)
        logger.info("")
        logger.info("💡 如果ngrok失败，只影响外网访问，本地功能正常！")
        logger.info("")
        
        # 启动监控线程
        monitor_thread = threading.Thread(target=self.monitor_loop)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        return True
    
    def kill_existing_processes(self):
        logger.info("清理已有进程...")
        for port in self.ports.values():
            self.kill_process_by_port(port)
    
    def stop_all(self):
        logger.info("停止所有服务...")
        self.running = False
        
        processes = [
            (self.backend_process, '后端'),
            (self.frontend_process, '前端'),
            (self.ngrok_process, 'ngrok')
        ]
        
        for process, name in processes:
            if process:
                try:
                    process.kill()
                    logger.info(f"{name}已停止")
                except Exception as e:
                    logger.warning(f"停止{name}时出错: {e}")
        
        # 清理端口
        self.kill_existing_processes()
        logger.info("所有服务已停止")


def check_environment():
    """检查环境是否就绪"""
    print("检查环境...")
    all_passed = True
    
    # 检查Python
    try:
        result = subprocess.run(['python', '--version'], 
                                capture_output=True, text=True, encoding='gbk', errors='ignore')
        if result.returncode == 0:
            print(f"✓ Python: {result.stdout.strip()}")
        else:
            print(f"✗ Python: {result.stderr.strip()}")
            all_passed = False
    except Exception as e:
        print(f"✗ Python未安装或未添加到PATH: {e}")
        all_passed = False
    
    # 检查Node.js
    try:
        result = subprocess.run(['node', '--version'],
                               capture_output=True, text=True, encoding='gbk', errors='ignore')
        if result.returncode == 0:
            print(f"✓ Node.js: {result.stdout.strip()}")
        else:
            print(f"✗ Node.js: {result.stderr.strip()}")
            all_passed = False
    except Exception as e:
        print(f"✗ Node.js未安装或未添加到PATH: {e}")
        all_passed = False
    
    # 检查npm
    try:
        result = subprocess.run(['npm', '--version'],
                              capture_output=True, text=True, encoding='gbk', errors='ignore')
        if result.returncode == 0:
            print(f"✓ npm: {result.stdout.strip()}")
        else:
            print(f"✗ npm: {result.stderr.strip()}")
            all_passed = False
    except Exception as e:
        print(f"✗ npm未安装: {e}")
        all_passed = False
    
    print("环境检查完成！")
    print()
    return all_passed


def check_dependencies():
    """检查项目依赖是否安装"""
    print("检查项目依赖...")
    project_dir = os.path.dirname(os.path.abspath(__file__))
    all_passed = True
    
    # 检查后端依赖
    backend_dir = os.path.join(project_dir, '..', 'backend')
    requirements_path = os.path.join(backend_dir, 'requirements.txt')
    
    if os.path.exists(requirements_path):
        try:
            result = subprocess.run(
                ['python', '-c', 'import flask, flask_restx, flask_sqlalchemy, flask_limiter, bcrypt, jwt'],
                capture_output=True, text=True, encoding='gbk', errors='ignore'
            )
            if result.returncode == 0:
                print("✓ 后端依赖已安装")
            else:
                print("✗ 后端依赖未完全安装")
                all_passed = False
        except Exception as e:
            print(f"✗ 检查后端依赖失败: {e}")
            all_passed = False
    else:
        print("⚠️ 未找到requirements.txt")
    
    # 检查前端依赖
    frontend_dir = os.path.join(project_dir, '..', 'frontend')
    node_modules_path = os.path.join(frontend_dir, 'node_modules')
    
    if os.path.exists(node_modules_path):
        print("✓ 前端依赖已安装")
    else:
        print("✗ 前端依赖未安装")
        all_passed = False
    
    # 检查数据库文件
    db_path = os.path.join(backend_dir, 'instance', 'score_management.db')
    if os.path.exists(db_path):
        print("✓ 数据库文件存在")
    else:
        print("⚠️ 数据库文件不存在，首次启动会自动创建")
    
    print("依赖检查完成！")
    print()
    return all_passed


def check_ports():
    """检查端口占用情况"""
    print("检查端口占用...")
    ports = [CONFIG['backend_port'], CONFIG['frontend_port'], CONFIG['ngrok_port']]
    used_ports = []
    
    for port in ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', port))
            sock.close()
            if result == 0:
                used_ports.append(port)
                print(f"⚠️ 端口 {port} 已被占用")
            else:
                print(f"✓ 端口 {port} 可用")
        except Exception as e:
            print(f"✗ 检查端口 {port} 失败: {e}")
    
    if used_ports:
        print(f"\n提示: 以下端口被占用，启动时会自动释放: {', '.join(map(str, used_ports))}")
    
    print()
    return True


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'stop':
        manager = ServiceManager()
        manager.stop_all()
    elif len(sys.argv) > 1 and sys.argv[1] == 'check':
        # 仅检查环境
        print("="*60)
        print("环境检查模式")
        print("="*60)
        print()
        
        env_ok = check_environment()
        dep_ok = check_dependencies()
        check_ports()
        
        print("="*60)
        if env_ok and dep_ok:
            print("✅ 所有检查通过！可以启动服务")
        else:
            print("❌ 部分检查未通过，请先修复")
        print("="*60)
    else:
        # 完整启动流程
        print("="*60)
        print("学生积分管理平台 - 启动器")
        print("="*60)
        print()
        
        # 环境检查
        if not check_environment():
            print("❌ 环境检查失败")
            print()
            print("请先安装依赖！运行: python -m pip install -r backend/requirements.txt")
            print()
            input("按回车键退出...")
            sys.exit(1)
        
        # 依赖检查
        check_dependencies()
        
        # 端口检查
        check_ports()
        
        # 启动服务
        manager = ServiceManager()
        
        if manager.start_all():
            print("\n" + "="*60)
            print("🚀 服务启动成功！")
            print("="*60)
            print()
            print(f"📱 本地访问:  http://localhost:{CONFIG['frontend_port']}")
            print(f"🔗 外网地址:  请查看 http://localhost:{CONFIG['ngrok_port']}")
            print("🔐 登录信息:  admin / admin123")
            print()
            print("="*60)
            print("💡 按 Ctrl+C 停止所有服务")
            print("="*60)
            print()
            
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print()
                print("正在停止服务...")
                manager.stop_all()
                print("✓ 所有服务已停止")
        else:
            print()
            print("❌ 服务启动失败，请查看日志")
            print()
            input("按回车键退出...")