import hashlib
import json
import logging
from functools import wraps

from flask import g, jsonify, make_response, request

from config.config_loader import config_loader
from services.redis_cache_service import get_cache_service

logger = logging.getLogger(__name__)

DEFAULT_CACHE_TTL = config_loader.get_config("CACHE_TTL", {}).get("default", 60)
API_CACHE_TTL = config_loader.get_config("API_CACHE_TTL", 300)


def _cache_user_dimension():
    """提取缓存键的用户维度（user_id + role），独立于装饰器执行顺序，杜绝跨用户缓存越权读取。

    - 优先：g.current_user（requires_permission / requires_role 已挂载的已认证管理员）；
    - 降级：直接从 Authorization Bearer 头解码 JWT（utils.security.decode_token），
      与装饰器顺序无关，保证缓存键始终含用户身份；
    - 无认证请求归为 'anon'（与 RBAC 无关的公共端点共享缓存，可接受）。
    """
    cu = getattr(g, "current_user", None)
    if cu is not None:
        return str(getattr(cu, "id", "anon")), str(getattr(cu, "role", "anon"))
    try:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            # 延迟导入，规避与 utils.security 的循环依赖
            from utils.security import decode_token

            payload = decode_token(auth.replace("Bearer ", "", 1))
            if payload and "sub" in payload:
                return str(payload["sub"]), str(payload.get("role", "anon"))
    except Exception:
        pass
    return "anon", "anon"


def generate_cache_key(prefix="api"):
    """
    生成API缓存键
    基于请求方法、路径、查询参数与【当前用户身份】生成唯一缓存键。
    Args:
        prefix: 缓存键前缀
    Returns:
        缓存键字符串
    """
    # 获取请求信息
    method = request.method
    path = request.path
    # 获取查询参数（排除某些动态参数）
    args = dict(request.args)
    # 移除时间戳等动态参数
    dynamic_params = ["_", "timestamp", "t", "nocache"]
    for param in dynamic_params:
        args.pop(param, None)
    # 用户维度：将 user_id/role 纳入键，防止返回与当前用户相关数据的 GET 端点
    # 在 Redis / 多 gunicorn worker 下出现跨用户缓存越权读取（与 RBAC / 班级隔离铁律一致）。
    uid, role = _cache_user_dimension()
    # 生成唯一键
    data = f"{method}:{path}:{json.dumps(args, sort_keys=True)}:{uid}:{role}"
    hash_key = hashlib.sha256(data.encode()).hexdigest()
    return f"{prefix}:{path}:{hash_key}"


def get_ttl_for_path(path):
    """
    根据API路径获取缓存TTL
    Args:
        path: API路径
    Returns:
        TTL秒数
    """
    # API_CACHE_TTL 必须是一个 dict（精确/前缀映射）；配置缺失或不是 dict 时回退默认 TTL，
    # 避免 `path in 300` / `300.items()` 之类的 TypeError 导致整条请求链路崩溃。
    api_ttl = API_CACHE_TTL
    if not isinstance(api_ttl, dict):
        return DEFAULT_CACHE_TTL
    # 检查精确匹配
    if path in api_ttl:
        return api_ttl[path]
    # 检查前缀匹配
    for api_path, ttl in api_ttl.items():
        if path.startswith(api_path):
            return ttl
    return DEFAULT_CACHE_TTL


def _extract_response_data(result):
    # 统一提取 data 与 status_code，兼容多种返回约定
    if hasattr(result, "get_json"):
        return result.get_json(), result.status_code
    if isinstance(result, tuple) and len(result) == 2 and isinstance(result[1], int):
        # 本项目 APIResponse 约定：(data_dict, status_code)
        return result
    return result, 200


def _safe_cache_get(cache, cache_key):
    """读取缓存，失败仅降级回源并留痕（T9 基础设施层日志化）。"""
    try:
        return cache.get(cache_key)
    except Exception as e:
        logger.warning(f"读取API缓存失败，降级回源 key={cache_key}: {e}", exc_info=True)
        return None


def _safe_cache_set(cache, cache_key, response_data, cache_ttl):
    """写入缓存，失败仅降级不阻断响应，但留痕（T9 基础设施层日志化）。"""
    try:
        cache.set(cache_key, response_data, ttl=cache_ttl)
    except Exception as e:
        logger.warning(f"写入API缓存失败 key={cache_key}: {e}", exc_info=True)



