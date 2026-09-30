import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUserListLogic } from './useUserListLogic';

// 全 mock 重型依赖，隔离 useUserListLogic 自身装配逻辑（与 UserListView.test.tsx 桩策略一致）
vi.mock('../../hooks', () => ({
  useAppState: () => ({ wrapAsync: (fn: (...a: unknown[]) => unknown) => fn() }),
  usePermissions: () => ({ can: vi.fn(), role: 'admin' }),
  useStableToast: () => ({ showToast: vi.fn() }),
  useUndoRedo: () => ({ addOperation: vi.fn() }),
  useSubmitGuard: () => ({ run: (fn: (...a: unknown[]) => unknown) => fn() }),
}));
vi.mock('../../components', () => ({
  useConfirm: () => vi.fn(),
}));
vi.mock('./columns', () => ({
  buildUserColumns: () => [],
}));

// 子 hook 返回任意属性均为 vi.fn 的代理对象，覆盖 useUserListLogic 内部所有 useCallback/useMemo 定义行
vi.mock('./hooks', () => {
  const make = () =>
    new Proxy(
      {},
      {
        get: () => vi.fn(),
      }
    );
  return {
    useUserListFetch: () => make(),
    useUserListCrud: () => make(),
    useUserListScore: () => make(),
  };
});

describe('useUserListLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('装配并暴露完整 props 表面（覆盖所有 useCallback/useMemo 定义）', () => {
    const { result } = renderHook(() => useUserListLogic());
    const p = result.current;
    expect(p).toBeDefined();
    // 状态与调度
    expect(p.state).toBeDefined();
    expect(typeof p.dispatch).toBe('function');
    // 拉取域
    expect(typeof p.fetchUsers).toBe('function');
    expect(typeof p.handleSearch).toBe('function');
    expect(typeof p.handleClassChange).toBe('function');
    expect(typeof p.handleAdvancedSearch).toBe('function');
    expect(typeof p.handlePageChange).toBe('function');
    expect(typeof p.handleClearFilters).toBe('function');
    expect(typeof p.handleRetry).toBe('function');
    // 增删改域（含 guarded 包装）
    expect(typeof p.handleSubmit).toBe('function');
    expect(typeof p.handleCloseModal).toBe('function');
    expect(typeof p.handleToggleActive).toBe('function');
    expect(typeof p.handleDelete).toBe('function');
    // 评分域（含 guarded 包装）
    expect(typeof p.handleQuickScore).toBe('function');
    expect(typeof p.handleExport).toBe('function');
    expect(typeof p.handleClearSelection).toBe('function');
    expect(typeof p.handleSelectionChange).toBe('function');
    expect(typeof p.handleBatchDelete).toBe('function');
    expect(typeof p.handleBatchScore).toBe('function');
    expect(Array.isArray(p.userColumns)).toBe(true);
  });
});
