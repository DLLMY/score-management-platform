import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type MutableRefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import api from '../../services/api';
import rbacApi, { Permission, RoleWithPermissions } from '../../services/rbacApi';
import { useConfirm } from '../../components';
import { useStableToast } from '../../hooks';
import {
  createRoleColumns,
  createLogColumns,
  filterPermissions,
  groupPermissions,
} from './helpers';
import type { PermissionLog, RoleFormData, PermissionFormData } from './types';

export interface RbacLogicDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  confirmRef: MutableRefObject<ReturnType<typeof useConfirm>>;
}

export interface RbacLogicResult {
  roles: RoleWithPermissions[];
  roleColumns: ReturnType<typeof createRoleColumns>;
  showRoleModal: boolean;
  setShowRoleModal: Dispatch<SetStateAction<boolean>>;
  isEditingRole: boolean;
  roleFormData: RoleFormData;
  setRoleFormData: Dispatch<SetStateAction<RoleFormData>>;
  handleOpenCreateRole: () => void;
  handleOpenEditRole: (role: RoleWithPermissions) => void;
  handleSaveRole: () => Promise<void>;
  handleDeleteRole: (role: RoleWithPermissions) => Promise<void>;
  permissions: Permission[];
  availablePermissions: Permission[];
  showPermissionModal: boolean;
  setShowPermissionModal: Dispatch<SetStateAction<boolean>>;
  isEditingPermission: boolean;
  permissionFormData: PermissionFormData;
  setPermissionFormData: Dispatch<SetStateAction<PermissionFormData>>;
  permissionFilter: { category: string; search: string };
  setPermissionFilter: Dispatch<SetStateAction<{ category: string; search: string }>>;
  groupedPermissions: Record<string, Permission[]>;
  handleOpenCreatePermission: () => void;
  handleOpenEditPermission: (permission: Permission) => void;
  handleSavePermission: () => Promise<void>;
  handleDeletePermission: (permission: Permission) => Promise<void>;
  selectedPermissions: string[];
  setSelectedPermissions: Dispatch<SetStateAction<string[]>>;
  togglePermission: (permCode: string) => void;
  permissionLogs: PermissionLog[];
  logColumns: ReturnType<typeof createLogColumns>;
  logPage: number;
  setLogPage: Dispatch<SetStateAction<number>>;
  logPerPage: number;
  logTotal: number;
}

/**
 * RBAC 角色 / 权限 / 权限日志逻辑子模块。
 * 状态、loader、handler 与原 useMemo 原样搬自 usePermissionManagementLogic.ts，函数体逐字不变；
 * showToast / confirmRef 经 deps 注入。
 */
