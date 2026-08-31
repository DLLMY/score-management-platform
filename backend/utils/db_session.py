from contextlib import contextmanager

import logging
from models import db

logger = logging.getLogger(__name__)


@contextmanager
def db_session_scope(auto_commit=True, detach=True):
    """事务作用域。

    detach=True（默认）：finally 中 session.remove() 销毁当前线程 session —— 仅适用于
    后台任务/独立写路径末尾（无后续 ORM 访问）。请求处理链中途调用的 service 必须传
    detach=False，否则调用方后续访问已提交 ORM 对象/g.current_user 抛 DetachedInstanceError
    （2026-08-20 已因此修复 composite_score_service / nlp_enhanced_service / user_service）。
    """
    from models import db
    from flask import current_app

    session = db.session
    try:
        yield session
        if auto_commit:
            session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Database transaction failed: {str(e)}", exc_info=True)
        raise
    finally:
        try:
            if detach and session.is_active and not (current_app and current_app.config.get("TESTING")):
                session.remove()
        except Exception as e:
            logger.debug("session.remove 清理失败（可忽略）: %s", e)


@contextmanager
def db_readonly_scope():

    session = db.session
    try:
        yield session
    except Exception as e:
        logger.error(f"Database read operation failed: {str(e)}", exc_info=True)
        raise


def with_db_session(func=None, auto_commit=True):

    def decorator(fn):

        def wrapper(*args, **kwargs):
            with db_session_scope(auto_commit=auto_commit):
                return fn(*args, **kwargs)

        return wrapper

    if func is not None:
        return decorator(func)
    return decorator


def with_db_readonly(func):

    def wrapper(*args, **kwargs):
        with db_readonly_scope():
            return func(*args, **kwargs)

    return wrapper
