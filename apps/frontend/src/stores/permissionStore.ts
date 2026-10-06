import logger from '../utils/logger';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// 13. 权限管理状态 - Permission Store
// ============================================
interface PermissionState {
  permissions: string[];
  roles: string[];
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loadPermissions: (adminId: number) => Promise<void>;
  fetchAndApply: (adminId: number) => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  setPermissions: (permissions: string[], roles: string[]) => void;
  reloadPermissions: () => void;
  clearPermissions: () => void;
}

let permissionCacheTimestamp = 0;
const PERMISSION_CACHE_TTL = 5 * 60 * 1000;
const PERMISSION_CACHE_TS_KEY = 'permission_cache_ts';

// 后端返回空权限（或缓存为空）时，按角色给可用默认集，避免登录后永远卡在"加载权限..."
function defaultPermissionsForRoles(roles: string[]): string[] {
  if (roles.some((r) => ['admin', 'super_admin'].includes(r))) {
    return ['all'];
  }
  return [
    'student.view',
    'class.view',
    'subject.view',
    'rule.view',
    'score.view',
    'score.entry',
    'device.view',
    'exam.view',
    'algorithm.view',
    'notification.view',
    'homework.view',
    'attendance.view',
    'mental_health.view',
    'activity.view',
    'study_group.view',
    'study_guide.view',
  ];
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get): PermissionState => ({
      permissions: [],
      roles: [],
      isLoading: true,
      error: null,
      isAdmin: false,
      isSuperAdmin: false,

      // 真实拉取并落库；空权限按角色兜底，避免登录后永远卡在"加载权限..."
      fetchAndApply: async (adminId: number) => {
        try {
          const rbacApi = await import('../services/rbacApi');
          const result = await rbacApi.default.getAdminRoles(adminId);
          // 防 StrictMode 双调用导致请求被取消后 request 返回 null，直接读 result.roles 会崩藻
          if (!result) {
            throw new Error('permissions request returned null (likely cancelled)');
          }

          const roles = result.roles || [];
          let permissions = result.permissions || [];
          if (permissions.length === 0) {
            // 后端未返回显式权限时，按角色给可用默认集，杜绝空权限死锁
            permissions = defaultPermissionsForRoles(roles);
          }

          permissionCacheTimestamp = Date.now();
          localStorage.setItem(PERMISSION_CACHE_TS_KEY, String(permissionCacheTimestamp));
          localStorage.setItem('user_permissions', JSON.stringify(permissions));
          localStorage.setItem('user_roles', JSON.stringify(roles));

          get().setPermissions(permissions, roles);
        } catch (error) {
          logger.error('Failed to load permissions:', error);
          const adminStr = localStorage.getItem('admin');
          if (adminStr) {
            try {
              const admin = JSON.parse(adminStr);
              const roles = [admin.role || 'teacher'];
              get().setPermissions(defaultPermissionsForRoles(roles), roles);
            } catch {
              set({
                error: (error as Error).message,
                isLoading: false,
                permissions: [],
                roles: [],
                isAdmin: false,
                isSuperAdmin: false,
              });
            }
          } else {
            set({
              error: (error as Error).message,
              isLoading: false,
              permissions: [],
              roles: [],
              isAdmin: false,
              isSuperAdmin: false,
            });
          }
        }
      },

      loadPermissions: async (adminId: number) => {
        const { isLoading } = get();
        if (!isLoading) {
          return;
        }

        const cachedPermissions = localStorage.getItem('user_permissions');
        const cachedRoles = localStorage.getItem('user_roles');
        const cachedTs = Number(localStorage.getItem(PERMISSION_CACHE_TS_KEY) || 0);
        const cacheFresh =
          cachedPermissions && cachedRoles && Date.now() - cachedTs < PERMISSION_CACHE_TTL;

        if (cacheFresh) {
          try {
            const permissions = JSON.parse(cachedPermissions);
            const roles = JSON.parse(cachedRoles);
            // 空权限缓存视为无效，强制回源，避免陈旧空缓存永久阻塞
            if (!Array.isArray(permissions) || permissions.length === 0) {
              throw new Error('empty cached permissions');
            }
            get().setPermissions(permissions, roles);
            // 后台静默刷新（不重置 isLoading，不阻塞 UI），纠正陈旧/空缓存
            void get().fetchAndApply(adminId);
            return;
          } catch {
            // 缓存解析失败或为空，继续走网络加载
          }
        }

        set({ isLoading: true, error: null });
        await get().fetchAndApply(adminId);
      },

      hasPermission: (permissionCode) => {
        const { permissions } = get();
        if (permissions.includes('all')) return true;
        return permissions.includes(permissionCode);
      },

      hasAnyPermission: (permissionCodes) => {
        const { permissions } = get();
        if (permissions.includes('all')) return true;
        return permissionCodes.some((code) => permissions.includes(code));
      },

      hasAllPermissions: (permissionCodes) => {
        const { permissions } = get();
        if (permissions.includes('all')) return true;
        return permissionCodes.every((code) => permissions.includes(code));
      },

      setPermissions: (permissions, roles) => {
        const isSuperAdmin = roles.includes('super_admin');
        const isAdmin = roles.some((r) => ['admin', 'super_admin'].includes(r));
        set({
          permissions,
          roles,
          isLoading: false,
          error: null,
          isAdmin,
          isSuperAdmin,
        });
      },

      reloadPermissions: () => {
        permissionCacheTimestamp = 0;
        localStorage.removeItem(PERMISSION_CACHE_TS_KEY);
        localStorage.removeItem('user_permissions');
        localStorage.removeItem('user_roles');
        // 先置为加载中，否则 loadPermissions 的 !isLoading 守卫会直接跳过，导致"重新加载"无效
        set({ isLoading: true, error: null });
        const adminStr = localStorage.getItem('admin');
        if (adminStr) {
          try {
            const admin = JSON.parse(adminStr);
            get().loadPermissions(admin.id);
          } catch {
            get().clearPermissions();
          }
        } else {
          get().clearPermissions();
        }
      },

      clearPermissions: () => {
        set({
          permissions: [],
          roles: [],
          isLoading: false,
          error: null,
          isAdmin: false,
          isSuperAdmin: false,
        });
        localStorage.removeItem('user_permissions');
        localStorage.removeItem('user_roles');
      },
    }),
    {
      name: 'permission-storage',
      partialize: (state) => ({
        permissions: state.permissions,
        roles: state.roles,
        isAdmin: state.isAdmin,
        isSuperAdmin: state.isSuperAdmin,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.isLoading = true;
            state.error = null;
          }
        };
      },
    }
  )
);
