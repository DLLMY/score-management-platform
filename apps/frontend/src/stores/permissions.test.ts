/**
 * 权限 Store 行为测试 —— 覆盖报告 P0 的 "stores/*" 关键路径：
 * - hasPermission / hasAnyPermission / hasAllPermissions 判定
 * - setPermissions 角色标志（admin / super_admin）
 * - fetchAndApply 空权限兜底（报告修复的"登录后永远卡在加载权限..."死锁）
 * - 顺带验证 global(Toast) / theme store 基础行为
 */
/// <reference types="jest" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePermissionStore, useToastStore, useThemeStore } from './index';

const rbacApi = {
  getAdminRoles: vi.fn(),
};
vi.mock('../services/rbacApi', () => ({
  default: rbacApi,
}));

describe('permission store', () => {
  beforeEach(() => {
    localStorage.clear();
    rbacApi.getAdminRoles.mockReset();
    usePermissionStore.getState().clearPermissions();
  });

  it('hasPermission: "all" grants everything', () => {
    usePermissionStore.getState().setPermissions(['all'], ['super_admin']);
    const s = usePermissionStore.getState();
    expect(s.hasPermission('anything.at.all')).toBe(true);
  });

  it('hasPermission: explicit code match', () => {
    usePermissionStore.getState().setPermissions(['score.view', 'score.edit'], ['teacher']);
    const s = usePermissionStore.getState();
    expect(s.hasPermission('score.view')).toBe(true);
    expect(s.hasPermission('score.delete')).toBe(false);
  });

  it('hasAnyPermission', () => {
    usePermissionStore.getState().setPermissions(['a'], ['teacher']);
    const s = usePermissionStore.getState();
    expect(s.hasAnyPermission(['x', 'a'])).toBe(true);
    expect(s.hasAnyPermission(['y', 'z'])).toBe(false);
  });

  it('hasAllPermissions', () => {
    usePermissionStore.getState().setPermissions(['a', 'b'], ['teacher']);
    const s = usePermissionStore.getState();
    expect(s.hasAllPermissions(['a', 'b'])).toBe(true);
    expect(s.hasAllPermissions(['a', 'c'])).toBe(false);
  });

  it('setPermissions sets super_admin / admin flags', () => {
    usePermissionStore.getState().setPermissions(['x'], ['admin']);
    const s = usePermissionStore.getState();
    expect(s.isAdmin).toBe(true);
    expect(s.isSuperAdmin).toBe(false);
  });

  it('fetchAndApply: empty perms for admin role => ["all"] (deadlock fix)', async () => {
    rbacApi.getAdminRoles.mockResolvedValue({ roles: ['admin'], permissions: [] });
    await usePermissionStore.getState().fetchAndApply(1);
    expect(usePermissionStore.getState().permissions).toEqual(['all']);
  });

  it('fetchAndApply: empty perms for teacher role => default set (16 items)', async () => {
    rbacApi.getAdminRoles.mockResolvedValue({ roles: ['teacher'], permissions: [] });
    await usePermissionStore.getState().fetchAndApply(1);
    const p = usePermissionStore.getState().permissions;
    expect(p.length).toBe(16);
    expect(p).toContain('score.view');
    expect(p).toContain('attendance.view');
  });

  it('fetchAndApply: explicit perms from backend are kept (no clobber)', async () => {
    rbacApi.getAdminRoles.mockResolvedValue({
      roles: ['teacher'],
      permissions: ['score.view', 'score.entry'],
    });
    await usePermissionStore.getState().fetchAndApply(1);
    expect(usePermissionStore.getState().permissions).toEqual(['score.view', 'score.entry']);
  });

  it('权限缓存 5 分钟内有效：loadPermissions 直接复用缓存，无需重新拉取', async () => {
    rbacApi.getAdminRoles.mockResolvedValue({ roles: ['teacher'], permissions: ['score.view'] });
    await usePermissionStore.getState().fetchAndApply(1);
    // 清空内存态，逼迫 loadPermissions 走缓存读取分支
    usePermissionStore.getState().setPermissions([], []);
    usePermissionStore.setState({ isLoading: true });
    await usePermissionStore.getState().loadPermissions(1);
    // 新鲜缓存命中 → 从 localStorage 缓存恢复（后台静默刷新返回同值，最终态一致）
    expect(usePermissionStore.getState().permissions).toEqual(['score.view']);
    expect(rbacApi.getAdminRoles).toHaveBeenCalled();
  });

  it('权限缓存超过 TTL(5分钟) 失效：loadPermissions 重新拉取后端而非误用陈旧缓存', async () => {
    rbacApi.getAdminRoles
      .mockResolvedValueOnce({ roles: ['teacher'], permissions: ['score.view'] })
      .mockResolvedValueOnce({ roles: ['teacher'], permissions: ['score.fresh'] });
    await usePermissionStore.getState().fetchAndApply(1);
    expect(usePermissionStore.getState().permissions).toEqual(['score.view']);
    // 制造过期：把缓存时间戳拨到 6 分钟前
    localStorage.setItem('permission_cache_ts', String(Date.now() - 6 * 60 * 1000));
    usePermissionStore.getState().setPermissions([], []);
    usePermissionStore.setState({ isLoading: true });
    await usePermissionStore.getState().loadPermissions(1);
    // TTL 过期 → 重新走网络，应用第二次返回值（证明陈旧缓存未被误用）
    expect(usePermissionStore.getState().permissions).toEqual(['score.fresh']);
  });
});

describe('toast store', () => {
  it('addToast adds a toast; removeToast removes it', () => {
    useToastStore.getState().addToast('hello', 'info');
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe('hello');
    const id = toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts.find((t) => t.id === id)).toBeUndefined();
  });
});

describe('theme store', () => {
  it('toggleTheme flips light <-> dark', () => {
    useThemeStore.getState().setTheme('light');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
