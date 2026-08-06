from sqlalchemy import event, inspect
from models import ClassInfo, User, Admin
from services.data_sync_service import DataSyncService
import logging

# \nSQLAlchemy 事件监听器\n
# 监听数据变更并触发同步
# (空行)
logger = logging.getLogger(__name__)
_sync_enabled = False


def get_old_value(target, attr_name):
    """使用 inspect 获取对象的旧值"""
    try:
        state = inspect(target)
        if state.has_changed(attr_name):
            return state.attrs[attr_name].history.deleted[0] if state.attrs[attr_name].history.deleted else None
    except Exception as e:
        logger.warning(f"Failed to get old value for {attr_name}: {e}")
    return None


def register_sync_events(app=None):
    """注册数据同步事件监听器"""
    global _sync_enabled
    if _sync_enabled:
        logger.info("Data sync events already registered")
        return

    @event.listens_for(ClassInfo, "before_update")
    def on_class_info_update(mapper, connection, target):
        old_name = get_old_value(target, "name")
        if old_name is not None:
            target._old_name = old_name

    @event.listens_for(ClassInfo, "after_update")
    def on_class_info_after_update(mapper, connection, target):
        old_name = getattr(target, "_old_name", None)
        new_name = target.name
        if old_name and old_name != new_name:
            DataSyncService.sync_class_name_change(target, old_name, new_name)

    @event.listens_for(ClassInfo, "after_insert")
    def on_class_info_insert(mapper, connection, target):
        DataSyncService.sync_new_class_creation(target)

    @event.listens_for(User, "before_update")
    def on_user_update(mapper, connection, target):
        old_class_name = get_old_value(target, "class_name")
        if old_class_name is not None:
            target._old_class_name = old_class_name

    @event.listens_for(User, "after_update")
    def on_user_after_update(mapper, connection, target):
        old_class_name = getattr(target, "_old_class_name", None)
        new_class_name = target.class_name
        if old_class_name != new_class_name:
            DataSyncService.sync_user_class_change(target, old_class_name, new_class_name)

    @event.listens_for(Admin, "before_update")
    def on_admin_update(mapper, connection, target):
        old_class_name = get_old_value(target, "class_name")
        if old_class_name is not None:
            target._old_class_name = old_class_name

    @event.listens_for(Admin, "after_update")
    def on_admin_after_update(mapper, connection, target):
        old_class_name = getattr(target, "_old_class_name", None)
        new_class_name = target.class_name
        if old_class_name != new_class_name:
            DataSyncService.sync_admin_class_change(target, old_class_name, new_class_name)

    _sync_enabled = True
    logger.info("Data sync events registered successfully")


def unregister_sync_events():
    """取消注册数据同步事件监听器"""
    global _sync_enabled
    _sync_enabled = False
    logger.info("Data sync events unregistered")
