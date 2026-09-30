import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '../useNetworkStatus';

describe('useNetworkStatus · 在线状态 / 连接信息', () => {
  afterEach(() => {
    // @ts-expect-error 还原 navigator.connection
    delete navigator.connection;
    vi.restoreAllMocks();
  });

  it('默认 isOnline 跟随 navigator.onLine，离线/在线事件切换', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(navigator.onLine);

    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.isOnline).toBe(false);

    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current.isOnline).toBe(true);
  });

  it('存在 navigator.connection 时读取连接类型（change 事件更新）', () => {
    const conn = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(navigator, 'connection', {
      value: conn,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.connectionType).toBe('4g');
    expect(result.current.downlink).toBe(10);
    expect(result.current.rtt).toBe(50);
  });

  it('connection 存在但 effectiveType 缺失/为空：connectionType 回退 unknown，其余字段回退 null', () => {
    const conn = {
      effectiveType: '',
      downlink: undefined,
      rtt: undefined,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(navigator, 'connection', {
      value: conn,
      configurable: true,
    });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.connectionType).toBe('unknown');
    expect(result.current.effectiveType).toBeNull();
    expect(result.current.downlink).toBeNull();
    expect(result.current.rtt).toBeNull();
  });

  it('无 navigator.connection：connectionType/effectiveType/downlink/rtt 全为 null（不读取连接信息）', () => {
    // @ts-expect-error 删除 connection 以触发 if(connection) 的 false 分支
    delete navigator.connection;
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.connectionType).toBeNull();
    expect(result.current.effectiveType).toBeNull();
    expect(result.current.downlink).toBeNull();
    expect(result.current.rtt).toBeNull();
  });
});
