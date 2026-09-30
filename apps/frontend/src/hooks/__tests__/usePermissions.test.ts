import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermissions } from '../usePermissions';

const mockStore: Record<string, unknown> = {
  permissions: [],
  roles: [],
  isLoading: false,
  error: null,
  isAdmin: false,
  isSuperAdmin: false,
  hasPermission: vi.fn(() => false),
  hasAnyPermission: vi.fn(() => false),
  hasAllPermissions: vi.fn(() => false),
  loadPermissions: vi.fn(),
  reloadPermissions: vi.fn(),
};

vi.mock('../../stores', () => ({
  usePermissionStore: () => mockStore,
}));

describe('usePermissions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.assign(mockStore, {
      permissions: [],
      roles: [],
      isLoading: false,
      error: null,
      isAdmin: false,
      isSuperAdmin: false,
      hasPermission: vi.fn(() => false),
      hasAnyPermission: vi.fn(() => false),
      hasAllPermissions: vi.fn(() => false),
      loadPermissions: vi.fn(),
      reloadPermissions: vi.fn(),
    });
  });

  it('返回 store 的基础字段', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isSuperAdmin).toBe(false);
    expect(typeof result.current.hasPermission).toBe('function');
    expect(typeof result.current.hasAnyPermission).toBe('function');
    expect(typeof result.current.hasAllPermissions).toBe('function');
  });

  it('error 存在时映射为 Error 对象', () => {
    mockStore.error = '权限加载失败';
    const { result } = renderHook(() => usePermissions());
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('权限加载失败');
  });

  it('error 为 null 时 error 字段为 null', () => {
    mockStore.error = null;
    const { result } = renderHook(() => usePermissions());
    expect(result.current.error).toBeNull();
  });

  it('localStorage 含有效 admin 信息时 adminInfo 解析成功', () => {
    localStorage.setItem(
      'admin',
      JSON.stringify({
        id: 1,
        username: 'admin',
        real_name: '超管',
        roles: ['admin'],
        permissions: ['p1'],
      })
    );
    // adminInfo 的 roles/permissions 取自 store 闭包，需与 mock store 对齐
    mockStore.roles = ['admin'];
    mockStore.permissions = ['p1'];
    const { result } = renderHook(() => usePermissions());
    expect(result.current.adminInfo).not.toBeNull();
    expect(result.current.adminInfo?.id).toBe(1);
    expect(result.current.adminInfo?.username).toBe('admin');
    expect(result.current.adminInfo?.real_name).toBe('超管');
    expect(result.current.adminInfo?.roles).toEqual(['admin']);
    expect(result.current.adminInfo?.permissions).toEqual(['p1']);
  });

  it('localStorage 无 admin 信息时 adminInfo 为 null', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.adminInfo).toBeNull();
  });

  it('localStorage 中 admin 信息 JSON 损坏时 adminInfo 回退 null', () => {
    localStorage.setItem('admin', '{bad json');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.adminInfo).toBeNull();
  });

  it('isLoading 且有 admin 信息时 useEffect 触发 loadPermissions', () => {
    localStorage.setItem('admin', JSON.stringify({ id: 42 }));
    mockStore.isLoading = true;
    const { result } = renderHook(() => usePermissions());
    expect(mockStore.loadPermissions).toHaveBeenCalledWith(42);
    expect(typeof result.current.reload).toBe('function');
  });

  it('reload 调用 reloadPermissions', () => {
    const { result } = renderHook(() => usePermissions());
    act(() => {
      result.current.reload();
    });
    expect(mockStore.reloadPermissions).toHaveBeenCalled();
  });
});
