import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, cleanup, act } from '@testing-library/react';
import { useFrontendTelemetryLogic } from './useFrontendTelemetryLogic';
import { useListFetch } from '../../hooks';

// useListFetch 由本文件组合，返回受控对象即可——重点测本 hook 的组合逻辑与 columns 分支
vi.mock('../../hooks', () => ({
  fetchJson: vi.fn(),
  useListFetch: vi.fn(() => ({
    items: [],
    total: 0,
    loading: false,
    error: null,
    refetch: vi.fn(),
    setItems: vi.fn(),
    setTotal: vi.fn(),
    mutate: vi.fn(),
  })),
}));

const controlledListFetch = () => ({
  items: [],
  total: 0,
  loading: false,
  error: null,
  refetch: vi.fn(),
  setItems: vi.fn(),
  setTotal: vi.fn(),
  mutate: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useListFetch).mockImplementation(controlledListFetch);
});

afterEach(() => cleanup());

const fakeEvent = (value: string) =>
  ({ target: { value } } as unknown as React.ChangeEvent<HTMLInputElement | HTMLSelectElement>);

describe('useFrontendTelemetryLogic', () => {
  it('返回结构完整：双列表 + filters + handlers + columns + page', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    expect(result.current.perf).toBeDefined();
    expect(result.current.err).toBeDefined();
    expect(result.current.perfFilters).toEqual({ metric_type: '', name: '' });
    expect(result.current.errFilters).toEqual({ error_type: '' });
    expect(typeof result.current.onPerfFilterChange).toBe('function');
    expect(typeof result.current.onErrFilterChange).toBe('function');
    expect(typeof result.current.handlePerfPageChange).toBe('function');
    expect(typeof result.current.handleErrPageChange).toBe('function');
    expect(Array.isArray(result.current.perfColumns)).toBe(true);
    expect(Array.isArray(result.current.errColumns)).toBe(true);
    expect(result.current.perfPage).toBe(1);
    expect(result.current.errPage).toBe(1);
  });

  it('onPerfFilterChange 更新 perfFilters 并重置 perfPage=1', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    act(() => {
      result.current.onPerfFilterChange('metric_type')(fakeEvent('web_vital'));
    });
    expect(result.current.perfFilters.metric_type).toBe('web_vital');
    expect(result.current.perfPage).toBe(1);
    act(() => {
      result.current.onPerfFilterChange('name')(fakeEvent('LCP'));
    });
    expect(result.current.perfFilters.name).toBe('LCP');
  });

  it('onErrFilterChange 更新 errFilters 并重置 errPage=1', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    act(() => {
      result.current.onErrFilterChange('error_type')(fakeEvent('api_error'));
    });
    expect(result.current.errFilters.error_type).toBe('api_error');
    expect(result.current.errPage).toBe(1);
  });

  it('handlePerfPageChange / handleErrPageChange 更新页码', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    act(() => result.current.handlePerfPageChange(3));
    expect(result.current.perfPage).toBe(3);
    act(() => result.current.handleErrPageChange(5));
    expect(result.current.errPage).toBe(5);
  });

  it('perfColumns：value+unit / value 无 unit / page 有值 / page null 兜底', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    const cols = result.current.perfColumns;
    const valueCol = cols.find((c) => c.key === 'value')!;
    const pageCol = cols.find((c) => c.key === 'page')!;

    const withUnit = render(
      valueCol.render!(2.5, { value: 2.5, unit: 's' } as never, 0) as React.ReactNode
    );
    expect(withUnit.container.textContent).toContain('2.5');
    expect(withUnit.container.textContent).toContain('s');

    const noUnit = render(
      valueCol.render!(2.5, { value: 2.5, unit: null } as never, 0) as React.ReactNode
    );
    expect(noUnit.container.textContent).toContain('2.5');
    expect(noUnit.container.textContent).not.toContain('undefined');

    const pageHas = render(
      pageCol.render!('/home', { page: '/home' } as never, 0) as React.ReactNode
    );
    expect(pageHas.container.textContent).toContain('/home');

    const pageNull = render(pageCol.render!(null, { page: null } as never, 0) as React.ReactNode);
    expect(pageNull.container.textContent).toContain('-');
  });

  it('perfColumns：created_at 经 formatDateTime 渲染', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    const col = result.current.perfColumns.find((c) => c.key === 'created_at')!;
    const r = render(
      col.render!(
        '2026-01-01T08:00:00Z',
        { created_at: '2026-01-01T08:00:00Z' } as never,
        0
      ) as React.ReactNode
    );
    expect(r.container.textContent).not.toBe('');
    expect(r.container.textContent).not.toContain('2026-01-01T08:00:00Z');
  });

  it('errColumns：error_type 三元三分支（api_error / resource_error / 其它）', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    const col = result.current.errColumns.find((c) => c.key === 'error_type')!;

    const api = render(
      col.render!('api_error', { error_type: 'api_error' } as never, 0) as React.ReactNode
    );
    expect(api.container.querySelector('.bg-orange-100')).toBeTruthy();

    const res = render(
      col.render!('resource_error', { error_type: 'resource_error' } as never, 0) as React.ReactNode
    );
    expect(res.container.querySelector('.bg-purple-100')).toBeTruthy();

    const other = render(
      col.render!(
        'javascript_error',
        { error_type: 'javascript_error' } as never,
        0
      ) as React.ReactNode
    );
    expect(other.container.querySelector('.bg-red-100')).toBeTruthy();
  });

  it('errColumns：page 有值 / page null 兜底', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    const col = result.current.errColumns.find((c) => c.key === 'page')!;
    const has = render(col.render!('/login', { page: '/login' } as never, 0) as React.ReactNode);
    expect(has.container.textContent).toContain('/login');
    const none = render(col.render!(null, { page: null } as never, 0) as React.ReactNode);
    expect(none.container.textContent).toContain('-');
  });

  it('errColumns：request 列 method+status / 仅 url / 全 null', () => {
    const { result } = renderHook(() => useFrontendTelemetryLogic());
    const col = result.current.errColumns.find((c) => c.key === 'request')!;

    const full = render(
      col.render!(
        undefined,
        { method: 'GET', status: 500, url: 'http://x/y' } as never,
        0
      ) as React.ReactNode
    );
    expect(full.container.textContent).toContain('GET 500');
    expect(full.container.textContent).toContain('http://x/y');

    const onlyUrl = render(
      col.render!(
        undefined,
        { method: '', status: null, url: 'http://z' } as never,
        0
      ) as React.ReactNode
    );
    expect(onlyUrl.container.textContent).toContain('-');
    expect(onlyUrl.container.textContent).toContain('http://z');

    const none = render(
      col.render!(undefined, { method: '', status: null, url: null } as never, 0) as React.ReactNode
    );
    expect(none.container.textContent).toContain('-');
    expect(none.container.querySelector('div')).toBeFalsy();
  });
});
