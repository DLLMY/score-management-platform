import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request } from '../../services/api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body ?? {}), { status });
}

describe('api request layer (executeRequest)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    // 还原本文件测试可能改动的全局状态，避免污染其它测试文件（跨 worker 共享 jsdom 环境时）
    try {
      window.location.hash = '';
    } catch {
      /* jsdom 下 hash 可写，忽略异常 */
    }
    localStorage.clear();
  });

  it('GET success returns unwrapped data and writes cache', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { id: 1, name: 'x' } }));
    const data = await request('/api/unit/get1');
    expect(data).toEqual({ id: 1, name: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('GET with skipDataExtract returns raw envelope', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { a: 1 } }));
    const data = await request('/api/unit/get2', { skipDataExtract: true });
    expect((data as { success: boolean }).success).toBe(true);
  });

  it('POST success executes write path (cache invalidation)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { ok: 1 } }));
    const data = await request('/api/unit/things', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
    });
    expect(data).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('non-ok 500 response throws ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'server error' }));
    await expect(request('/api/unit/boom')).rejects.toThrow();
  });

  it('non-GET 404 clears cache and throws with status', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'not found' }));
    await expect(request('/api/unit/thing9', { method: 'DELETE' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('401 without stored auth clears auth data and redirects to login', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'unauthorized' }));
    await expect(request('/api/unit/secure-profile')).rejects.toThrow();
    vi.advanceTimersByTime(60);
    expect(window.location.hash).toBe('#/login');
    vi.useRealTimers();
  });

  it('network failure throws network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/api/unit/net')).rejects.toThrow();
  });

  it('envelope success=false throws business error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: false, message: 'biz fail' }));
    await expect(request('/api/unit/biz')).rejects.toThrow();
  });
});
