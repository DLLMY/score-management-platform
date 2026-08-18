import logger from '../utils/logger';
/**
 * 前端统一配置管理模块
 * ======================
 * 集中管理所有前端配置项，确保配置的一致性与可维护性。
 *
 * 配置分类：
 * 1. 应用基础配置
 * 2. API配置
 * 3. MQTT配置
 * 4. 缓存配置
 * 5. 开发工具配置
 * 6. 安全配置
 *
 * 使用方式：
 * import { config, getConfig } from './config';
 * const apiUrl = config.api.baseUrl;
 */

/**
 * API配置接口
 */
/**
 * 环境变量读取辅助函数（统一从 ./env 访问器读取，兼容 CRA 与 Vite）
 */
import { getEnv, getEnvNumber, getEnvBoolean, isProduction as envIsProduction } from './env';

interface ApiConfig {
  baseUrl: string;
  fullUrl: string;
  timeout: number;
}

/**
 * MQTT配置接口
 */
interface MqttConfig {
  broker: string;
  port: number;
  useTls: boolean;
  path?: string;
}

/**
 * WebSocket配置接口
 */
interface WebSocketConfig {
  baseUrl: string;
  enabled: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
}

/**
 * 缓存配置接口
 */
interface CacheConfig {
  enabled: boolean;
  defaultTtl: number;
  ttl: {
    users: number;
    devices: number;
    notifications: number;
    rules: number;
    statistics: number;
    default: number;
  };
}

/**
 * 开发工具配置接口
 */
interface DevToolsConfig {
  enabled: boolean;
  debugMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 安全配置接口
 */
interface SecurityConfig {
  csrfEnabled: boolean;
  secureCookies: boolean;
}

/**
 * 性能监控配置接口
 */
interface PerformanceConfig {
  analyticsEnabled: boolean;
  monitoringEnabled: boolean;
}

/**
 * 完整配置接口
 */
export interface Config {
  // 应用基础配置
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production';
    isDevelopment: boolean;
    isProduction: boolean;
  };

  // API配置
  api: ApiConfig;

  // MQTT配置
  mqtt: MqttConfig;

  // WebSocket配置
  websocket: WebSocketConfig;

  // 缓存配置
  cache: CacheConfig;

  // 开发工具配置
  devTools: DevToolsConfig;

  // 安全配置
  security: SecurityConfig;

  // 性能监控配置
  performance: PerformanceConfig;

  // 服务器配置
  server: {
    host: string;
    port: number;
  };
}

/**
 * 创建配置对象
 */
export const createConfig = (): Config => {
  const environment = envIsProduction ? 'production' : 'development';
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';

  return {
    // 应用基础配置
    app: {
      name: getEnv('REACT_APP_APP_NAME', '积分管理平台'),
      version: getEnv('REACT_APP_APP_VERSION', '2.0.0'),
      environment,
      isDevelopment,
      isProduction,
    },

    // API配置
    api: {
      baseUrl: getEnv('REACT_APP_API_BASE_URL', ''),
      // 生产环境默认返回空字符串：请求路径已由 src/services/api.ts 自带 /api 前缀，
      // 由部署方的反向代理（nginx 等）负责把 /api 转发到后端。若返回 '/api' 会与
      // api.ts 的前缀拼成 '/api/api/...' 导致 404（旧默认值在生产环境恒为 404）。
      // 需要直连其他域名的后端时，用 REACT_APP_API_URL 指定绝对地址即可。
      fullUrl: getEnv('REACT_APP_API_URL', isDevelopment ? 'http://localhost:5000' : ''),
      timeout: getEnvNumber('REACT_APP_API_TIMEOUT', 30000),
    },

    // MQTT配置
    mqtt: {
      broker: getEnv('REACT_APP_MQTT_BROKER', isDevelopment ? 'localhost' : 'broker.hivemq.com'),
      port: getEnvNumber('REACT_APP_MQTT_PORT', isDevelopment ? 9001 : 8083),
      useTls: getEnvBoolean('REACT_APP_MQTT_USE_TLS', isProduction),
      path: '/mqtt',
    },

    // WebSocket配置
    websocket: {
      baseUrl: getEnv('REACT_APP_WS_URL', ''),
      enabled: getEnvBoolean('REACT_APP_WS_ENABLED', true),
      reconnectAttempts: getEnvNumber('REACT_APP_WS_RECONNECT_ATTEMPTS', 10),
      reconnectDelay: getEnvNumber('REACT_APP_WS_RECONNECT_DELAY', 3000),
    },

    // 缓存配置
    cache: {
      enabled: getEnvBoolean('REACT_APP_ENABLE_CACHE', true),
      defaultTtl: getEnvNumber('REACT_APP_CACHE_TTL', isDevelopment ? 60000 : 120000),
      ttl: {
        users: 60000, // 用户数据60秒
        devices: 5000, // 设备状态5秒
        notifications: 30000, // 通知30秒
        rules: 300000, // 规则5分钟
        statistics: 300000, // 统计数据5分钟
        default: 60000, // 默认60秒
      },
    },

    // 开发工具配置
    devTools: {
      enabled: getEnvBoolean('REACT_APP_ENABLE_DEV_TOOLS', isDevelopment),
      debugMode: getEnvBoolean('REACT_APP_DEBUG_MODE', isDevelopment),
      logLevel: getEnv('REACT_APP_LOG_LEVEL', isDevelopment ? 'debug' : 'error') as
        | 'debug'
        | 'info'
        | 'warn'
        | 'error',
    },

    // 安全配置
    security: {
      csrfEnabled: getEnvBoolean('REACT_APP_CSRF_ENABLED', true),
      secureCookies: getEnvBoolean('REACT_APP_SECURE_COOKIES', isProduction),
    },

    // 性能监控配置
    performance: {
      analyticsEnabled: getEnvBoolean('REACT_APP_ANALYTICS_ENABLED', isProduction),
      monitoringEnabled: getEnvBoolean('REACT_APP_PERFORMANCE_MONITORING', isProduction),
    },

    // 服务器配置
    server: {
      host: getEnv('HOST', '0.0.0.0'),
      port: getEnvNumber('PORT', 3000),
    },
  };
};

