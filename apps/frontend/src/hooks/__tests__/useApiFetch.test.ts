import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, useApiFetch } from '../useApiFetch';

const { mockGetAuthHeaders, mockParseEnvelopeSafe } = vi.hoisted(() => ({
  mockGetAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  mockParseEnvelopeSafe: vi.fn(),
}));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  getAuthHeaders: mockGetAuthHeaders,
  parseEnvelopeSafe: mockParseEnvelopeSafe,
}));
vi.mock('../../utils/logger', () => ({ default: mockLogger }));

const URL_A = '/api/system/health';

class SyntaxExceptionProbe extends Error {
  constructor() {
    super('invalid json');
    this.name = 'SyntaxError';
  }
}

describe('fetchJson', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockLogger.error.mockClear();
    mockGetAuthHeaders.mockClear();
    mockParseEnvelopeSafe.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('2xx 且信封解析成功时返回 data，并携带 auth 头与 credentials', async () => {
    const payload = { n: 42 };
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: payload }) });
    mockParseEnvelopeSafe.mockReturnValue(payload);

    await expect(fetchJson(URL_A)).resolves.toEqual(payload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(URL_A, {
      credentials: 'include',
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(mockGetAuthHeaders).toHaveBeenCalled();
    expect(mockParseEnvelopeSafe).toHaveBeenCalledWith({ data: payload });
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('非 2xx 时返回 null 并记录状态码与 URL', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    });

    await expect(fetchJson(URL_A)).resolves.toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      `[fetchJson] 请求返回非 2xx 状态: 500 Internal Server Error <- ${URL_A}`
    );
    expect(mockParseEnvelopeSafe).not.toHaveBeenCalled();
  });

  it('网络/解析异常（fetch reject）时返回 null 并记录错误详情', async () => {
    const err = new Error('network down');
    mockFetch.mockRejectedValue(err);

    await expect(fetchJson(URL_A)).resolves.toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      `[fetchJson] 请求失败（网络/解析异常）: ${URL_A}`,
      err
    );
  });

  it('res.json() 抛错也走异常分支返回 null', async () => {
    const err = new SyntaxExceptionProbe();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw err;
      },
    });

    await expect(fetchJson('/api/broken')).resolves.toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe('useApiFetch', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockLogger.error.mockClear();
    mockParseEnvelopeSafe.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (data: unknown) => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data }) });
    mockParseEnvelopeSafe.mockReturnValue(data);
  };

  const respondFailure = (status = 500) => {
    mockFetch.mockResolvedValue({
      ok: false,
      status,
      statusText: 'Server Error',
      json: async () => ({}),
    });
  };

  it('url 为 null 时不发请求，保持空状态', async () => {
    const { result } = renderHook(() => useApiFetch<string | null>(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('加载成功：data 到位、loading 回落 false、error 为 null', async () => {
    respond({ healthy: true });
    const { result } = renderHook(() => useApiFetch<{ healthy: boolean }>(URL_A));
    await waitFor(() => expect(result.current.data).toEqual({ healthy: true }));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      URL_A,
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('加载失败：error 置为统一文案，data 不更新', async () => {
    respondFailure();
    const { result } = renderHook(() => useApiFetch<{ healthy: boolean }>(URL_A));
    await waitFor(() => expect(result.current.error).toBe('数据加载失败，请重试'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('retry() 重新发起请求并在成功后清除错误', async () => {
    respondFailure();
    const { result } = renderHook(() => useApiFetch<{ healthy: boolean }>(URL_A));
    await waitFor(() => expect(result.current.error).toBe('数据加载失败，请重试'));

    respond({ healthy: true });
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.data).toEqual({ healthy: true }));
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('url 变化时自动重新拉取', async () => {
    respond({ v: 1 });
    const { result, rerender } = renderHook(({ url }: { url: string }) => useApiFetch(url), {
      initialProps: { url: URL_A },
    });
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));

    respond({ v: 2 });
    rerender({ url: '/api/system/metrics' });
    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }));
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe('/api/system/metrics');
  });
});
