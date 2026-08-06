import logging
import traceback
from functools import wraps
from typing import Callable, Any

import time

logger = logging.getLogger(__name__)


def service_handler(return_dict: bool = True):

    def decorator(func: Callable) -> Callable:

        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.error(f"服务方法执行失败: {func.__name__}\n{traceback.format_exc()}")
                if return_dict:
                    return {"success": False, "message": str(e)}
                raise

        return wrapper

    return decorator


def db_handler(rollback_on_error: bool = True):

    def decorator(func: Callable) -> Callable:

        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except Exception:
                logger.error(f"数据库操作失败: {func.__name__}\n{traceback.format_exc()}")
                if rollback_on_error:
                    from models import db

                    try:
                        db.session.rollback()
                    except Exception as rollback_e:
                        logger.error(f"回滚失败: {rollback_e}")
                raise

        return wrapper

    return decorator


def api_handler(func: Callable) -> Callable:

    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"API处理失败: {func.__name__}\n{traceback.format_exc()}")
            from utils.response import APIResponse

            return APIResponse.server_error(str(e))

    return wrapper


def retry_on_failure(max_retries: int = 3, delay: float = 1.0, exceptions: tuple = (Exception,)):

    def decorator(func: Callable) -> Callable:

        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    logger.warning(f"操作失败，第 {attempt + 1}/{max_retries} 次尝试: {e}")
                    if attempt < max_retries - 1:

                        time.sleep(delay * (attempt + 1))
            logger.error(f"操作失败，已达到最大重试次数 {max_retries}")
            raise last_exception

        return wrapper

    return decorator


__all__ = ["service_handler", "db_handler", "api_handler", "retry_on_failure"]
