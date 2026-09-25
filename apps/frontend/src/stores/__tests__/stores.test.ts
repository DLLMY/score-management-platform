import { describe, it, expect, vi, beforeEach } from 'vitest';

// 动态 import 的 rbacApi 必须在此 mock（与 store 内 import 同一模块标识）
vi.mock('../../services/rbacApi', () => ({
  __esModule: true,
  default: {
    getAdminRoles: vi.fn(),
  },
}));

import * as rbacApiNs from '../../services/rbacApi';
import { usePermissionStore } from '..';
import { useToastStore } from '..';
import { useGlobalStore } from '..';
import { useThemeStore } from '..';

// 与 store 内 `await import()` 取 .default 的方式保持一致
const rbacApi = (
  rbacApiNs as unknown as {
    default: { getAdminRoles: ReturnType<typeof vi.fn> };
  }
).default;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // 复位权限 store 到初始态
  usePermissionStore.setState({
    permissions: [],
    roles: [],
    isLoading: true,
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
  });
  useToastStore.setState({ toasts: [] });
  useGlobalStore.setState({ isLoading: false, loadingMessage: '', error: null, isOnline: true });
  useThemeStore.setState({ theme: 'light' });
});

describe('PermissionStore · 权限判定', () => {
  it('setPermissions 按角色推导 isAdmin / isSuperAdmin', () => {
    const s = usePermissionStore.getState();
    s.setPermissions(['a.view'], ['admin']);
    expect(usePermissionStore.getState().isAdmin).toBe(true);
    expect(usePermissionStore.getState().isSuperAdmin).toBe(false);

    usePermissionStore.getState().setPermissions([], ['super_admin']);
    expect(usePermissionStore.getState().isSuperAdmin).toBe(true);
    expect(usePermissionStore.getState().isAdmin).toBe(true);
  });

  it('hasPermission：含 all 直接放行；否则精确匹配', () => {
    const s = usePermissionStore.getState();
    s.setPermissions(['all'], ['admin']);
    expect(usePermissionStore.getState().hasPermission('anything')).toBe(true);

    usePermissionStore.getState().setPermissions(['student.view'], []);
    expect(usePermissionStore.getState().hasPermission('student.view')).toBe(true);
    expect(usePermissionStore.getState().hasPermission('score.entry')).toBe(false);
  });

  it('hasAnyPermission / hasAllPermissions', () => {
    usePermissionStore.getState().setPermissions(['a', 'b'], []);
    const s = usePermissionStore.getState();
    expect(s.hasAnyPermission(['x', 'b'])).toBe(true);
    expect(s.hasAnyPermission(['x', 'y'])).toBe(false);
    expect(s.hasAllPermissions(['a', 'b'])).toBe(true);
    expect(s.hasAllPermissions(['a', 'z'])).toBe(false);
  });

  it('hasAllPermissions：用户持有 all 通配符 → 任意集合均放行', () => {
    usePermissionStore.getState().setPermissions(['all'], ['admin']);
    const s = usePermissionStore.getState();
    expect(s.hasAllPermissions(['student.view', 'score.entry'])).toBe(true);
  });

  it('loadPermissions：isLoading=false 时直接跳过', async () => {
    usePermissionStore.setState({ isLoading: false });
    await usePermissionStore.getState().loadPermissions(1);
    expect(rbacApi.getAdminRoles).not.toHaveBeenCalled();
  });

  it('loadPermissions：缓存新鲜 → 用缓存并后台刷新；空缓存强制回源', async () => {
    localStorage.setItem('user_permissions', JSON.stringify(['student.view']));
    localStorage.setItem('user_roles', JSON.stringify(['teacher']));
    localStorage.setItem('permission_cache_ts', String(Date.now()));
    rbacApi.getAdminRoles.mockResolvedValue({
      roles: ['teacher'],
      permissions: ['student.view', 'extra'],
    });

    await usePermissionStore.getState().loadPermissions(7);
    const st = usePermissionStore.getState();
    expect(st.permissions).toContain('student.view');
    expect(st.isLoading).toBe(false);
    // 后台静默刷新（fire-and-forget），等待动态 import + 调用落地
    await new Promise((r) => setTimeout(r, 50));
    expect(rbacApi.getAdminRoles).toHaveBeenCalledWith(7);
  });

  it('loadPermissions：无缓存 → 走 fetchAndApply', async () => {
    rbacApi.getAdminRoles.mockResolvedValue({
      roles: ['admin'],
      permissions: ['all'],
    });
    await usePermissionStore.getState().loadPermissions(3);
    expect(usePermissionStore.getState().permissions).toEqual(['all']);
    expect(usePermissionStore.getState().isAdmin).toBe(true);
  });

  it('fetchAndApply：空权限按角色兜底 defaultPermissionsForRoles', async () => {
    rbacApi.getAdminRoles.mockResolvedValue({ roles: ['teacher'], permissions: [] });
    await usePermissionStore.getState().fetchAndApply(5);
    const st = usePermissionStore.getState();
    expect(st.permissions).toContain('score.entry');
    expect(st.permissions).not.toContain('all');
  });

  it('fetchAndApply：返回 null → 内部捕获并进入错误态（StrictMode 取消守卫）', async () => {
    rbacApi.getAdminRoles.mockResolvedValue(null);
    await usePermissionStore.getState().fetchAndApply(9);
    const st = usePermissionStore.getState();
    expect(st.error).toBeTruthy();
    expect(st.permissions).toEqual([]);
  });

  it('fetchAndApply：异常且本地有 admin → 按角色兜底', async () => {
    rbacApi.getAdminRoles.mockRejectedValue(new Error('network'));
    localStorage.setItem('admin', JSON.stringify({ id: 11, role: 'teacher' }));
    await usePermissionStore.getState().fetchAndApply(11);
    const st = usePermissionStore.getState();
    expect(st.isLoading).toBe(false);
    expect(st.permissions).toContain('student.view');
  });

  it('reloadPermissions / clearPermissions', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 21, role: 'teacher' }));
    usePermissionStore.getState().setPermissions(['student.view'], ['teacher']);
    usePermissionStore.getState().clearPermissions();
    expect(usePermissionStore.getState().permissions).toEqual([]);
    expect(localStorage.getItem('user_permissions')).toBeNull();
  });
});

