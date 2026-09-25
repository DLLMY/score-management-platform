import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserListScore } from '../useUserListScore';
import type { useUserListScoreParams } from '../useUserListScore';
import type { User } from '../../../../types';
import type { Rule } from '../../types';

const { mockApi, mockWrapAsync, mockAddOperation, mockShowToast, mockDownloadBlob } = vi.hoisted(
  () => ({
    mockApi: {
      users: { delete: vi.fn() },
      records: { create: vi.fn() },
      export: { users: vi.fn() },
    },
    mockWrapAsync: vi.fn(
      async (
        _key: string,
        fn: () => Promise<unknown>,
        opts?: { onSuccess?: () => void; onError?: (e: Error) => void }
      ) => {
        try {
          await fn();
          opts?.onSuccess?.();
        } catch (e) {
          opts?.onError?.(e as Error);
        }
      }
    ),
    mockAddOperation: vi.fn(),
    mockShowToast: vi.fn(),
    mockDownloadBlob: vi.fn(),
  })
);

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer x' })),
}));

vi.mock('../../../../hooks', () => ({
  useAppState: () => ({ wrapAsync: mockWrapAsync }),
  useStableToast: () => ({ showToast: mockShowToast }),
  useUndoRedo: () => ({ addOperation: mockAddOperation }),
}));

vi.mock('../../../../utils/download', () => ({
  downloadBlob: mockDownloadBlob,
}));

const sampleUser: User = {
  id: 1,
  name: '张三',
  card_id: '123456',
  current_score: 60,
  is_active: true,
  is_blacklisted: false,
  daily_unlock_limit: 5,
  today_unlock_count: 0,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  class_name: '一班',
};

const addRule: Rule = { id: 10, name: '迟到', score: -5, is_active: true };
const plusRule: Rule = { id: 11, name: '好人好事', score: 5, is_active: true };

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    dispatch: vi.fn(),
    showToast: mockShowToast,
    wrapAsync: mockWrapAsync,
    addOperation: mockAddOperation,
    confirmRef: { current: vi.fn().mockResolvedValue(true) },
    users: [sampleUser],
    quickScoreUser: sampleUser,
    selectedUsers: new Set<number>([1, 2]),
    ...overrides,
  } as unknown as useUserListScoreParams;
}

describe('useUserListScore · 选择与评分域', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.records.create.mockResolvedValue({ success: true });
    mockApi.users.delete.mockResolvedValue({ success: true });
    mockApi.export.users.mockReturnValue('/api/export/users');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => ({}) }));
  });

  it('selectedUsersArray / selectedUsersData 由 selectedUsers 派生', () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListScore(params));
    expect(result.current.selectedUsersArray).toEqual([1, 2]);
    expect(result.current.selectedUsersData).toHaveLength(1);
    expect(result.current.selectedUsersData[0].id).toBe(1);
  });

  it('handleOpenQuickScore → 写入 quickScoreUser + 打开弹窗', () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListScore(params));
    act(() => result.current.handleOpenQuickScore(sampleUser));
    expect(params.dispatch).toHaveBeenCalledWith({
      type: 'SET_QUICK_SCORE_USER',
      payload: sampleUser,
    });
    expect(params.dispatch).toHaveBeenCalledWith({
      type: 'SET_SHOW_QUICK_SCORE_MODAL',
      payload: true,
    });
  });

  it('handleQuickScore 无 quickScoreUser → 直接返回', async () => {
    const params = makeParams({ quickScoreUser: null });
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleQuickScore(plusRule);
    });
    expect(mockApi.records.create).not.toHaveBeenCalled();
  });

  it('handleQuickScore 加分 → 创建记录 + 乐观刷新 + 成功提示 + 关闭弹窗', async () => {
    const params = makeParams({ quickScoreUser: sampleUser });
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleQuickScore(plusRule);
    });
    expect(mockApi.records.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, rule_id: 11, score_change: 5 })
    );
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UPDATE_USER_SCORE', payload: { userId: 1, scoreChange: 5 } })
    );
    expect(mockShowToast).toHaveBeenCalledWith('success', expect.stringContaining('加分成功'));
    expect(params.dispatch).toHaveBeenCalledWith({
      type: 'SET_SHOW_QUICK_SCORE_MODAL',
      payload: false,
    });
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_QUICK_SCORE_USER', payload: null });
  });

  it('handleQuickScore 撤销操作 → 再发一条反向记录', async () => {
    const params = makeParams({ quickScoreUser: sampleUser });
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleQuickScore(addRule);
    });
    const op = mockAddOperation.mock.calls[0][0];
    expect(op.type).toBe('update');
    await act(async () => {
      await op.undo();
    });
    // 原始 + 撤销，共两次 records.create
    expect(mockApi.records.create).toHaveBeenCalledTimes(2);
    expect(mockApi.records.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ score_change: 5 })
    );
  });

  it('handleBatchDelete 空选择 → 直接返回', async () => {
    const params = makeParams({ selectedUsers: new Set<number>() });
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleBatchDelete();
    });
    expect(mockApi.users.delete).not.toHaveBeenCalled();
  });

  it('handleBatchDelete 确认 → 批量删除 + 清空选择 + 记录操作', async () => {
    const params = makeParams({ selectedUsers: new Set<number>([1, 2]) });
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleBatchDelete();
    });
    expect(mockApi.users.delete).toHaveBeenCalledTimes(2);
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'DELETE_USER', payload: 1 });
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'DELETE_USER', payload: 2 });
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'CLEAR_USER_SELECTION' });
    expect(mockShowToast).toHaveBeenCalledWith('success', expect.stringContaining('成功删除 2'));
    expect(mockAddOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'batch' }));
  });

  it('handleBatchScore 确认 → 批量记录 + 刷新分数 + 清空选择', async () => {
    const params = makeParams({ selectedUsers: new Set<number>([1, 2]) });
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleBatchScore(3);
    });
    expect(mockApi.records.create).toHaveBeenCalledTimes(2);
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UPDATE_USER_SCORE', payload: { userId: 1, scoreChange: 3 } })
    );
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'CLEAR_USER_SELECTION' });
    expect(mockShowToast).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('成功为 2 名学生加分')
    );
  });

  it('handleExport 成功 → 下载文件并提示', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleExport();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/export/users',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(mockDownloadBlob).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '导出成功');
  });

  it('handleExport 失败 → 提示错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, blob: async () => ({}) })
    );
    const params = makeParams();
    const { result } = renderHook(() => useUserListScore(params));
    await act(async () => {
      await result.current.handleExport();
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', expect.stringContaining('导出失败(500)'));
  });

  it('handleClearSelection / handleSelectionChange → 派发选择变更', () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListScore(params));
    act(() => result.current.handleClearSelection());
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'CLEAR_USER_SELECTION' });
    act(() => result.current.handleSelectionChange(['1', '3']));
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_SELECTED_USERS', payload: new Set([1, 3]) })
    );
  });
});
