"""通知配置持久化存取。

背景：原实现将微信/短信通知配置写入 current_app.config（内存），进程重启即丢失。
本模块提供：
- load_notification_config_to_app(app)：启动时从 notification_config 表回灌 current_app.config
  （DB 有值则覆盖环境默认；表不存在/异常时静默退化，沿用环境默认，不影响启动）。
- save_notification_config(updates)：将配置写入 notification_config 表（单行 id=1 upsert），
  供 routes 在更新配置时调用；同时调用方需自行同步 current_app.config 保证运行期一致。

设计原则：NotificationService 与既有 routes 的读取逻辑（current_app.config.get）保持不变，
持久化只落在"加载"与"保存"两个切点上。
"""

from flask import current_app
from models import db
from models.notification_config import NotificationConfig


from utils.logger import log_info, log_warning, log_debug
def _apply_row_to_config(row):
    """将 DB 行的配置键值合并进 current_app.config（非 None 字段才覆盖）。"""
    cfg = row.to_config_dict()
    for key, value in cfg.items():
        if value is None:
            continue
        if key == "SMS_CONFIG":
            # SMS_CONFIG 为嵌套 dict，合并而非整体覆盖，保留其它默认键
            merged = dict(current_app.config.get("SMS_CONFIG", {}) or {})
            merged.update({k: v for k, v in value.items() if v is not None})
            current_app.config["SMS_CONFIG"] = merged
        else:
            current_app.config[key] = value


def load_notification_config_to_app(app):
    """启动时加载通知配置到 current_app.config；失败静默退化（沿用环境默认）。"""
    try:
        with app.app_context():
            row = NotificationConfig.query.get(1)
            if row is None:
                log_info("通知配置：无持久化记录，沿用环境默认")
                return
            _apply_row_to_config(row)
            log_info("通知配置：已从数据库加载")
    except Exception as e:  # noqa: BLE001
        log_warning(f"通知配置加载失败(沿用环境默认): {e}", exception=e)


def save_notification_config(updates):
    """将配置更新写入 notification_config 表（单行 upsert, id=1）。

    :param updates: dict，键为 NotificationConfig 的列名（如 wechat_appid）
    :return: (ok, error_msg)
    """
    try:
        row = NotificationConfig.query.get(1)
        if row is None:
            row = NotificationConfig(id=1)
        for key, value in updates.items():
            if hasattr(row, key) and value is not None:
                setattr(row, key, value)
        db.session.add(row)
        db.session.commit()
        return True, None
    except Exception as e:  # noqa: BLE001
        db.session.rollback()
        log_warning(f"通知配置落库失败: {e}", exception=e)
        return False, str(e)
