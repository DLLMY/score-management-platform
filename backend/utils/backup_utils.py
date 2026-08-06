import shutil
import json
import zipfile
from datetime import datetime, timedelta
from typing import List, Dict, Any
from pathlib import Path
import sqlite3


class BackupManager:
    """数据备份管理器"""

    def __init__(self, backup_dir: str = None, retention_days: int = 30):
        """
        初始化备份管理器

        :param backup_dir: 备份目录路径
        :param retention_days: 备份文件保留天数
        """
        if backup_dir is None:
            self.backup_dir = Path(__file__).parent.parent / "backups"
        else:
            self.backup_dir = Path(backup_dir)

        self.retention_days = retention_days
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def _generate_backup_filename(self, backup_type: str = "full") -> str:
        """
        生成备份文件名

        :param backup_type: 备份类型: full, incremental, data_only
        :return: 文件名
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"backup_{backup_type}_{timestamp}.zip"

    def _get_db_path(self) -> Path:
        """获取数据库文件路径"""
        return Path(__file__).parent.parent / "instance" / "score_management.db"

    def create_backup(self, backup_type: str = "full") -> Dict[str, Any]:
        """
        创建数据备份

        :param backup_type: 备份类型
        :return: 备份结果 {'success': bool, 'filename': str, 'size': int, 'message': str}
        """
        try:
            db_path = self._get_db_path()

            if not db_path.exists():
                return {"success": False, "message": "数据库文件不存在"}

            backup_filename = self._generate_backup_filename(backup_type)
            backup_path = self.backup_dir / backup_filename

            # 创建临时目录
            temp_dir = self.backup_dir / "temp_backup"
            temp_dir.mkdir(exist_ok=True)

            try:
                # 复制数据库文件
                db_copy_path = temp_dir / "score_management.db"
                shutil.copy2(db_path, db_copy_path)

                # 创建备份信息文件
                backup_info = {
                    "backup_type": backup_type,
                    "timestamp": datetime.now().isoformat(),
                    "db_version": self._get_db_version(),
                    "file_count": 1,
                    "description": "积分管理系统数据备份",
                }

                with open(temp_dir / "backup_info.json", "w", encoding="utf-8") as f:
                    json.dump(backup_info, f, ensure_ascii=False, indent=2)

                # 打包成ZIP文件
                with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                    zipf.write(db_copy_path, "score_management.db")
                    zipf.write(temp_dir / "backup_info.json", "backup_info.json")

                backup_size = backup_path.stat().st_size

                return {
                    "success": True,
                    "filename": backup_filename,
                    "path": str(backup_path),
                    "size": backup_size,
                    "type": backup_type,
                    "timestamp": datetime.now().isoformat(),
                    "message": "备份成功",
                }
            finally:
                # 清理临时目录
                if temp_dir.exists():
                    shutil.rmtree(temp_dir)

        except Exception as e:
            return {"success": False, "message": f"备份失败: {str(e)}"}

    def _get_db_version(self) -> str:
        """获取数据库版本信息"""
        try:
            db_path = self._get_db_path()
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT sqlite_version()")
            version = cursor.fetchone()[0]
            conn.close()
            return version
        except Exception:
            return "unknown"

    def restore_backup(self, backup_filename: str) -> Dict[str, Any]:
        """
        恢复备份

        :param backup_filename: 备份文件名
        :return: 恢复结果 {'success': bool, 'message': str}
        """
        try:
            backup_path = self.backup_dir / backup_filename

            if not backup_path.exists():
                return {"success": False, "message": "备份文件不存在"}

            db_path = self._get_db_path()

            # 创建备份的备份（以防恢复失败）
            backup_before_restore = self.backup_dir / f'pre_restore_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'
            if db_path.exists():
                shutil.copy2(db_path, backup_before_restore)

            try:
                # 解压备份文件
                temp_dir = self.backup_dir / "temp_restore"
                temp_dir.mkdir(exist_ok=True)

                with zipfile.ZipFile(backup_path, "r") as zipf:
                    zipf.extractall(temp_dir)

                # 检查备份信息
                info_path = temp_dir / "backup_info.json"
                if info_path.exists():
                    with open(info_path, "r", encoding="utf-8") as f:
                        backup_info = json.load(f)

                # 恢复数据库
                restored_db_path = temp_dir / "score_management.db"
                if restored_db_path.exists():
                    shutil.copy2(restored_db_path, db_path)
                else:
                    return {"success": False, "message": "备份文件中未找到数据库"}

                # 清理临时目录
                shutil.rmtree(temp_dir)

                return {
                    "success": True,
                    "message": "恢复成功",
                    "backup_info": backup_info if "backup_info" in locals() else None,
                }

            except Exception as e:
                # 恢复失败，尝试恢复原数据库
                if backup_before_restore.exists() and db_path.exists():
                    shutil.copy2(backup_before_restore, db_path)

                if "temp_dir" in locals() and temp_dir.exists():
                    shutil.rmtree(temp_dir)

                return {"success": False, "message": f"恢复失败: {str(e)}"}

        except Exception as e:
            return {"success": False, "message": f"恢复失败: {str(e)}"}

    def list_backups(self) -> List[Dict[str, Any]]:
        """
        获取备份文件列表

        :return: 备份文件信息列表
        """
        backups = []

        try:
            for file in self.backup_dir.iterdir():
                if file.is_file() and file.suffix == ".zip" and file.name.startswith("backup_"):
                    stat = file.stat()
                    backups.append(
                        {
                            "filename": file.name,
                            "path": str(file),
                            "size": stat.st_size,
                            "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                            "type": self._parse_backup_type(file.name),
                        }
                    )

            # 按创建时间降序排列
            backups.sort(key=lambda x: x["created_at"], reverse=True)
        except Exception:
            pass

        return backups

    def _parse_backup_type(self, filename: str) -> str:
        """解析备份类型"""
        if "_full_" in filename:
            return "完整备份"
        elif "_incremental_" in filename:
            return "增量备份"
        elif "_data_only_" in filename:
            return "数据备份"
        return "未知"

    def clean_old_backups(self) -> Dict[str, Any]:
        """
        清理过期备份文件

        :return: 清理结果 {'deleted_count': int, 'message': str}
        """
        deleted_count = 0
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)

        try:
            for file in self.backup_dir.iterdir():
                if file.is_file() and file.suffix == ".zip" and file.name.startswith("backup_"):
                    file_time = datetime.fromtimestamp(file.stat().st_ctime)
                    if file_time < cutoff_date:
                        file.unlink()
                        deleted_count += 1

            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": f"已清理 {deleted_count} 个过期备份文件",
            }
        except Exception as e:
            return {"success": False, "deleted_count": deleted_count, "message": f"清理失败: {str(e)}"}

    def get_backup_stats(self) -> Dict[str, Any]:
        """
        获取备份统计信息

        :return: 统计信息
        """
        backups = self.list_backups()
        total_size = sum(b["size"] for b in backups)

        return {
            "total_backups": len(backups),
            "total_size": total_size,
            "retention_days": self.retention_days,
            "backup_dir": str(self.backup_dir),
        }


class BackupScheduler:
    """备份任务调度器"""

    def __init__(self, backup_manager: BackupManager, schedule_time: str = "02:00"):
        """
        初始化调度器

        :param backup_manager: 备份管理器实例
        :param schedule_time: 定时备份时间（格式: HH:MM）
        """
        self.backup_manager = backup_manager
        self.schedule_time = schedule_time
        self.last_run_time = None
        self.enabled = False

    def should_run(self) -> bool:
        """检查是否应该执行备份"""
        if not self.enabled:
            return False

        now = datetime.now()
        scheduled_time = datetime.strptime(self.schedule_time, "%H:%M")
        scheduled_datetime = datetime(now.year, now.month, now.day, scheduled_time.hour, scheduled_time.minute)

        # 如果今天的定时时间已经过了，检查是否是新的一天
        if now >= scheduled_datetime:
            # 检查是否已经在今天运行过
            if self.last_run_time is None:
                return True
            last_run_date = self.last_run_time.date()
            today = now.date()
            return last_run_date < today

        return False

    def run_scheduled_backup(self) -> Dict[str, Any]:
        """执行定时备份"""
        if not self.should_run():
            return {"success": False, "message": "未到备份时间或已在今天运行过"}

        result = self.backup_manager.create_backup(backup_type="full")

        if result["success"]:
            self.last_run_time = datetime.now()
            # 清理过期备份
            self.backup_manager.clean_old_backups()

        return result

    def enable(self):
        """启用定时备份"""
        self.enabled = True

    def disable(self):
        """禁用定时备份"""
        self.enabled = False

    def set_schedule_time(self, time_str: str):
        """设置定时备份时间"""
        try:
            datetime.strptime(time_str, "%H:%M")
            self.schedule_time = time_str
            return True
        except ValueError:
            return False


# 模块级单例，供其他模块直接引用
backup_manager = BackupManager()