describe('ToastStore · 消息提示', () => {
  it('addToast 入队，removeToast 出队，clearAllToasts 清空', () => {
    const s = useToastStore.getState();
    s.addToast('hello', 'info');
    s.addToast('warn', 'warning', 5000);
    expect(useToastStore.getState().toasts.length).toBe(2);
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts.length).toBe(1);
    useToastStore.getState().clearAllToasts();
    expect(useToastStore.getState().toasts.length).toBe(0);
  });

  it('success/error/warning/info 均委托 addToast', () => {
    useToastStore.getState().success('s');
    useToastStore.getState().error('e');
    useToastStore.getState().warning('w');
    useToastStore.getState().info('i');
    const types = useToastStore.getState().toasts.map((t) => t.type);
    expect(types).toEqual(['success', 'error', 'warning', 'info']);
  });
});

describe('GlobalStore · 全局 UI 状态', () => {
  it('showLoading / hideLoading / setError / clearError / setOnline', () => {
    const s = useGlobalStore.getState();
    s.showLoading('请稍候');
    expect(useGlobalStore.getState().isLoading).toBe(true);
    expect(useGlobalStore.getState().loadingMessage).toBe('请稍候');
    s.hideLoading();
    expect(useGlobalStore.getState().isLoading).toBe(false);
    s.setError('boom');
    expect(useGlobalStore.getState().error).toBe('boom');
    s.clearError();
    expect(useGlobalStore.getState().error).toBeNull();
    s.setOnline(false);
    expect(useGlobalStore.getState().isOnline).toBe(false);
  });

  it('showToast 委托 ToastStore', () => {
    useGlobalStore.getState().showToast('via global', 'success');
    expect(useToastStore.getState().toasts[0].message).toBe('via global');
  });
});

describe('ThemeStore · 主题', () => {
  it('setTheme / toggleTheme / isDark / applyTheme', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().isDark()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(useThemeStore.getState().isDark()).toBe(false);
  });
});
