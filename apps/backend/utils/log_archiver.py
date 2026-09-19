"""日志自动归档与超期清理（D-M1）。

后端原本仅用 RotatingFileHandler 按尺寸轮转（app.log / error.log /
security*.log），但轮转产物为裸文件、从不压缩、从不清理，长期运行磁盘
只增不减。本模块提供：

1. GzipRotatingFileHandler —— 轮转瞬间把旧日志压缩为 .gz（替代裸轮转），
   公开接口与 RotatingFileHandler 完全一致，可零回归替换。
2. enforce_retention(log_dir, retention_days, archive_subdir) —— 删除归档
   子目录中超过保留天数的 .gz 文件。
3. archive_existing_rotated(log_dir, archive_subdir) —— 把历史遗留的裸轮转
   文件（*.log.N）补压为 .gz，回收既有磁盘占用。
4. setup_log_archiving(app=None) —— 幂等启动钩子：导入即补压一次历史裸轮转
   + 在生产环境注册每日定时清理；create_app 启动时调用一次。
"""
import gzip
import logging
import os
import shutil
import time
from logging.handlers import RotatingFileHandler

try:
    from config import Config

    LOG_DIR = Config.LOG_DIR
    LOG_RETENTION_DAYS = Config.LOG_RETENTION_DAYS
    LOG_ARCHIVE_SUBDIR = Config.LOG_ARCHIVE_SUBDIR
except (ImportError, AttributeError):  # 兜底（单独跑脚本 / 路径未注入）
    basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    LOG_DIR = os.path.join(basedir, "logs")
    LOG_RETENTION_DAYS = int(os.getenv("LOG_RETENTION_DAYS", "30"))
    LOG_ARCHIVE_SUBDIR = os.getenv("LOG_ARCHIVE_SUBDIR", "archive")


class GzipRotatingFileHandler(RotatingFileHandler):
    """轮转时即时压缩旧日志为 .gz 的 RotatingFileHandler。

    仅重写归档文件名构造与旋转动作；maxBytes / backupCount / encoding /
    setLevel 行为与原生完全一致。归档统一收拢到 LOG_DIR/archive_subdir。
    """

    def __init__(self, filename, *args, archive_subdir=None, **kwargs):
        os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
        super().__init__(filename, *args, **kwargs)
        self.archive_subdir = archive_subdir or LOG_ARCHIVE_SUBDIR
        self.archive_dir = os.path.join(os.path.dirname(os.path.abspath(filename)), self.archive_subdir)
        os.makedirs(self.archive_dir, exist_ok=True)

    def rotation_filename(self, default_name: str) -> str:
        """轮转目标文件名：在原生后缀后追加 .gz 并收拢到归档子目录。

        原生 default_name 形如 ``.../app.log.1``；本类产出
        ``LOG_DIR/archive/app.log.1.gz``。
        """
        base = os.path.basename(default_name)
        return os.path.join(self.archive_dir, base + ".gz")

    def rotate(self, source, dest):
        """将 source 压缩写入 dest（dest 已含 .gz 后缀）后删除 source。"""
        with open(source, "rb") as f_in, gzip.open(dest, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
        os.remove(source)


def enforce_retention(log_dir=None, retention_days=None, archive_subdir=None):
    """删除归档子目录中超过保留天数的 .gz 文件。

    返回被删除的文件路径列表（无则空列表）。参数缺省时从 config 读取。
    """
    log_dir = log_dir or LOG_DIR
    if retention_days is None:
        retention_days = LOG_RETENTION_DAYS
    archive_subdir = archive_subdir or LOG_ARCHIVE_SUBDIR

    archive_dir = os.path.join(log_dir, archive_subdir)
    if not os.path.isdir(archive_dir):
        return []

    cutoff = time.time() - retention_days * 86400
    removed = []
    for name in os.listdir(archive_dir):
        if not name.endswith(".gz"):
            continue
        path = os.path.join(archive_dir, name)
        try:
            if os.path.getmtime(path) < cutoff:
                os.remove(path)
                removed.append(path)
        except OSError:
            continue
    return removed


def archive_existing_rotated(log_dir=None, archive_subdir=None):
    """把历史遗留的裸轮转文件（*.log.N）补压为 .gz 并归档。

    只处理形如 app.log.1 / error.log.3 的裸轮转（跳过 .gz 与当前日志），
    压缩后删除源文件。返回成功压缩的文件数。
    """
    log_dir = log_dir or LOG_DIR
    archive_subdir = archive_subdir or LOG_ARCHIVE_SUBDIR
    archive_dir = os.path.join(log_dir, archive_subdir)
    os.makedirs(archive_dir, exist_ok=True)

    count = 0
    for name in sorted(os.listdir(log_dir)):
        if ".log." not in name or name.endswith(".gz"):
            continue
        src = os.path.join(log_dir, name)
        if not os.path.isfile(src):
            continue
        dest = os.path.join(archive_dir, name + ".gz")
        try:
            with open(src, "rb") as f_in, gzip.open(dest, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
            os.remove(src)
            count += 1
        except OSError:
            continue
    return count


_LOGGER = logging.getLogger(__name__)
_ALREADY_SETUP = False


def _schedule_retention(app):
    """生产环境注册每日定时清理（APScheduler 可用时）。失败静默降级。"""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        return False
    try:
        sched = BackgroundScheduler()
        sched.add_job(
            enforce_retention,
            "interval",
            hours=24,
            id="log_retention_cleanup",
            replace_existing=True,
            max_instances=1,
        )
        sched.start()
        if app is not None:
            app.logger.info("日志归档：定时清理已注册（每日执行）")
        return True
    except Exception:  # noqa: BLE001 - 调度器依赖缺失/启动失败均静默降级
        return False


def setup_log_archiving(app=None):
    """幂等启动钩子：补压历史裸轮转 + （生产）注册定时清理。

    create_app 启动时调用一次；多次调用安全（仅首次注册调度）。
    """
    global _ALREADY_SETUP
    # 启动即补压一次历史遗留裸轮转，回收既有磁盘占用
    try:
        archive_existing_rotated()
    except Exception as e:  # noqa: BLE001 - 补压失败不阻断应用启动
        _LOGGER.warning("日志归档：历史裸轮转补压失败: %s", e)

    if _ALREADY_SETUP:
        return
    _ALREADY_SETUP = True

    if app is None:
        return

    if app.config.get("FLASK_ENV") == "production":
        registered = _schedule_retention(app)
        if not registered:
            app.logger.warning(
                "日志归档：APScheduler 不可用，未注册定时清理；可手动运行 scripts/archive_logs.py"
            )
    else:
        app.logger.info("日志归档：开发/测试环境跳过定时清理；可手动运行 scripts/archive_logs.py")
