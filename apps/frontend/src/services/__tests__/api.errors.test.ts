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

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
  document.cookie = '';
});

describe('api.ts executeRequest 错误/边界分支', () => {
  it('403 Forbidden → 命中 error_code 友好文案并抛出', async () => {
    mockFetch.mockResolvedValue(errEnv(403, { error_code: 'FORBIDDEN' }));
    await expect(api.users.create({ name: 'x', card_id: '12345678' })).rejects.toThrow(
      '您没有权限执行此操作'
    );
  });

  it('404 非 GET（DELETE）→ 清理相关缓存分支后抛出', async () => {
    mockFetch.mockResolvedValue(errEnv(404, { message: '资源不存在' }));
    await expect(api.users.delete(1)).rejects.toThrow('资源不存在');
  });

  it('NetworkError 文案分支（message 含 NetworkError）', async () => {
    mockFetch.mockRejectedValue(new Error('NetworkError: failed to connect'));
    await expect(api.users.create({ name: 'x', card_id: '12345678' })).rejects.toThrow(
      '网络错误，请检查服务器连接'
    );
  });

  it('net::ERR 文案分支', async () => {
    mockFetch.mockRejectedValue(new Error('net::ERR_CONNECTION_RESET'));
    await expect(api.users.create({ name: 'x', card_id: '12345678' })).rejects.toThrow(
      '网络错误，请检查服务器连接'
    );
  });

  it('401 学生态 → clearStudentAuth 并抛 401', async () => {
    localStorage.setItem('student', JSON.stringify({ id: 1 }));
    mockFetch.mockResolvedValue(errEnv(401, { message: 'unauthorized' }));
    await expect(api.users.create({ name: 'x', card_id: '12345678' })).rejects.toMatchObject({
      status: 401,
    });
    expect(localStorage.getItem('student')).toBeNull();
  });

  it('401 管理员态（无 student/admin marker）→ clearAuthData 并抛 401', async () => {
    mockFetch.mockResolvedValue(errEnv(401, { message: 'unauthorized' }));
    await expect(api.users.create({ name: 'x', card_id: '12345678' })).rejects.toMatchObject({
      status: 401,
    });
  });

  it('419 含 CSRF 文案 → 触发 CSRF 重试并成功返回', async () => {
    document.cookie = 'csrf_token=test-csrf-xyz';
    mockFetch
      .mockResolvedValueOnce(errEnv(419, { message: 'CSRF token missing or invalid' }))
      .mockResolvedValueOnce(env({ id: 99, name: 'retry-ok' }));
    const res = await api.users.create({ name: 'x', card_id: '12345678' });
    expect(res).toEqual({ id: 99, name: 'retry-ok' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('请求被取消（type=cancelled）→ 非 GET 返回 null', async () => {
    mockFetch.mockRejectedValue({ type: 'cancelled', name: 'CanceledError' });
    const res = await api.users.create({ name: 'x', card_id: '12345678' });
    expect(res).toBeNull();
  });
});
