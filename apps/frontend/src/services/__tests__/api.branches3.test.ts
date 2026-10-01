import { it, expect, vi, beforeEach } from 'vitest';
import api, { fetchCsrfToken } from '../../services/api';

vi.mock('../../utils/errorMonitor', () => ({
  errorMonitor: {
    report: () => {},
    reportApiError: () => {},
    reportConsoleError: () => {},
  },
}));

const mockFetch = vi.fn();
beforeEach(() => {
  (globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset();
  // 默认清除 csrf cookie，确保 fetchCsrfToken 走真拉取路径
  document.cookie = '';
});

// --- fetchCsrfToken 单元：已导出，覆盖 391-404 真拉取/失败/异常三分支 ---

// 成功：cookie 无 token -> fetch /api/admins/csrf-token 返回 csrf_token
it('fetchCsrfToken 真拉取成功返回 token', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ csrf_token: 'NEW_CSRF' }),
  });
  const token = await fetchCsrfToken();
  expect(token).toBe('NEW_CSRF');
  expect(mockFetch).toHaveBeenCalled();
});

// 响应非 ok -> 返回 null
it('fetchCsrfToken 响应非 ok 返回 null', async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 500,
    json: () => Promise.resolve({}),
  });
  const token = await fetchCsrfToken();
  expect(token).toBeNull();
});

// fetch 抛错 -> catch -> 返回 null
it('fetchCsrfToken 网络异常返回 null', async () => {
  mockFetch.mockRejectedValue(new Error('net fail'));
  const token = await fetchCsrfToken();
  expect(token).toBeNull();
});

// 响应 ok 但 data 无 csrf_token 字段 -> 落到 return null（覆盖 397 false 分支）
it('fetchCsrfToken ok 但无 csrf_token 字段返回 null', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  });
  const token = await fetchCsrfToken();
  expect(token).toBeNull();
});

// --- refreshToken 无 csrf 但 admin 存在分支（692-698 else 不加 header） ---
// 通过 401 管理员态重试流程间接覆盖：cookie 无 csrf + localStorage.admin 存在
function env(data: unknown, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (): string | null => null },
    json: () => Promise.resolve({ success: true, code: 0, data, ...extra }),
    blob: () => Promise.resolve(new Blob()),
    text: () => Promise.resolve(''),
  };
}

it('401 管理员态 refresh 成功（无 csrf 走无 header 分支）', async () => {
  localStorage.setItem('admin', JSON.stringify({ id: 1 }));
  // call0: 首次 401（管理员态）触发 refreshToken
  mockFetch
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
      json: () => Promise.resolve({}),
    })
    // call1: refresh-token POST 成功（无 csrf header 分支）
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ success: true, code: 0 }),
    })
    // call2: 重试原请求成功
    .mockResolvedValueOnce(env({ id: 1 }));
  const res = await api.users.create({ name: 'x', username: 'x', password: 'p' } as never);
  expect(res).toBeDefined();
  // 重置 admin
  localStorage.removeItem('admin');
});
