import { vi } from 'vitest';
import api, { getErrorMessage, unwrapEnvelope, parseEnvelopeSafe } from '../api';

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

  // ===== 信封归一化（报告 P0：services/api.ts 信封归一化） =====
  it('should extract business data from success envelope {success, code, data}', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () =>
        Promise.resolve({ success: true, code: 0, data: [{ id: 1, name: '张三' }] }),
    });

    const res = await api.users.getAll({ skipCache: true });
    expect(res).toEqual([{ id: 1, name: '张三' }]);
  });

  it('should throw on business-failure envelope (success:false at HTTP 200)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () =>
        Promise.resolve({ success: false, message: '该卡号已存在，请勿重复录入' }),
    });

    await expect(
      api.users.create({ name: '测试', card_id: '12345678' })
    ).rejects.toThrow('该卡号已存在，请勿重复录入');
  });
});

// ===== unwrapEnvelope（信封单一真相源：消除各页重复实现 / 假成功） =====
describe('unwrapEnvelope', () => {
  it('returns data when success + data present', () => {
    expect(unwrapEnvelope({ success: true, code: 0, data: { id: 1 } })).toEqual({ id: 1 });
  });

  it('throws ApiError on business failure (success:false at HTTP 200)', () => {
    // 业务失败必须抛错，绝不能当成功透出（假成功根因）
    expect(() => unwrapEnvelope({ success: false, message: '该卡号已存在' })).toThrow('该卡号已存在');
  });

  it('returns raw payload when skipDataExtract is set', () => {
    const raw = { success: false, message: '导入存在错误', data: [{ row: 1 }] };
    expect(unwrapEnvelope(raw, true)).toBe(raw);
  });

  it('returns raw payload when envelope has neither success nor data', () => {
    // 非信封直出（如裸露对象）原样返回，避免误吞
    const raw = { foo: 'bar' };
    expect(unwrapEnvelope(raw)).toBe(raw);
  });

  it('returns raw payload when success present but data missing', () => {
    const raw = { success: true, message: 'ok' };
    expect(unwrapEnvelope(raw)).toBe(raw);
  });
});

describe('parseEnvelopeSafe', () => {
  it('returns unwrapped data on success', () => {
    expect(parseEnvelopeSafe<{ id: number }>({ success: true, data: { id: 2 } })).toEqual({ id: 2 });
  });

  it('returns null on business failure instead of throwing', () => {
    // 展示型页面用非抛出版本：业务失败归 null，不当成功数据渲染
    expect(parseEnvelopeSafe({ success: false, message: '无权限' })).toBeNull();
  });

  it('returns null on parse/runtime error', () => {
    expect(parseEnvelopeSafe(undefined)).toBeNull();
    expect(parseEnvelopeSafe(null)).toBeNull();
  });

  it('returns payload as-is when envelope has no success field', () => {
    expect(parseEnvelopeSafe({ foo: 'bar' })).toEqual({ foo: 'bar' });
  });
});

// ===== getErrorMessage（M2：error_code 优先 / 技术错误屏蔽 / 状态兜底） =====
describe('getErrorMessage', () => {
  it('prefers friendly text mapped from error_code', () => {
    expect(getErrorMessage(500, { error_code: 'FORBIDDEN' })).toBe('您没有权限执行此操作');
    expect(getErrorMessage(401, { error_code: 'TOKEN_EXPIRED' })).toBe('登录状态已过期，请重新登录');
    expect(getErrorMessage(409, { error_code: 'DUPLICATE_RECORD' })).toBe('记录已存在，请勿重复提交');
  });

  it('passes through non-technical business message from backend', () => {
    expect(getErrorMessage(400, { message: '卡号格式不正确，应为 8 位数字' })).toBe(
      '卡号格式不正确，应为 8 位数字'
    );
  });

  it('masks technical/stack-trace messages and falls back to HTTP status text', () => {
    // SQLAlchemy / Traceback 等技术细节不得透传给用户，仅进日志
    expect(
      getErrorMessage(500, { message: 'sqlalchemy.exc.IntegrityError: duplicate key value' })
    ).toBe('服务器内部错误，请稍后重试');
    expect(getErrorMessage(500, { message: 'Traceback (most recent call last):\n  File "x.py", line 10' })).toBe(
      '服务器内部错误，请稍后重试'
    );
  });

  it('falls back to HTTP status text when no message/error_code', () => {
    expect(getErrorMessage(404, {})).toBe('请求的资源不存在');
    expect(getErrorMessage(401, {})).toBe('未授权，请登录');
  });

  it('falls back to generic text for unknown status', () => {
    expect(getErrorMessage(418, {})).toBe('请求失败 (418)');
  });
});
