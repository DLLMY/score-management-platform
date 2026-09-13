/**
 * 统一权限管理页面 - 整合用户管理、角色管理、权限管理（逻辑层 hook · 组合根）
 *
 * 承接原 PermissionManagement.tsx 中全部 state / effect / loader / handler / 列定义，
 * 主文件退化为「hook → PermissionManagementView」的薄装配；
 * 域逻辑（管理员/班级、RBAC 角色/权限/日志、管理员角色分配）下沉到独立子 hook。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api, { ClassInfo } from '../../services/api';
import rbacApi from '../../services/rbacApi';
import { useConfirm } from '../../components';
import { useStableToast, useSubmitGuard } from '../../hooks';
import { Admin } from '../../types';
import { useAdminClassLogic } from './useAdminClassLogic';
import { useRbacLogic } from './useRbacLogic';
import { useAdminRoleAssignment } from './useAdminRoleAssignment';

export function usePermissionManagementLogic() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [activeTab, setActiveTab] = useState<string>('admins');
  const [loading, setLoading] = useState<boolean>(false);

  // —— 域逻辑子模块（先 RBAC 以取其 roles 供管理员列表列定义使用）——
  const rbac = useRbacLogic({ showToast, confirmRef });
  const adminClass = useAdminClassLogic({ showToast, confirmRef, roles: rbac.roles });
  const roleAssign = useAdminRoleAssignment({
    showToast,
    adminRolesMap: adminClass.adminRolesMap,
    setAdminRolesMap: adminClass.setAdminRolesMap,
  });

  const { setAdmins, setClasses, setAdminRolesMap } = adminClass;
  // ========== Fetch Data ==========
  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [adminsData, classesData] = await Promise.all([
        api.admins.getAll(),
        api.classes.getAll(),
      ]);
      const adminList = Array.isArray(adminsData)
        ? adminsData
        : (adminsData as { admins?: Admin[] })?.admins || [];
      setAdmins(adminList);
      setClasses(
        Array.isArray(classesData)
          ? classesData
          : (classesData as { classes?: ClassInfo[] })?.classes || []
      );

      // 批量获取管理员的RBAC角色（并行请求）
      const rolesResults = await Promise.all(
        adminList.map((admin: Admin) =>
          rbacApi.getAdminRoles(Number(admin.id)).catch(() => ({ roles: [] as string[] }))
        )
      );
      const rolesMap: Record<number, string[]> = {};
      adminList.forEach((admin: Admin, index: number) => {
        rolesMap[Number(admin.id)] = rolesResults[index].roles || [];
      });
      setAdminRolesMap(rolesMap);
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showToast, setAdmins, setClasses, setAdminRolesMap]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    // —— 壳层 / 全局 ——
    loading,
    activeTab,
    setActiveTab,
    submitting,
    runSubmit,
    // —— 管理员 / 班级 / RBAC / 角色分配（域子模块）——
    ...adminClass,
    ...rbac,
    ...roleAssign,
  };
}
