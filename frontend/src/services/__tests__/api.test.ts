import { vi } from 'vitest';
import api from '../api';

// 静音 ErrorMonitor：错误处理测试的上报日志是噪音（api 封装错误时主动 report）
vi.mock('../../utils/errorMonitor', () => ({
  errorMonitor: { report: () => {}, reportApiError: () => {}, reportConsoleError: () => {} },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

describe('API Service', () => {
  it('should have users API methods', () => {
    expect(api.users).toBeDefined();
    expect(typeof api.users.getAll).toBe('function');
    expect(typeof api.users.getById).toBe('function');
    expect(typeof api.users.create).toBe('function');
    expect(typeof api.users.update).toBe('function');
    expect(typeof api.users.delete).toBe('function');
  });

  it('should have records API methods', () => {
    expect(api.records).toBeDefined();
    expect(typeof api.records.getAll).toBe('function');
    expect(typeof api.records.getByUser).toBe('function');
    expect(typeof api.records.create).toBe('function');
  });

  it('should have devices API methods', () => {
    expect(api.devices).toBeDefined();
    expect(typeof api.devices.getAll).toBe('function');
    expect(typeof api.devices.getStats).toBe('function');
  });

  it('should have rules API methods', () => {
    expect(api.rules).toBeDefined();
    expect(typeof api.rules.getAll).toBe('function');
    expect(typeof api.rules.create).toBe('function');
    expect(typeof api.rules.update).toBe('function');
    expect(typeof api.rules.delete).toBe('function');
  });

  it('should send credentials include (cookie 认证轨) without Authorization header', async () => {
    // 十评 P2-1 完全 cookie 化：token 走 HttpOnly cookie，请求凭 credentials: include 携带，
    // 不再从 localStorage 读取 token 注入 Authorization 头
    localStorage.setItem('access_token', 'legacy-token');  // 旧残留也不应被读取

    // api.ts 会读 response.headers.get('ETag')，mock 需提供 headers
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ data: [] }),
    });

    await api.users.getAll({ skipCache: true });

    expect(mockFetch).toHaveBeenCalled();
    const options = mockFetch.mock.calls[0][1];
    expect(options.credentials).toBe('include');
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('should handle network errors', async () => {
    // 用 POST 端点：GET 会命中 api.ts 内存缓存导致 fetch 不被调用
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      api.users.create({ name: '测试', card_id: '12345678' })
    ).rejects.toThrow('网络连接失败，请检查网络或服务器是否可用');
  });

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: () => Promise.resolve({ message: '请求失败' }),
    });

    await expect(
      api.users.create({ name: '测试', card_id: '12345678' })
    ).rejects.toThrow('请求失败');
  });
});
