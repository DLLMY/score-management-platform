"""
Utils - 工具函数模块

导出常用的工具函数和类
"""

from utils.validation import (
    ValidationRules,
    validate_card_id,
    validate_phone,
    validate_email,
    validate_score,
    validate_id,
    validate_username,
    validate_password,
    validate_mac_address,
    validate_ip_address,
    validate_positive_int,
    validate_enum,
    success_response,
    error_response,
    validation_error_response,
)
from utils.rate_limit import (
    RateLimitStrategy,
    default_limiter,
    rate_limit,
    login_rate_limit,
    admin_rate_limit,
    mqtt_rate_limit,
    query_rate_limit,
    mutation_rate_limit,
)
from utils.smart_reconnect import (
    SmartReconnect,
    SmartReconnectConfig,
    ReconnectStrategy,
    NetworkStatus,
    get_smart_reconnect,
)
from utils.batch_writer import (
    BatchWriter,
    BatchWriteConfig,
    MQTTLogBatchWriter,
    OperationLogBatchWriter,
    get_mqtt_log_writer,
    get_operation_log_writer,
    shutdown_all_writers,
    optimize_batch_size,
)
from utils.cache import (
    CacheEntry,
    ResponseCache,
    get_default_cache,
    cached,
    invalidate_cache,
    CacheWarmer,
    clear_cache,
    get_cache_stats,
)
from utils.db_optimizer import (
    QueryMetrics,
    QueryProfiler,
    profile_query,
    batch_query,
    batch_update,
    get_query_explain,
    IndexSuggestion,
    ConnectionPoolOptimizer,
)

__all__ = [
    # Validation
    "ValidationRules",
    "validate_card_id",
    "validate_phone",
    "validate_email",
    "validate_score",
    "validate_id",
    "validate_username",
    "validate_password",
    "validate_mac_address",
    "validate_ip_address",
    "validate_positive_int",
    "validate_enum",
    "success_response",
    "error_response",
    "validation_error_response",
    # Rate Limit
    "RateLimitStrategy",
    "default_limiter",
    "rate_limit",
    "login_rate_limit",
    "admin_rate_limit",
    "mqtt_rate_limit",
    "query_rate_limit",
    "mutation_rate_limit",
    # Smart Reconnect
    "SmartReconnect",
    "SmartReconnectConfig",
    "ReconnectStrategy",
    "NetworkStatus",
    "get_smart_reconnect",
    # Batch Writer
    "BatchWriter",
    "BatchWriteConfig",
    "MQTTLogBatchWriter",
    "OperationLogBatchWriter",
    "get_mqtt_log_writer",
    "get_operation_log_writer",
    "shutdown_all_writers",
    "optimize_batch_size",
    # Cache
    "CacheEntry",
    "ResponseCache",
    "get_default_cache",
    "cached",
    "invalidate_cache",
    "CacheWarmer",
    "clear_cache",
    "get_cache_stats",
    # DB Optimizer
    "QueryMetrics",
    "QueryProfiler",
    "profile_query",
    "batch_query",
    "batch_update",
    "get_query_explain",
    "IndexSuggestion",
    "ConnectionPoolOptimizer",
]
