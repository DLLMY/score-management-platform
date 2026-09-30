import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAbortController,
  registerAbortController,
  removeAbortController,
  registerAbortCallback,
  abortAllRequests,
  isRequestAborted,
  clearAllEtagCache,
  getErrorMessage,
  unwrapEnvelope,
  parseEnvelopeSafe,
  getAuthHeaders,
  getCsrfToken,
  abortControllers,
} from '../api';

// 与既有 api.errors.test.ts 保持一致：静音 errorMonitor 与 logger，消除错误处理路径的噪音上报。
vi.mock('../../utils/errorMonitor', () => ({
  errorMonitor: { report: () => {}, reportApiError: () => {}, reportConsoleError: () => {} },
}));
vi.mock('../utils/logger', () => ({
  default: { warn: () => {}, log: () => {}, error: () => {}, info: () => {} },
}));

// jsdom 下 document.cookie='' 不会真正清除已有 cookie，需显式过期删除，避免用例间泄漏
function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
  document.cookie = '';
}

beforeEach(() => {
  abortControllers.clear();
  // 重置模块级 currentAbortCallback，避免跨用例泄漏
  registerAbortCallback(() => {});
  localStorage.clear();
  clearCookies();
});

describe('api.ts 独立纯工具函数', () => {
  // ── AbortController 工具 ──
  it('createAbortController 返回可用的 AbortController', () => {
    const c = createAbortController();
    expect(c).toBeInstanceOf(AbortController);
    expect(c.signal.aborted).toBe(false);
  });

  it('registerAbortController 注册后 isRequestAborted 反映 abort 状态', () => {
    const c = createAbortController();
    registerAbortController('req-1', c);
    expect(abortControllers.has('req-1')).toBe(true);
    expect(isRequestAborted()).toBe(false);
    c.abort();
    expect(isRequestAborted()).toBe(true);
  });

  it('removeAbortController 从注册表移除', () => {
    const c = createAbortController();
    registerAbortController('req-2', c);
    removeAbortController('req-2');
    expect(abortControllers.has('req-2')).toBe(false);
    expect(isRequestAborted()).toBe(false);
  });

  it('abortAllRequests 中止全部并清空注册表，且触发已注册的回调', () => {
    const c1 = createAbortController();
    const c2 = createAbortController();
    registerAbortController('a', c1);
    registerAbortController('b', c2);
    const cb = vi.fn();
    registerAbortCallback(cb);

    abortAllRequests();

    expect(c1.signal.aborted).toBe(true);
    expect(c2.signal.aborted).toBe(true);
    expect(abortControllers.size).toBe(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('abortAllRequests 无回调时不抛错', () => {
    const c = createAbortController();
    registerAbortController('c', c);
    registerAbortCallback(undefined as unknown as () => void);
    expect(() => abortAllRequests()).not.toThrow();
    expect(c.signal.aborted).toBe(true);
  });

  it('isRequestAborted 在空注册表时返回 false', () => {
    expect(abortControllers.size).toBe(0);
    expect(isRequestAborted()).toBe(false);
  });

  // ── ETag 缓存 ──
  it('clearAllEtagCache 清空持久化 ETag 缓存键', () => {
    localStorage.setItem(
      'api_etag_cache',
      JSON.stringify({ k: { etag: 'v', timestamp: 1, ttl: 1 } })
    );
    clearAllEtagCache();
    expect(localStorage.getItem('api_etag_cache')).toBeNull();
  });

  // ── getErrorMessage 多分支 ──
  it('error_code 命中友好文案表（最高优先级）', () => {
    expect(getErrorMessage(500, { error_code: 'NOT_FOUND' })).toBe('请求的资源不存在');
  });

  it('后端 message 非技术性错误 → 透传业务文案', () => {
    expect(getErrorMessage(400, { message: '密码错误，请重试' })).toBe('密码错误，请重试');
  });

  it('后端 message 技术性错误 → 屏蔽并回退 HTTP 状态文案', () => {
    expect(getErrorMessage(500, { message: 'KeyError: "field" in module.py line 12' })).toBe(
      '服务器内部错误，请稍后重试'
    );
  });

  it('无 message 时按已知 HTTP 状态回退', () => {
    expect(getErrorMessage(404, {})).toBe('请求的资源不存在');
  });

  it('无 message 且状态未知 → 通用兜底文案', () => {
    expect(getErrorMessage(418, {})).toBe('请求失败 (418)');
  });

  it('error 字段优先于 message 透传（非技术性）', () => {
    expect(getErrorMessage(400, { error: '自定义错误文案' })).toBe('自定义错误文案');
  });

  // ── unwrapEnvelope / parseEnvelopeSafe ──
  it('unwrapEnvelope skipDataExtract=true 原样返回', () => {
    const raw = { success: false, message: '失败' };
    expect(unwrapEnvelope(raw, true)).toBe(raw);
  });

  it('unwrapEnvelope success=false → 抛 ApiError（status 200 / type business）', () => {
    expect(() => unwrapEnvelope({ success: false, message: '业务失败' })).toThrow('业务失败');
    try {
      unwrapEnvelope({ success: false, message: '业务失败' });
    } catch (e) {
      const err = e as { status?: number; type?: string };
      expect(err.status).toBe(200);
      expect(err.type).toBe('business');
    }
  });

  it('unwrapEnvelope success+data 存在 → 返回 data', () => {
    expect(unwrapEnvelope({ success: true, code: 0, data: { id: 1 } })).toEqual({ id: 1 });
  });

  it('unwrapEnvelope 无 success 字段（直出对象）→ 原样返回', () => {
    const raw = { id: 7, name: 'x' };
    expect(unwrapEnvelope(raw)).toBe(raw);
  });

  it('parseEnvelopeSafe success+data → 返回 data', () => {
    expect(parseEnvelopeSafe<{ id: number }>({ success: true, data: { id: 9 } })).toEqual({
      id: 9,
    });
  });

  it('parseEnvelopeSafe success=false → 捕获异常返回 null', () => {
    expect(parseEnvelopeSafe({ success: false, message: '失败' })).toBeNull();
  });

  it('parseEnvelopeSafe 非信封对象 → 原样返回', () => {
    const raw = { foo: 'bar' };
    expect(parseEnvelopeSafe(raw)).toEqual(raw);
  });

  it('parseEnvelopeSafe null 输入 → 返回 null', () => {
    expect(parseEnvelopeSafe(null)).toBeNull();
  });

  // ── getAuthHeaders ──
  it('无 CSRF token 时仅返回扩展头', () => {
    expect(getAuthHeaders({ 'X-Custom': '1' })).toEqual({ 'X-Custom': '1' });
  });

  it('存在 csrf_token cookie 时注入 X-CSRFToken', () => {
    document.cookie = 'csrf_token=abc123';
    const headers = getAuthHeaders();
    expect(headers['X-CSRFToken']).toBe('abc123');
  });

  it('extra 已含 X-CSRFToken 时不覆盖', () => {
    document.cookie = 'csrf_token=abc123';
    const headers = getAuthHeaders({ 'X-CSRFToken': 'existing' });
    expect(headers['X-CSRFToken']).toBe('existing');
  });

  it('无 extra 且无 cookie 时返回空对象', () => {
    expect(getAuthHeaders()).toEqual({});
  });

  // ── getCsrfToken（从 cookie 解析，纯函数）──
  it('getCsrfToken 读取 csrf_token cookie 值', () => {
    document.cookie = 'csrf_token=xyz789';
    expect(getCsrfToken()).toBe('xyz789');
  });

  it('getCsrfToken 无 csrf_token 时返回 null', () => {
    document.cookie = 'other=1';
    expect(getCsrfToken()).toBeNull();
  });

  it('getCsrfToken 在多 cookie 中正确提取 csrf_token', () => {
    // jsdom：document.cookie 每次赋值只接受单条 cookie，用 ; 分隔会被当作属性而非多 cookie
    document.cookie = 'a=1';
    document.cookie = 'csrf_token=abc';
    document.cookie = 'b=2';
    expect(getCsrfToken()).toBe('abc');
  });
});
