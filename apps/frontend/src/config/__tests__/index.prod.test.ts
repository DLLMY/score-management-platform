import { describe, it, expect, vi } from 'vitest';
import * as Config from '../index';

// 生产环境分支覆盖：通过 mock 同源 env 访问器，让 config/index.ts 在导入时即构建生产配置。
// 该文件与 index.test.ts（开发环境）互为镜像，分别覆盖 createConfig / 派生函数的两套分支。
const env = vi.hoisted(() => {
  const envMap: Record<string, string> = {
    REACT_APP_APP_NAME: 'ProdApp',
    REACT_APP_API_URL: 'https://api.prod.com',
    REACT_APP_MQTT_BROKER: 'prod-broker',
    REACT_APP_MQTT_PORT: '8883',
    REACT_APP_MQTT_USE_TLS: 'true',
    REACT_APP_LOG_LEVEL: 'warn',
    REACT_APP_CSRF_ENABLED: 'false',
    REACT_APP_SECURE_COOKIES: 'false',
    REACT_APP_ANALYTICS_ENABLED: 'true',
    REACT_APP_PERFORMANCE_MONITORING: 'true',
    REACT_APP_ENABLE_DEV_TOOLS: 'false',
    REACT_APP_DEBUG_MODE: 'false',
    REACT_APP_ENABLE_CACHE: 'true',
    REACT_APP_WS_ENABLED: 'true',
  };
  const numMap: Record<string, number> = {
    REACT_APP_MQTT_PORT: 8883,
    REACT_APP_WS_RECONNECT_ATTEMPTS: 10,
    REACT_APP_WS_RECONNECT_DELAY: 3000,
    REACT_APP_API_TIMEOUT: 30000,
    REACT_APP_CACHE_TTL: 120000,
    PORT: 3000,
  };
  const boolMap: Record<string, boolean> = {
    REACT_APP_MQTT_USE_TLS: true,
    REACT_APP_WS_ENABLED: true,
    REACT_APP_ENABLE_CACHE: true,
    REACT_APP_ENABLE_DEV_TOOLS: false,
    REACT_APP_DEBUG_MODE: false,
    REACT_APP_CSRF_ENABLED: false,
    REACT_APP_SECURE_COOKIES: false,
    REACT_APP_ANALYTICS_ENABLED: true,
    REACT_APP_PERFORMANCE_MONITORING: true,
  };
  return {
    isProduction: true,
    isDevelopment: false,
    getEnv: vi.fn((k: string, d?: string) => envMap[k] ?? d ?? ''),
    getEnvNumber: vi.fn((k: string, d: number) => numMap[k] ?? d),
    getEnvBoolean: vi.fn((k: string, d: boolean) => (k in boolMap ? boolMap[k] : d)),
  };
});

vi.mock('../env', () => ({
  isProduction: env.isProduction,
  isDevelopment: env.isDevelopment,
  getEnv: env.getEnv,
  getEnvNumber: env.getEnvNumber,
  getEnvBoolean: env.getEnvBoolean,
}));

describe('config/index 生产环境分支', () => {
  it('createConfig：生产环境派生环境相关默认值', () => {
    const c = Config.createConfig();
    expect(c.app.environment).toBe('production');
    expect(c.app.isProduction).toBe(true);
    expect(c.app.isDevelopment).toBe(false);
    expect(c.mqtt.broker).toBe('prod-broker');
    expect(c.mqtt.port).toBe(8883);
    expect(c.mqtt.useTls).toBe(true);
    expect(c.devTools.enabled).toBe(false);
    expect(c.security.secureCookies).toBe(false);
    expect(c.performance.analyticsEnabled).toBe(true);
    expect(c.api.fullUrl).toBe('https://api.prod.com');
  });

  it('getMqttUrl：生产环境 useTls=true → wss 协议', () => {
    expect(Config.getMqttUrl()).toBe('wss://prod-broker:8883/mqtt');
  });

  it('getMqttUrl：path 为空时不拼接路径段', () => {
    const path = Config.config.mqtt.path;
    Config.config.mqtt.path = '';
    try {
      expect(Config.getMqttUrl()).toBe('wss://prod-broker:8883');
    } finally {
      Config.config.mqtt.path = path;
    }
  });

  it('getApiUrl：生产环境 fullUrl 优先返回', () => {
    expect(Config.getApiUrl()).toBe('https://api.prod.com');
  });

  it('getApiUrl：生产环境 fullUrl 缺失时回退 baseUrl', () => {
    const full = Config.config.api.fullUrl;
    const base = Config.config.api.baseUrl;
    Config.config.api.fullUrl = '';
    Config.config.api.baseUrl = 'https://base.example.com';
    try {
      expect(Config.getApiUrl()).toBe('https://base.example.com');
    } finally {
      Config.config.api.fullUrl = full;
      Config.config.api.baseUrl = base;
    }
  });

  it('getWebSocketUrl：生产环境无显式 baseUrl → 回退 window.location', () => {
    const base = Config.config.websocket.baseUrl;
    Config.config.websocket.baseUrl = '';
    try {
      const url = Config.getWebSocketUrl();
      expect(url.startsWith('ws:') || url.startsWith('wss:')).toBe(true);
    } finally {
      Config.config.websocket.baseUrl = base;
    }
  });

  it('validateConfig：生产环境（CSRF/安全Cookie 关闭）→ 输出 warning 级提醒且 valid=true', () => {
    const r = Config.validateConfig();
    expect(r.valid).toBe(true);
    expect(r.warnings.filter((w) => w.type === 'warning').length).toBeGreaterThan(0);
  });

  it('validateConfig：生产环境 API/MQTT 缺失 → 输出 error 级警告且 valid=false', () => {
    const apiFull = Config.config.api.fullUrl;
    const apiBase = Config.config.api.baseUrl;
    const broker = Config.config.mqtt.broker;
    Config.config.api.fullUrl = '';
    Config.config.api.baseUrl = '';
    Config.config.mqtt.broker = '';
    try {
      const r = Config.validateConfig();
      expect(r.valid).toBe(false);
      expect(r.warnings.some((w) => w.type === 'error')).toBe(true);
    } finally {
      Config.config.api.fullUrl = apiFull;
      Config.config.api.baseUrl = apiBase;
      Config.config.mqtt.broker = broker;
    }
  });

  it('logConfigSummary：生产环境直接早返（不抛错）', () => {
    expect(() => Config.logConfigSummary()).not.toThrow();
  });
});