def cached_api(ttl=None, key_prefix="api", unless=None):
    """
    API缓存装饰器
    用于缓存GET请求的响应，减少重复数据库查询。

    兼容本项目响应约定：
      - APIResponse.success/error 返回 (data_dict, status_code) 元组；
      - 也可直接返回 Flask Response 或裸 dict/list。
    仅对成功的（status==200）响应做缓存；缓存不可用时（降级内存/无 Redis）
    自动穿透到原函数，不影响业务。

    Args:
        ttl: 缓存时间（秒），如果不指定则根据路径自动获取
        key_prefix: 缓存键前缀
        unless: 条件函数，返回True时不缓存
    """

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # 只缓存GET请求
            if request.method != "GET":
                return f(*args, **kwargs)
            # 检查条件函数
            if unless and unless():
                return f(*args, **kwargs)
            # 跳过缓存：前端显式传 skip_cache=true 时（如写操作后 reload）
            if request.args.get("skip_cache", "").lower() == "true":
                result = f(*args, **kwargs)
                response_data, status_code = _extract_response_data(result)
                response = make_response(jsonify(response_data), status_code)
                response.headers["X-Cache"] = "BYPASS"
                return response
            # 获取缓存服务
            cache = get_cache_service()
            if not cache:
                return f(*args, **kwargs)
            # 生成缓存键
            cache_key = generate_cache_key(key_prefix)
            # 确定TTL
            cache_ttl = ttl if ttl is not None else get_ttl_for_path(request.path)
            cached_response = _safe_cache_get(cache, cache_key)
            if cached_response is not None:
                # 返回缓存的响应
                response = make_response(jsonify(cached_response))
                response.headers["X-Cache"] = "HIT"
                response.headers["X-Cache-TTL"] = str(cache_ttl)
                return response
            # 执行原函数
            result = f(*args, **kwargs)
            # 统一提取 data 与 status_code，兼容多种返回约定
            response_data, status_code = _extract_response_data(result)
            # 只缓存成功的响应，且避免缓存空响应
            if status_code == 200 and response_data:
                _safe_cache_set(cache, cache_key, response_data, cache_ttl)
            # 返回响应
            response = make_response(jsonify(response_data), status_code)
            response.headers["X-Cache"] = "MISS"
            response.headers["X-Cache-TTL"] = str(cache_ttl)
            return response

        return wrapper

    return decorator


def invalidate_cache(path_pattern=None):
    """
    缓存失效函数
    当数据变更时，清除相关的API缓存。
    Args:
        path_pattern: 路径模式（可选），如 '/api/users/*' 或 'api:/api/users/*' 清除所有用户相关缓存
    使用示例:
        invalidate_cache('/api/users/*')  # 清除所有用户缓存
        invalidate_cache()                # 清除所有API缓存
    注意: cached_api 的键格式为 `api:{path}:{hash}`，此处必须确保最终 pattern 以 `api:` 开头，
          且不要重复拼接 `api:` 前缀（历史 bug：曾拼成 `api:api:/api/...` 导致按前缀失效永不命中）。
    """
    cache = get_cache_service()
    if not cache:
        return
    if path_pattern:
        # 兼容两种传法：'/api/users/*' 与 'api:/api/users/*'
        pattern = path_pattern if path_pattern.startswith("api:") else f"api:{path_pattern}"
        # 修复（2026-08-20 系统性根治）：cache key 格式为 `api:{path}:{sha256}`（冒号分隔），
        # 历史 pattern 形如 `api:/api/users/*`（尾斜杠+*），而 key 是 `api:/api/users:hash`——
        # `users/` ≠ `users:`，前缀永不匹配 → **手动 invalidate 从未真正生效**（幽灵/过期缓存
        # 反复出现的总根源）。统一归一为去尾斜杠/尾星后的单星：`api:/api/users*` 匹配
        # `api:/api/users:hash`。
        clean = pattern.removesuffix("*")  # 去掉已有尾 *
        clean = clean.rstrip("/")  # 去尾斜杠
        cache.flush(clean + "*")
    else:
        # 清除所有API缓存
        cache.flush("api:*")


def invalidate_user_cache(user_id):
    """
    清除用户相关缓存
    Args:
        user_id: 用户ID
    """
    invalidate_cache("/api/users/*")


def invalidate_device_cache(device_id):
    """
    清除设备相关缓存
    Args:
        device_id: 设备ID
    """
    invalidate_cache("/api/devices/*")


def invalidate_rule_cache(rule_id):
    """
    清除规则相关缓存
    Args:
        rule_id: 规则ID
    """
    invalidate_cache("/api/rules/*")


def setup_cache_middleware(app):
    """
    设置Flask缓存中间件
    Args:
        app: Flask应用实例
    """

    @app.after_request
    def after_request_cache(response):
        """请求后处理"""
        if "X-Cache" not in response.headers:
            response.headers["X-Cache"] = "BYPASS"
        return response
