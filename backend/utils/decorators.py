"""路由层统一异常处理装饰器（B4 公共逻辑提取 2026-08-22）。

收敛各路由重复的 `try/except → APIResponse.error` 样板。把未捕获异常统一转成标准错误信封，
避免异常逃逸导致返回非信封格式（破坏前端 envelope 解析）或裸 500。

设计要点：
- 透传 werkzeug HTTPException（401/403/404 等），交给 Flask 既有错误处理器，保持原语义；
- 业务自定义异常若带 `code` / `status_code` / `message` 属性则透传，否则用默认 500 信封；
- 仅包装「真实异常」，正常返回路径零侵入（success 响应原样返回）。

用法：
    from utils.decorators import safe_handle

    class XResource(Resource):
        @safe_handle()                      # 默认 500 + 异常文案
        @safe_handle(message="计算失败")     # 固定错误文案（对齐原 except 分支）
        def get(self):
            ...
"""

import functools
import logging

from werkzeug.exceptions import HTTPException

from utils.response import APIResponse

logger = logging.getLogger(__name__)


def safe_handle(default_status=500, log_trace=True, message=None):
    """包装路由方法：捕获非 HTTP 异常，返回标准错误信封。

    - default_status：错误响应状态码（⚠️ 与原 `APIResponse.error(...)` 默认 400 对齐时须显式传 400）
    - message：固定错误文案；不传时回退异常自带 message，最后回退 '服务器内部错误'
      （传固定文案可避免 str(e) 泄露异常细节，与既有"不直返异常细节"修复一致）
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except HTTPException:
                # 401/403/404 等交给 Flask 错误处理器，维持既有语义（含鉴权中间件）
                raise
            except Exception as e:  # noqa: BLE001
                name = getattr(func, "__qualname__", getattr(func, "__name__", "?"))
                if log_trace:
                    logger.exception("路由 %s 执行异常", name)
                else:
                    logger.error("路由 %s 执行异常: %s", name, e)
                code = getattr(e, "code", -1)
                status = getattr(e, "status_code", default_status)
                error_message = (
                    message
                    or getattr(e, "message", None)
                    or str(e)
                    or "服务器内部错误"
                )
                return APIResponse.error(message=error_message, code=code, status_code=status)

        return wrapper

    return decorator
