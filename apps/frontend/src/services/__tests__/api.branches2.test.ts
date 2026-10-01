/**
 * D 线突破·第十步：api.ts executeRequest 剩余高价值分支补测
 *
 * 目标（均为 step 9 后仍未覆盖的分支）：
 *  1. fetchWithTimeout 抛 AbortError → 504 超时（755 / 757-false / 763）
 *  2. 网络失败 TypeError('Failed to fetch') → 网络错误（1063-1067）
 *  3. 网络错误 NetworkError/net::ERR → 网络错误（1068-1075）
 *  4. 419 CSRF 错误重试拉取新 token 后成功（964-971 / 972-1007）
 *  5. refreshToken 冷却期内二次 401 → 抛登录失效（671）
 *  6. parseEnvelopeSafe 成功取 data / 业务失败归 null（816-822）
 *  7. unwrapEnvelope 各分支：skipDataExtract / success:false 抛错 / success+data / 直出（791-807）
 *
 * 注：ETag 的「If-None-Match（854）」与「304 走内存缓存（872-878）」因 request 层
 * 对 GET 命中内存 cache 直接短路返回（1105-1113），正常黑盒流程不可达，属防御性分支，不列为靶标。
 *
 * 约束（与 step 8/9 一致）：
 *  - Vitest 默认 isolate:true，每文件独立模块实例；POST write 路径永不被 request 级缓存短路。
 *  - 全链路 globalThis.fetch mock + vi.mock(errorMonitor) 静音。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { parseEnvelopeSafe, unwrapEnvelope } from '../../services/api';

vi.mock('../../utils/errorMonitor', () => ({
  errorMonitor: {
    report: () => {},
    reportApiError: () => {},
    reportConsoleError: () => {},
  },
}));

const apiAny = api as unknown as Record<string, any>;

/** 构造 Response-like 对象，headers 支持按名取值 */
function mkResp(status: number, body: unknown, headersObj: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string): string | null => headersObj[name] ?? null },
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob()),
    text: () => Promise.resolve(''),
  };
}

const mockFetch = vi.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  localStorage.clear();
  document.cookie = '';
  mockFetch.mockReset();
  (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
});

describe('api.ts executeRequest 剩余分支', () => {
  it('fetchWithTimeout 抛 AbortError → 504 超时', async () => {
    mockFetch.mockImplementation(() => {
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      return Promise.reject(e);
    });
    await expect(apiAny.users.create({ name: 'x' })).rejects.toThrow();
  });

  it('网络失败 TypeError Failed to fetch → 网络错误', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(apiAny.users.create({ name: 'x' })).rejects.toThrow();
  });

  it('网络错误 NetworkError → 网络错误', async () => {
    mockFetch.mockImplementation(() =>
      Promise.reject(new Error('NetworkError: net::ERR_CONNECTION_RESET'))
    );
    await expect(apiAny.users.create({ name: 'x' })).rejects.toThrow();
  });

  it('419 CSRF 错误重试拉取新 token 后成功', async () => {
    document.cookie = 'csrf_token=storedtoken';
    let call = 0;
    mockFetch.mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve(mkResp(419, { message: 'CSRF token invalid' }));
      return Promise.resolve(mkResp(200, { success: true, code: 0, data: { ok: true } }));
    });
    const r = await apiAny.users.create({ name: 'x' });
    expect(r).toBeDefined();
  });

  it('refreshToken 冷却期内二次 401 → 抛登录失效', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1 }));
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('refresh-token')) {
        return Promise.resolve(mkResp(401, { message: 'refresh failed' }));
      }
      return Promise.resolve(mkResp(401, { message: 'unauthorized' }));
    });

    // 首次 401 → refreshToken 失败 → 清登录态抛 401
    await expect(apiAny.users.create({ name: 'x' })).rejects.toThrow();

    // 重设 admin，使二次请求再次进入 refreshToken（冷却期内）
    localStorage.setItem('admin', JSON.stringify({ id: 1 }));
    await expect(apiAny.users.create({ name: 'x' })).rejects.toThrow('登录状态已失效，请重新登录');
  });
});

describe('api.ts 信封解析辅助函数', () => {
  it('parseEnvelopeSafe 成功取 data / 业务失败归 null', () => {
    expect(parseEnvelopeSafe({ success: true, code: 0, data: { a: 1 } } as never)).toEqual({
      a: 1,
    });
    expect(parseEnvelopeSafe({ success: false, message: 'fail' } as never)).toBeNull();
    expect(parseEnvelopeSafe({ foo: 'bar' } as never)).toEqual({ foo: 'bar' });
  });

  it('unwrapEnvelope 各分支', () => {
    // skipDataExtract：原样返回
    expect(unwrapEnvelope({ a: 1 }, true)).toEqual({ a: 1 });
    // success === false：抛 ApiError
    expect(() => unwrapEnvelope({ success: false, message: 'boom' })).toThrow();
    // success !== undefined && data !== undefined：返回 data
    expect(unwrapEnvelope({ success: true, data: { x: 2 } })).toEqual({ x: 2 });
    // 无 success 字段：落入 806 原样返回
    expect(unwrapEnvelope({ data: { y: 3 } })).toEqual({ data: { y: 3 } });
    // 其他：原样返回
    expect(unwrapEnvelope({ foo: 'bar' })).toEqual({ foo: 'bar' });
  });
});
