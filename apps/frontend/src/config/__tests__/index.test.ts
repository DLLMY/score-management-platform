import { describe, it, expect } from 'vitest';
import * as Config from '../index';

// 该模块在导入时即构建 config 单例（读取 import.meta.env 默认值）。
// 以下测试只验证「由已构建 config 派生的纯函数」，不依赖具体环境变量值，
// 因此无需 mock env —— 只断言可推导的结构与分支行为。

describe('config/index 派生纯函数', () => {
  it('getMqttUrl 组合协议/broker/port/path', () => {
    const url = Config.getMqttUrl();
    // 默认开发环境：broker=localhost, port=9001, useTls=false, path=/mqtt
    expect(url).toBe('ws://localhost:9001/mqtt');
  });

  it('getApiUrl 开发环境返回空串（请求自带 /api 前缀由代理转发）', () => {
    expect(Config.getApiUrl()).toBe('');
  });

  it('getWebSocketUrl 默认回退到 window.location 协议+host', () => {
    const url = Config.getWebSocketUrl();
    expect(url.startsWith('ws:') || url.startsWith('wss:')).toBe(true);
  });

  it('getWebSocketUrl 显式 baseUrl 优先', () => {
    // 验证分支：设置了 websocket.baseUrl 时直接返回
    const original = Config.config.websocket.baseUrl;
    Config.config.websocket.baseUrl = 'wss://example.com/socket';
    try {
      expect(Config.getWebSocketUrl()).toBe('wss://example.com/socket');
    } finally {
      Config.config.websocket.baseUrl = original;
    }
  });

  it('getCacheTtlByUrl 按路径匹配对应 TTL', () => {
    const ttl = Config.config.cache.ttl;
    expect(Config.getCacheTtlByUrl('/api/devices/1')).toBe(ttl.devices);
    expect(Config.getCacheTtlByUrl('/api/notifications')).toBe(ttl.notifications);
    expect(Config.getCacheTtlByUrl('/api/users')).toBe(ttl.users);
    expect(Config.getCacheTtlByUrl('/api/rules')).toBe(ttl.rules);
    expect(Config.getCacheTtlByUrl('/api/statistics')).toBe(ttl.statistics);
    expect(Config.getCacheTtlByUrl('/api/dashboard')).toBe(ttl.statistics);
    expect(Config.getCacheTtlByUrl('/api/analysis')).toBe(ttl.statistics);
    expect(Config.getCacheTtlByUrl('/api/unknown')).toBe(ttl.default);
  });

  it('validateConfig 无 error 项时 valid=true', () => {
    const r = Config.validateConfig();
    // 测试环境为开发环境：只会有 info 警告，不应有 error
    expect(r.valid).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it('getConfigSummary 返回含 app/api/mqtt/cache/security 的结构', () => {
    const s = Config.getConfigSummary();
    expect(s).toHaveProperty('app');
    expect(s).toHaveProperty('api');
    expect(s).toHaveProperty('mqtt');
    expect(s).toHaveProperty('cache');
    expect(s).toHaveProperty('security');
    expect((s.mqtt as Record<string, unknown>).url).toBe(Config.getMqttUrl());
  });

  it('getConfig 返回与导出 config 同一实例', () => {
    expect(Config.getConfig()).toBe(Config.config);
  });

  it('createConfig 可独立创建新配置实例（不影响全局单例）', () => {
    const c = Config.createConfig();
    expect(c.app.name).toBeTruthy();
    expect(c.api).toHaveProperty('timeout');
    expect(c).not.toBe(Config.config);
  });

  it('logConfigSummary 在开发环境调用不抛（仅打印）', () => {
    expect(() => Config.logConfigSummary()).not.toThrow();
  });
});
