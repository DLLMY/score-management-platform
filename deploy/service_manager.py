import os
import sys
import subprocess
import time
import threading
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('service_manager.log', encoding='utf-8'),
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
        self.max_restarts = 5
        
        # 端口配置
        self.ports = {
            'backend': 5000,
            'frontend': 3000,
            'ngrok': 4040
        }
    
    def check_port(self, port):
        """检查端口是否被占用"""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
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
    
    def start_backend(self):
        try:
            os.chdir(self.backend_dir)
            logger.info("启动后端服务...")
            self.backend_process = subprocess.Popen(
                ['python', 'app.py'],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='ignore'
            )
            time.sleep(3)
            if self.check_port(5000):
                logger.info("后端服务已启动 (端口: 5000)")
                return True
            else:
                logger.warning("后端服务可能未完全启动，继续等待...")
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
                errors='ignore'
            )
            time.sleep(10)
            logger.info("前端服务已启动 (端口: 3000)")
            return True
        except Exception as e:
            logger.error(f"启动前端服务失败: {e}")
            return False
    
    def start_ngrok(self):
        try:
            os.chdir(self.ngrok_dir)
            logger.info("启动ngrok...")
            self.ngrok_process = subprocess.Popen(
                ['ngrok.exe', 'http', '3000'],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='ignore'
            )
            time.sleep(5)
            logger.info("ngrok已启动 (管理面板: http://localhost:4040)")
            return True
        except Exception as e:
            logger.error(f"启动ngrok失败: {e}")
            return False
    
    def check_process(self, process, name, port=None):
        if process is None:
            return False
        try:
            ret = process.poll()
            if ret is None:
                # 进程还在运行，检查端口
                if port and not self.check_port(port):
                    logger.warning(f"{name}进程存在但端口 {port} 无响应")
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
        
        # 先清理端口
        if service_name == 'backend':
            self.kill_process_by_port(5000)
            if self.backend_process:
                try:
                    self.backend_process.kill()
                except:
                    pass
            return self.start_backend()
        elif service_name == 'frontend':
            self.kill_process_by_port(3000)
            if self.frontend_process:
                try:
                    self.frontend_process.kill()
                except:
                    pass
            return self.start_frontend()
        elif service_name == 'ngrok':
            self.kill_process_by_port(4040)
            if self.ngrok_process:
                try:
                    self.ngrok_process.kill()
                except:
                    pass
            return self.start_ngrok()
    
    def monitor_loop(self):
        while self.running:
            try:
                if not self.check_process(self.backend_process, '后端', 5000):
                    self.restart_service('backend')
                
                if not self.check_process(self.frontend_process, '前端', 3000):
                    self.restart_service('frontend')
                
                if not self.check_process(self.ngrok_process, 'ngrok'):
                    self.restart_service('ngrok')
                
                time.sleep(5)
            except Exception as e:
                logger.error(f"监控循环异常: {e}")
                time.sleep(5)
    
    def start_all(self):
        logger.info("="*50)
        logger.info("启动学生积分管理平台...")
        logger.info("="*50)
        
        # 停止已有进程
        self.kill_existing_processes()
        
        # 启动后端
        if not self.start_backend():
            logger.error("后端服务启动失败")
            return False
        
        time.sleep(6)
        
        # 启动前端
        if not self.start_frontend():
            logger.error("前端服务启动失败")
            return False
        
        time.sleep(12)
        
        # 启动ngrok
        if not self.start_ngrok():
            logger.warning("ngrok启动失败，但本地服务可用")
        
        time.sleep(3)
        
        logger.info("="*50)
        logger.info("所有服务已启动！")
        logger.info("本地访问: http://localhost:3000")
        logger.info("后端API: http://localhost:5000")
        logger.info("ngrok面板: http://localhost:4040")
        logger.info("="*50)
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
        self.kill_process_by_port(5000)
        self.kill_process_by_port(3000)
        self.kill_process_by_port(4040)
    
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
    
    # 检查Python
    try:
        python_version = subprocess.check_output(['python', '--version'], 
                                                 text=True, encoding='gbk', errors='ignore')
        print(f"✓ Python: {python_version.strip()}")
    except:
        print("✗ Python未安装或未添加到PATH")
        return False
    
    # 检查Node.js
    try:
        node_version = subprocess.check_output(['node', '--version'],
                                               text=True, encoding='gbk', errors='ignore')
        print(f"✓ Node.js: {node_version.strip()}")
    except:
        print("✗ Node.js未安装或未添加到PATH")
        return False
    
    # 检查npm
    try:
        npm_version = subprocess.check_output(['npm', '--version'],
                                              text=True, encoding='gbk', errors='ignore')
        print(f"✓ npm: {npm_version.strip()}")
    except:
        print("✗ npm未安装")
        return False
    
    print("环境检查完成！")
    print()
    return True


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'stop':
        manager = ServiceManager()
        manager.stop_all()
    else:
        # 先检查环境
        if not check_environment():
            print()
            print("请先安装依赖！运行: install_dependencies.bat")
            print()
            input("按回车键退出...")
            sys.exit(1)
        
        manager = ServiceManager()
        
        if manager.start_all():
            print("\n" + "="*50)
            print("🚀 服务启动成功！")
            print("="*50)
            print()
            print("📱 本地访问:  http://localhost:3000")
            print("🔗 外网地址:  请查看 http://localhost:4040")
            print("🔐 登录信息:  admin / admin123")
            print()
            print("="*50)
            print("💡 按 Ctrl+C 停止所有服务")
            print("="*50)
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
            print("✗ 服务启动失败，请查看日志")
            print()
            input("按回车键退出...")
