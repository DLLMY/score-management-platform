import { vi } from 'vitest';
import api from '../api';

// 静音 ErrorMonitor：错误处理上报日志是噪音
vi.mock('../../utils/errorMonitor', () => ({
  errorMonitor: { report: () => {}, reportApiError: () => {}, reportConsoleError: () => {} },
}));

// Mock fetch（与 api.test.ts 一致：单响应 mock，request 不在测试环境自动拉 CSRF）
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

// 统一构造一个成功信封（默认路径会由 request 解包出 data）
function okEnvelope(data: unknown, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (): string | null => null },
    json: () => Promise.resolve({ success: true, code: 0, data, ...extra }),
  };
}
function failEnvelope(message: string, error_code?: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: (): string | null => null },
    json: () =>
      Promise.resolve(
        error_code ? { success: false, message, error_code } : { success: false, message }
      ),
  };
}

describe('关键业务流 · 登录鉴权', () => {
  it('login 成功：POST /api/auth/login，返回 token 与 user（skipDataExtract 扁平信封）', async () => {
    const user = { id: 1, username: 'admin', role: 'admin', name: '邓老师' };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (): string | null => null },
      // 登录为扁平信封：token/user 在顶层（非 data 内），skipDataExtract 原样返回
      json: () =>
        Promise.resolve({
          success: true,
          code: 0,
          access_token: 'at-123',
          refresh_token: 'rt-456',
          user,
        }),
    });

    const res = await api.auth.login({ username: 'admin', password: 'x' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(opts.method).toBe('POST');
    expect(opts.credentials).toBe('include');
    expect(JSON.parse(opts.body)).toEqual({ username: 'admin', password: 'x' });
    expect(res.access_token).toBe('at-123');
    expect(res.refresh_token).toBe('rt-456');
    expect(res.user).toMatchObject({ id: 1, username: 'admin' });
  });

  it('login 网络失败：reject 友好文案', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.auth.login({ username: 'a', password: 'b' })).rejects.toThrow(
      '网络连接失败，请检查网络或服务器是否可用'
    );
  });
});

describe('关键业务流 · 评分重算（综合分 / 聚类）', () => {
  it('recalculateCompositeScores：POST /api/algorithm/composite-score/recalculate，解包 data', async () => {
    mockFetch.mockResolvedValue(okEnvelope({ updated: 120, skipped: 3 }));
    const res = await api.algorithm.recalculateCompositeScores();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/algorithm/composite-score/recalculate');
    expect(opts.method).toBe('POST');
    expect(res).toEqual({ updated: 120, skipped: 3 });
  });

  it('recalculateClusters：POST /api/algorithm/cluster/recalculate', async () => {
    mockFetch.mockResolvedValue(okEnvelope({ clusters: 5 }));
    const res = await api.algorithm.recalculateClusters();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/algorithm/cluster/recalculate');
    expect(opts.method).toBe('POST');
    expect(res).toEqual({ clusters: 5 });
  });

  it('评分重算业务失败（success:false）：抛错而非假成功', async () => {
    mockFetch.mockResolvedValue(failEnvelope('重算任务正在进行中，请稍后再试'));
    await expect(api.algorithm.recalculateCompositeScores()).rejects.toThrow(
      '重算任务正在进行中，请稍后再试'
    );
  });
});

describe('关键业务流 · 手机箱状态机（策略 override / 设备 remote-control / 开锁）', () => {
  const policy = {
    class_info_id: 7,
    exists: true,
    allow_self_unlock: false,
    unlock_windows: [],
    override_until: '2026-09-23T10:00:00',
    override_active: true,
    updated_by: 1,
    updated_at: '2026-09-23T09:00:00',
  };

  it('override：POST /api/phonebox-policy/override?class_info_id=7，body={minutes}', async () => {
    mockFetch.mockResolvedValue(okEnvelope(policy));
    const res = await api.phoneBoxPolicy.override(30, 7);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/phonebox-policy/override?class_info_id=7');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ minutes: 30 });
    expect(res).toMatchObject({ class_info_id: 7, override_active: true });
  });

  it('override 不带 classInfoId：默认端点', async () => {
    mockFetch.mockResolvedValue(okEnvelope(policy));
    await api.phoneBoxPolicy.override(15);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/phonebox-policy/override');
  });

  it('cancelOverride：POST /api/phonebox-policy/cancel-override，覆盖态回到非激活', async () => {
    const cleared = { ...policy, override_active: false, override_until: null };
    mockFetch.mockResolvedValue(okEnvelope(cleared));
    const res = await api.phoneBoxPolicy.cancelOverride(7);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/phonebox-policy/cancel-override?class_info_id=7');
    expect(opts.method).toBe('POST');
    expect(res).toMatchObject({ override_active: false });
  });

  it('devices.remoteControl：POST /api/devices/{id}/remote-control，body={action}', async () => {
    mockFetch.mockResolvedValue(okEnvelope(null));
    await api.devices.remoteControl('dev-01', 'open_box');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/devices/dev-01/remote-control');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ action: 'open_box' });
  });

  it('mqtt.unlock：POST /api/mqtt/unlock，body 透传', async () => {
    mockFetch.mockResolvedValue(okEnvelope(null));
    await api.mqtt.unlock({ device_id: 'dev-01', box_id: 'A' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/mqtt/unlock');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ device_id: 'dev-01', box_id: 'A' });
  });

  it('手机箱控制业务失败：抛错', async () => {
    mockFetch.mockResolvedValue(failEnvelope('设备离线，无法远程控制', 'DEVICE_OFFLINE'));
    await expect(api.devices.remoteControl('dev-01', 'open_box')).rejects.toThrow(
      '设备离线，无法远程控制'
    );
  });
});