/**
 * 全局配置实例
 */
export const config = createConfig();

/**
 * 获取配置实例
 */
export const getConfig = (): Config => config;

/**
 * 获取完整的MQTT连接URL
 */
export const getMqttUrl = (): string => {
  const { broker, port, useTls, path } = config.mqtt;
  const protocol = useTls ? 'wss' : 'ws';
  const pathPart = path ? `/${path.replace(/^\//, '')}` : '';
  return `${protocol}://${broker}:${port}${pathPart}`;
};

/**
 * 获取WebSocket连接URL（基础地址，不含路径）
 */
export const getWebSocketUrl = (): string => {
  // 如果配置了明确的WS URL，直接使用
  if (config.websocket.baseUrl) {
    return config.websocket.baseUrl;
  }

  // 否则根据当前页面协议和主机名生成（不包含路径）
  // socket.io会自动处理路径，命名空间由调用方指定
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

/**
 * 获取完整的API基础URL
 */
export const getApiUrl = (): string => {
  // 开发环境使用空字符串，因为请求URL已包含/api前缀，代理会处理转发
  // 生产环境使用配置的完整URL或相对路径
  if (config.app.isDevelopment) {
    return '';
  }
  return config.api.fullUrl || config.api.baseUrl || '';
};

/**
 * 根据URL获取适当的缓存TTL
 */
export const getCacheTtlByUrl = (url: string): number => {
  if (url.includes('/api/devices') || url.includes('/api/device')) {
    return config.cache.ttl.devices;
  }
  if (url.includes('/api/notifications')) {
    return config.cache.ttl.notifications;
  }
  if (url.includes('/api/users') || url.includes('/api/user')) {
    return config.cache.ttl.users;
  }
  if (url.includes('/api/rules')) {
    return config.cache.ttl.rules;
  }
  if (
    url.includes('/api/statistics') ||
    url.includes('/api/analysis') ||
    url.includes('/api/dashboard')
  ) {
    return config.cache.ttl.statistics;
  }
  return config.cache.ttl.default;
};

/**
 * 验证配置
 */
export const validateConfig = (): {
  valid: boolean;
  warnings: Array<{ type: string; message: string }>;
} => {
  const warnings: Array<{ type: string; message: string }> = [];

  // 检查API配置
  if (!config.api.fullUrl && !config.api.baseUrl) {
    warnings.push({
      type: 'error',
      message: 'API URL配置缺失，请设置 REACT_APP_API_URL 或 REACT_APP_API_BASE_URL',
    });
  }

  // 检查MQTT配置
  if (!config.mqtt.broker) {
    warnings.push({
      type: 'error',
      message: 'MQTT Broker配置缺失，请设置 REACT_APP_MQTT_BROKER',
    });
  }

  // 开发环境警告
  if (config.app.isDevelopment) {
    warnings.push({
      type: 'info',
      message: '当前为开发环境配置',
    });
  }

  // 生产环境安全检查
  if (config.app.isProduction) {
    if (!config.security.csrfEnabled) {
      warnings.push({
        type: 'warning',
        message: '生产环境建议启用CSRF保护',
      });
    }
    if (!config.security.secureCookies) {
      warnings.push({
        type: 'warning',
        message: '生产环境建议启用安全Cookie',
      });
    }
  }

  return {
    valid: warnings.filter((w) => w.type === 'error').length === 0,
    warnings,
  };
};

/**
 * 获取配置摘要
 */
export const getConfigSummary = (): Record<string, unknown> => {
  return {
    app: {
      name: config.app.name,
      version: config.app.version,
      environment: config.app.environment,
    },
    api: {
      baseUrl: config.api.baseUrl,
      fullUrl: config.api.fullUrl,
      timeout: config.api.timeout,
    },
    mqtt: {
      broker: config.mqtt.broker,
      port: config.mqtt.port,
      useTls: config.mqtt.useTls,
      url: getMqttUrl(),
    },
    cache: {
      enabled: config.cache.enabled,
      defaultTtl: config.cache.defaultTtl,
    },
    security: {
      csrfEnabled: config.security.csrfEnabled,
      secureCookies: config.security.secureCookies,
    },
  };
};

/**
 * 打印配置摘要（开发环境）
 */
export const logConfigSummary = (): void => {
  if (!config.app.isDevelopment) return;

  logger.log('='.repeat(60));
  logger.log('前端配置摘要');
  logger.log('='.repeat(60));
  logger.log('应用:', config.app.name, 'v' + config.app.version);
  logger.log('环境:', config.app.environment);
  logger.log('API URL:', getApiUrl());
  logger.log('MQTT URL:', getMqttUrl());
  logger.log('缓存启用:', config.cache.enabled);
  logger.log('开发工具:', config.devTools.enabled);
  logger.log('='.repeat(60));
};

// 默认导出
export default config;
