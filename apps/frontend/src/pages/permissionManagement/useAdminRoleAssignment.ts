import { useState, type Dispatch, type SetStateAction } from 'react';
import rbacApi from '../../services/rbacApi';
import { useStableToast } from '../../hooks';
import { Admin, ID } from '../../types';

export interface AdminRoleAssignmentDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  adminRolesMap: Record<ID, string[]>;
  setAdminRolesMap: Dispatch<SetStateAction<Record<ID, string[]>>>;
}

export interface AdminRoleAssignmentResult {
  showRoleAssignModal: boolean;
  setShowRoleAssignModal: Dispatch<SetStateAction<boolean>>;
  selectedAdminForRoles: Admin | null;
  selectedRolesForAdmin: string[];
  handleOpenRoleAssign: (admin: Admin) => void;
  toggleAdminRole: (roleCode: string) => void;
  handleSaveAdminRoles: () => Promise<void>;
}

/**
 * 管理员 RBAC 角色分配逻辑子模块。
 * 状态与 handler 原样搬自 usePermissionManagementLogic.ts，函数体逐字不变；
 * showToast / adminRolesMap / setAdminRolesMap 经 deps 注入（与 useAdminClassLogic 共享角色映射）。
 */
export function useAdminRoleAssignment(deps: AdminRoleAssignmentDeps): AdminRoleAssignmentResult {
  const { showToast, adminRolesMap, setAdminRolesMap } = deps;
  const [showRoleAssignModal, setShowRoleAssignModal] = useState(false);
  const [selectedAdminForRoles, setSelectedAdminForRoles] = useState<Admin | null>(null);
  const [selectedRolesForAdmin, setSelectedRolesForAdmin] = useState<string[]>([]);

  // ========== Admin Role Assignment Handlers ==========
  const handleOpenRoleAssign = (admin: Admin) => {
    setSelectedAdminForRoles(admin);
    setSelectedRolesForAdmin(adminRolesMap[admin.id] || []);
    setShowRoleAssignModal(true);
  };

  const toggleAdminRole = (roleCode: string) => {
    setSelectedRolesForAdmin((prev) => {
      if (prev.includes(roleCode)) {
        return prev.filter((r) => r !== roleCode);
      } else {
        return [...prev, roleCode];
      }
    });
  };

  const handleSaveAdminRoles = async () => {
    if (!selectedAdminForRoles) return;
    try {
      await rbacApi.assignRoles(Number(selectedAdminForRoles.id), selectedRolesForAdmin);
      showToast('success', '角色分配成功');
      setAdminRolesMap((prev) => ({
        ...prev,
        [selectedAdminForRoles.id]: selectedRolesForAdmin,
      }));
      setShowRoleAssignModal(false);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '角色分配失败';
      showToast('error', message);
    }
  };

  return {
    showRoleAssignModal,
    setShowRoleAssignModal,
    selectedAdminForRoles,
    selectedRolesForAdmin,
    handleOpenRoleAssign,
    toggleAdminRole,
    handleSaveAdminRoles,
  };
}
