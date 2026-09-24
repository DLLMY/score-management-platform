import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserListFetch } from '../useUserListFetch';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    classes: { getAll: vi.fn() },
    users: { getAll: vi.fn() },
    rules: { getAll: vi.fn() },
    rankRules: { getAll: vi.fn() },
  },
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    dispatch: vi.fn(),
    showToast: vi.fn(),
    advancedConditions: {},
    selectedClass: '',
    searchTerm: '',
    showAdvancedSearch: false,
    pagination: { page: 1, per_page: 20, total: 0, pages: 1 },
    ...overrides,
  } as never;
}

describe('useUserListFetch · 用户列表数据拉取', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.classes.getAll.mockResolvedValue([{ id: 1, name: '一班' }, { id: 2, name: '二班' }]);
    mockApi.users.getAll.mockResolvedValue({
      users: [{ id: 1, name: 'a' }],
      total: 1,
      pages: 1,
      page: 1,
    });
    mockApi.rules.getAll.mockResolvedValue({ rules: [{ id: 1 }] });
    mockApi.rankRules.getAll.mockResolvedValue({ rank_rules: [] });
  });

  it('挂载即拉取班级/用户/规则/排名规则并产出排序后的班级名', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListFetch(params));

    // 等待派生的班级名就绪（含 classes 异步拉取 + setState 传播），再断言
    await waitFor(() => expect(result.current.classes).toEqual(['一班', '二班']));
    expect(mockApi.classes.getAll).toHaveBeenCalled();
    expect(mockApi.rules.getAll).toHaveBeenCalled();
    expect(mockApi.rankRules.getAll).toHaveBeenCalled();
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_USERS' })
    );
  });

  it('fetchUsers 收到数组响应时走防御分支（按数组长度兜底 total/pages）', async () => {
    mockApi.users.getAll.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const params = makeParams();
    const { result } = renderHook(() => useUserListFetch(params));
    // 等待 classes 异步拉取落库到 classList（避免时序竞态）
    await waitFor(() => expect(result.current.classList).toHaveLength(2));
    expect(mockApi.users.getAll).toHaveBeenCalledTimes(1);
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_USERS', payload: expect.any(Array) })
    );
  });

  it('handleClassChange 写入选中班级并触发重新拉取', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListFetch(params));
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
    mockApi.users.getAll.mockClear();

    act(() => result.current.handleClassChange('5'));
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_SELECTED_CLASS', payload: '5' })
    );
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
  });

  it('handleAdvancedSearch / handlePageChange / handleClearFilters 均触发拉取或 dispatch', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListFetch(params));
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
    mockApi.users.getAll.mockClear();

    act(() => result.current.handleAdvancedSearch());
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
    mockApi.users.getAll.mockClear();

    act(() => result.current.handlePageChange(3));
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_PAGINATION', payload: expect.objectContaining({ page: 3 }) })
    );

    act(() => result.current.handleClearFilters());
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_SELECTED_CLASS', payload: '' })
    );
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_ADVANCED_CONDITIONS', payload: {} })
    );
  });

  it('handleSearch 经 300ms 防抖后写入 SEARCH_TERM 并触发拉取', async () => {
    vi.useFakeTimers();
    try {
      const params = makeParams();
      const { result } = renderHook(() => useUserListFetch(params));
      await vi.advanceTimersByTimeAsync(0);
      mockApi.users.getAll.mockClear();

      act(() => result.current.handleSearch('张三'));
      await vi.advanceTimersByTimeAsync(350);

      expect(params.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_SEARCH_TERM', payload: '张三' })
      );
      await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalled());
    } finally {
      vi.useRealTimers();
    }
  });

  it('handleRetry 清空错误并重新拉取', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListFetch(params));
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
    mockApi.users.getAll.mockClear();

    act(() => result.current.handleRetry());
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_ERROR', payload: null })
    );
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
  });

  it('班级接口失败 → showToast 错误且不影响其它拉取', async () => {
    mockApi.classes.getAll.mockRejectedValue(new Error('network'));
    const params = makeParams();
    renderHook(() => useUserListFetch(params));
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
    expect(params.showToast).toHaveBeenCalledWith('error', '班级列表加载失败，筛选器可能不可用');
  });

  it('用户接口失败（非 AbortError）→ 写入错误态', async () => {
    mockApi.users.getAll.mockRejectedValue(new Error('boom'));
    const params = makeParams();
    renderHook(() => useUserListFetch(params));
    await waitFor(() => expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_ERROR', payload: '加载用户列表失败' })
    ));
  });
});
