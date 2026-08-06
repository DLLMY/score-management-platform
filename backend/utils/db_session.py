from contextlib import contextmanager

import logging
from models import db

logger = logging.getLogger(__name__)


@contextmanager
def db_session_scope(auto_commit=True):
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
            if session.is_active and not (current_app and current_app.config.get("TESTING")):
                session.remove()
        except Exception:
            pass


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