export function useRbacLogic(deps: RbacLogicDeps): RbacLogicResult {
  const { showToast, confirmRef } = deps;

  // ========== Permission Logs ==========
  const [permissionLogs, setPermissionLogs] = useState<PermissionLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logPerPage] = useState(20);
  const [logTotal, setLogTotal] = useState(0);

  // ========== RBAC Roles ==========
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [roleFormData, setRoleFormData] = useState<RoleFormData>({
    role_code: '',
    role_name: '',
    description: '',
    permissions: [],
    is_active: true,
  });

  // ========== RBAC Permissions ==========
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isEditingPermission, setIsEditingPermission] = useState(false);
  const [permissionFormData, setPermissionFormData] = useState<PermissionFormData>({
    code: '',
    name: '',
    description: '',
    category: 'system',
    is_active: true,
  });
  const [permissionFilter, setPermissionFilter] = useState({
    category: '',
    search: '',
  });
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const loadPermissionLogs = useCallback(async (): Promise<void> => {
    try {
      const logsData = await api.permissionLogs.getAll({ page: logPage, per_page: logPerPage });
      const logs = Array.isArray(logsData)
        ? logsData
        : (logsData as { logs?: PermissionLog[] })?.logs || [];
      setPermissionLogs(logs);
      setLogTotal(
        (logsData as { pagination?: { total?: number } })?.pagination?.total ?? logs.length
      );
    } catch (err: unknown) {
      showToast('error', '获取权限日志失败: ' + (err as Error).message);
    }
  }, [logPage, logPerPage, showToast]);

  useEffect(() => {
    loadPermissionLogs();
  }, [loadPermissionLogs]);

  const fetchRBACData = useCallback(async (): Promise<void> => {
    try {
      const [rolesData, permsData] = await Promise.all([
        rbacApi.getRoles(),
        rbacApi.getPermissions(),
      ]);
      setRoles(rolesData || []);
      setPermissions(permsData || []);
      setAvailablePermissions(permsData || []);
    } catch (err: unknown) {
      showToast('error', '获取RBAC数据失败: ' + (err as Error).message);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRBACData();
  }, [fetchRBACData]);

  // ========== Role Handlers ==========
  const handleOpenCreateRole = () => {
    setIsEditingRole(false);
    setRoleFormData({
      role_code: '',
      role_name: '',
      description: '',
      permissions: [],
      is_active: true,
    });
    setSelectedPermissions([]);
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (role: RoleWithPermissions) => {
    setIsEditingRole(true);
    setRoleFormData({
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description || '',
      permissions: role.permissions,
      is_active: role.is_active,
    });
    setSelectedPermissions(role.permissions || []);
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    try {
      if (isEditingRole) {
        await rbacApi.updateRole(roleFormData.role_code, {
          role_name: roleFormData.role_name,
          description: roleFormData.description,
          permissions: selectedPermissions,
          is_active: roleFormData.is_active,
        });
        showToast('success', '角色更新成功');
      } else {
        await rbacApi.createRole({
          role_code: roleFormData.role_code,
          role_name: roleFormData.role_name,
          description: roleFormData.description,
          permissions: selectedPermissions,
          is_active: roleFormData.is_active,
        });
        showToast('success', '角色创建成功');
      }
      setShowRoleModal(false);
      fetchRBACData();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '保存角色失败';
      showToast('error', message);
    }
  };

  const handleDeleteRole = async (role: RoleWithPermissions) => {
    const ok = await confirmRef.current({
      title: '删除确认',
      message: `确定要删除角色 "${role.role_name}" 吗？`,
      confirmText: '删除',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await rbacApi.deleteRole(role.role_code);
      showToast('success', '角色删除成功');
      fetchRBACData();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '删除角色失败';
      showToast('error', message);
    }
  };

  // ========== Permission Handlers ==========
  const handleOpenCreatePermission = () => {
    setIsEditingPermission(false);
    setPermissionFormData({
      code: '',
      name: '',
      description: '',
      category: 'system',
      is_active: true,
    });
    setShowPermissionModal(true);
  };

  const handleOpenEditPermission = (permission: Permission) => {
    setIsEditingPermission(true);
    setPermissionFormData({
      code: permission.code,
      name: permission.name,
      description: permission.description || '',
      category: permission.category || 'system',
      is_active: permission.is_active,
    });
    setShowPermissionModal(true);
  };

  const handleSavePermission = async () => {
    try {
      if (isEditingPermission) {
        await rbacApi.updatePermission(permissionFormData.code, permissionFormData);
        showToast('success', '权限更新成功');
      } else {
        await rbacApi.createPermission(permissionFormData);
        showToast('success', '权限创建成功');
      }
      setShowPermissionModal(false);
      fetchRBACData();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '保存权限失败';
      showToast('error', message);
    }
  };

  const handleDeletePermission = async (permission: Permission) => {
    const ok = await confirmRef.current({
      title: '删除确认',
      message: `确定要删除权限 "${permission.name}" 吗？`,
      confirmText: '删除',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await rbacApi.deletePermission(permission.code);
      showToast('success', '权限删除成功');
      fetchRBACData();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '删除权限失败';
      showToast('error', message);
    }
  };

  // ========== Permission Toggle ==========
  const togglePermission = (permCode: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permCode)) {
        return prev.filter((p) => p !== permCode);
      } else {
        return [...prev, permCode];
      }
    });
  };

  // ========== Derived Data ==========
  const filteredPermissions = useMemo(
    () => filterPermissions(permissions, permissionFilter),
    [permissions, permissionFilter]
  );

  const groupedPermissions = useMemo(
    () => groupPermissions(filteredPermissions),
    [filteredPermissions]
  );

  const roleColumns = useMemo(() => createRoleColumns(), []);
  const logColumns = useMemo(() => createLogColumns(), []);

  return {
    roles,
    roleColumns,
    showRoleModal,
    setShowRoleModal,
    isEditingRole,
    roleFormData,
    setRoleFormData,
    handleOpenCreateRole,
    handleOpenEditRole,
    handleSaveRole,
    handleDeleteRole,
    permissions,
    availablePermissions,
    showPermissionModal,
    setShowPermissionModal,
    isEditingPermission,
    permissionFormData,
    setPermissionFormData,
    permissionFilter,
    setPermissionFilter,
    groupedPermissions,
    handleOpenCreatePermission,
    handleOpenEditPermission,
    handleSavePermission,
    handleDeletePermission,
    selectedPermissions,
    setSelectedPermissions,
    togglePermission,
    permissionLogs,
    logColumns,
    logPage,
    setLogPage,
    logPerPage,
    logTotal,
  };
}
