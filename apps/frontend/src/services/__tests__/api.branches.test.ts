import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '../api';

// 静音 ErrorMonitor：错误处理测试的上报日志是噪音（api 封装错误时主动 report）
vi.mock('../../utils/errorMonitor', () => ({
  errorMonitor: { report: () => {}, reportApiError: () => {}, reportConsoleError: () => {} },
}));

const mockFetch = vi.fn();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

function env(data: unknown, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (): string | null => null },
    json: () => Promise.resolve({ success: true, code: 0, data, ...extra }),
  };
}

function errEnv(status: number, body: unknown) {
  return {
    ok: false,
    status,
    headers: { get: (): string | null => null },
    json: () => Promise.resolve(body),
  };
}

function etagEnv(data: unknown, etag = '"v1"') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string): string | null => (h === 'ETag' ? etag : null) },
    json: () => Promise.resolve({ success: true, code: 0, data }),
  };
}

function failEnv(message: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: (): string | null => null },
    json: () => Promise.resolve({ success: false, code: 1, message, data: null }),
  };
}

const CREATE_BODY = { name: 'x', card_id: '12345678' } as unknown as Parameters<
  typeof api.users.create
>[0];

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
  // 尽力清理 csrf cookie（部分测试需要，部分不需要）
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('api.ts executeRequest 边缘/错误分支（第九步补测）', () => {
  it('GET 成功且带 ETag 头 → 写入 etag 缓存（extractAndCacheEtag + saveEtagCache）', async () => {
    mockFetch.mockResolvedValue(etagEnv([]));
    const res = await api.users.getAll({});
    expect(res).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('GET 返回 304 且无缓存 → 抛 "304响应但没有缓存数据"', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 304,
      headers: { get: (): string | null => null },
      json: () => Promise.resolve({}),
    });
    await expect(api.users.getById(1)).rejects.toThrow('304响应但没有缓存数据');
  });

  it('200 OK 但 success:false 信封 → 抛 business 错误（unwrapEnvelope 业务失败分支）', async () => {
    mockFetch.mockResolvedValue(failEnv('业务失败'));
    await expect(api.users.create(CREATE_BODY)).rejects.toMatchObject({
      status: 200,
      type: 'business',
    });
  });

  it('POST 成功（写路径）→ 触发缓存失效广播（clearRelatedCache/invalidate/broadcast）', async () => {
    mockFetch.mockResolvedValue(env({ id: 1, name: 'ok' }));
    const res = await api.users.create(CREATE_BODY);
    expect(res).toMatchObject({ id: 1 });
  });

  it('419 含 CSRF 文案 → 触发 CSRF 重试但二次仍失败 → 抛二次错误', async () => {
    document.cookie = 'csrf_token=xyz';
    mockFetch
      .mockResolvedValueOnce(errEnv(419, { message: 'CSRF token missing or invalid' }))
      .mockResolvedValueOnce(errEnv(500, { message: 'still bad' }));
    await expect(api.users.create(CREATE_BODY)).rejects.toThrow('still bad');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('401 管理员态（admin marker）→ refreshToken 成功并重试返回数据', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, username: 'a' }));
    mockFetch
      .mockResolvedValueOnce(errEnv(401, { message: 'unauthorized' }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (): string | null => null },
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce(env({ id: 1, name: 'refreshed' }));
    const res = await api.users.create(CREATE_BODY);
    expect(res).toMatchObject({ id: 1, name: 'refreshed' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('401 管理员态 → refreshToken 失败 → 清登录态并抛 401', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, username: 'a' }));
    mockFetch
      .mockResolvedValueOnce(errEnv(401, { message: 'unauthorized' }))
      .mockResolvedValueOnce(errEnv(500, { message: 'refresh expired' }));
    await expect(api.users.create(CREATE_BODY)).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem('admin')).toBeNull();
  });

  it('500 空错误体 → getErrorMessage 兜底文案分支', async () => {
    mockFetch.mockResolvedValue(errEnv(500, {}));
    await expect(api.users.create(CREATE_BODY)).rejects.toThrow();
  });
});
