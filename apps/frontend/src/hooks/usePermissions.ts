import { useEffect, useCallback, useMemo } from 'react';
import { usePermissionStore } from '../stores';

const ADMIN_INFO_KEY = 'admin';

interface AdminWithRoles {
  id: number;
  username: string;
  real_name: string;
  roles: string[];
  permissions: string[];
}

export function usePermissions() {
  const {
    permissions,
    roles,
    isLoading,
    error,
    isAdmin,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    loadPermissions,
    reloadPermissions,
  } = usePermissionStore();

  useEffect(() => {
    const adminStr = localStorage.getItem(ADMIN_INFO_KEY);
    if (adminStr && isLoading) {
      try {
        const admin = JSON.parse(adminStr);
        loadPermissions(admin.id);
      } catch {}
    }
  }, [isLoading, loadPermissions]);

  const adminInfo = useMemo<AdminWithRoles | null>(() => {
    const adminStr = localStorage.getItem(ADMIN_INFO_KEY);
    if (!adminStr) return null;
    try {
      const admin = JSON.parse(adminStr);
      return {
        id: admin.id,
        username: admin.username,
        real_name: admin.real_name,
        roles,
        permissions,
      };
    } catch {
      return null;
    }
  }, [permissions, roles]);

  const reload = useCallback(() => {
    reloadPermissions();
  }, [reloadPermissions]);

  return {
    permissions,
    roles,
    isLoading,
    error: error ? new Error(error) : null,
    adminInfo,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    isAdmin,
    reload,
  };
}

export default usePermissions;
