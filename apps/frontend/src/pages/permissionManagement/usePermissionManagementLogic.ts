/**
 * 统一权限管理页面 - 整合用户管理、角色管理、权限管理（逻辑层 hook）
 *
 * 承接原 PermissionManagement.tsx 中全部 state / effect / loader / handler / 列定义，
 * 主文件退化为「hook → PermissionManagementView」的薄装配。
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api, { ClassInfo } from '../../services/api';
import rbacApi, { Permission, RoleWithPermissions } from '../../services/rbacApi';
import { useConfirm } from '../../components';
import { useStableToast, useSubmitGuard } from '../../hooks';
import { UserRole, Admin, ID } from '../../types';
import {
  createAdminColumns,
  createClassColumns,
  createRoleColumns,
  createLogColumns,
  filterPermissions,
  groupPermissions,
} from './helpers';
import type {
  PermissionLog,
  AdminFormData,
  ClassFormData,
  RoleFormData,
  PermissionFormData,
} from './types';

export function usePermissionManagementLogic() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [activeTab, setActiveTab] = useState<string>('admins');
  const [loading, setLoading] = useState<boolean>(false);

  // ========== Admins Management ==========
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [adminFormData, setAdminFormData] = useState<AdminFormData>({
    username: '',
    password: '',
    real_name: '',
    phone: '',
    role: 'teacher',
    roles: [],
    class_name: '',
  });
  const [adminRolesMap, setAdminRolesMap] = useState<Record<ID, string[]>>({});
  const [showRoleAssignModal, setShowRoleAssignModal] = useState(false);
  const [selectedAdminForRoles, setSelectedAdminForRoles] = useState<Admin | null>(null);
  const [selectedRolesForAdmin, setSelectedRolesForAdmin] = useState<string[]>([]);

  // ========== Classes Management ==========
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [classFormData, setClassFormData] = useState<ClassFormData>({
    name: '',
    grade: '',
    description: '',
  });

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
  }, [showToast]);

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
    fetchData();
    fetchRBACData();
  }, [fetchData, fetchRBACData]);

  // ========== Admin Handlers ==========
  const handleCreateAdmin = useCallback((): void => {
    setEditingAdmin(null);
    setAdminFormData({
      username: '',
      password: '',
      real_name: '',
      phone: '',
      role: 'teacher',
      roles: [],
      class_name: '',
    });
    setShowAdminModal(true);
  }, []);

  const handleEditAdmin = useCallback(
    (admin: Admin): void => {
      setEditingAdmin(admin);
      const adminRoles = adminRolesMap[admin.id] || [];
      setAdminFormData({
        username: admin.username,
        password: '',
        real_name: admin.real_name || '',
        phone: admin.phone || '',
        role: (adminRoles.length > 0 ? adminRoles[0] : admin.role) as UserRole,
        roles: adminRoles,
        class_name: admin.class_name || '',
      });
      setShowAdminModal(true);
    },
    [adminRolesMap]
  );

  const handleSaveAdmin = useCallback(async (): Promise<void> => {
    if (!adminFormData.username) {
      showToast('error', '请输入用户名');
      return;
    }
    if (!editingAdmin && !adminFormData.password) {
      showToast('error', '请输入密码');
      return;
    }

    try {
      if (editingAdmin) {
        const updateData = { ...adminFormData };
        if (!updateData.password) delete updateData.password;
        const result = await api.admins.update(Number(editingAdmin.id), updateData);
        showToast('success', '管理员更新成功');
        const updatedAdmin = (result as { admin?: Admin }).admin || {
          ...editingAdmin,
          ...updateData,
        };
        setAdmins((prev) => prev.map((a) => (a.id === editingAdmin.id ? updatedAdmin : a)));
      } else {
        const result = await api.admins.create(adminFormData);
        showToast('success', '管理员创建成功');
        const newAdmin: Admin = {
          id: (result as { admin_id?: number }).admin_id || 0, // 前端临时 id，仅供列表渲染定位，服务端返回后覆盖
          username: adminFormData.username,
          name: adminFormData.real_name,
          real_name: adminFormData.real_name,
          role: adminFormData.role,
          role_type: adminFormData.role,
          phone: adminFormData.phone,
          class_name: adminFormData.class_name,
          is_active: true,
          created_at: new Date().toISOString(), // 乐观更新占位时间，服务端创建后以返回时间为准
        };
        setAdmins((prev) => [newAdmin, ...prev]);
      }
      setShowAdminModal(false);
    } catch (err: unknown) {
      showToast('error', '操作失败: ' + (err as Error).message);
    }
  }, [adminFormData, editingAdmin, showToast]);

  const handleDeleteAdmin = useCallback(
    async (admin: Admin): Promise<void> => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: `确定要删除管理员 ${admin.real_name} 吗？`,
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.admins.delete(Number(admin.id));
        showToast('success', '管理员删除成功');
        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
      } catch (err: unknown) {
        showToast('error', '删除失败: ' + (err as Error).message);
      }
    },
    [showToast]
  );

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

  // ========== Class Handlers ==========
  const handleCreateClass = useCallback((): void => {
    setEditingClass(null);
    setClassFormData({ name: '', grade: '', description: '' });
    setShowClassModal(true);
  }, []);

  const handleEditClass = useCallback((cls: ClassInfo): void => {
    setEditingClass(cls);
    setClassFormData({
      name: cls.name,
      grade: cls.grade,
      description: cls.description,
    });
    setShowClassModal(true);
  }, []);

  const handleSaveClass = useCallback(async (): Promise<void> => {
    if (!classFormData.name) {
      showToast('error', '请输入班级名称');
      return;
    }

    try {
      if (editingClass) {
        const updatedClass = await api.classes.update(editingClass.id, classFormData);
        showToast('success', '班级更新成功');
        setClasses((prev) => prev.map((c) => (c.id === editingClass.id ? updatedClass : c)));
      } else {
        const newClass = await api.classes.create(classFormData);
        showToast('success', '班级创建成功');
        setClasses((prev) => [newClass, ...prev]);
      }
      setShowClassModal(false);
    } catch (err: unknown) {
      showToast('error', '操作失败: ' + (err as Error).message);
    }
  }, [classFormData, editingClass, showToast]);

  const handleDeleteClass = useCallback(
    async (cls: ClassInfo): Promise<void> => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: `确定要删除班级 ${cls.name} 吗？`,
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.classes.delete(cls.id);
        showToast('success', '班级删除成功');
        setClasses((prev) => prev.filter((c) => c.id !== cls.id));
      } catch (err: unknown) {
        showToast('error', '删除失败: ' + (err as Error).message);
      }
    },
    [showToast]
  );

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

  const adminColumns = useMemo(
    () => createAdminColumns(adminRolesMap, roles),
    [adminRolesMap, roles]
  );

  const classColumns = useMemo(() => createClassColumns(), []);

  const roleColumns = useMemo(() => createRoleColumns(), []);

  const logColumns = useMemo(() => createLogColumns(), []);

  return {
    // —— 壳层 / 全局 ——
    loading,
    activeTab,
    setActiveTab,
    submitting,
    runSubmit,
    // —— 管理员 ——
    admins,
    adminColumns,
    handleCreateAdmin,
    handleEditAdmin,
    handleOpenRoleAssign,
    handleDeleteAdmin,
    adminFormData,
    setAdminFormData,
    editingAdmin,
    handleSaveAdmin,
    showAdminModal,
    setShowAdminModal,
    showRoleAssignModal,
    setShowRoleAssignModal,
    selectedAdminForRoles,
    selectedRolesForAdmin,
    toggleAdminRole,
    handleSaveAdminRoles,
    adminRolesMap,
    // —— 班级 ——
    classes,
    classColumns,
    handleCreateClass,
    handleEditClass,
    handleDeleteClass,
    classFormData,
    setClassFormData,
    editingClass,
    handleSaveClass,
    showClassModal,
    setShowClassModal,
    // —— 角色 ——
    roles,
    roleColumns,
    handleOpenCreateRole,
    handleOpenEditRole,
    handleDeleteRole,
    roleFormData,
    setRoleFormData,
    isEditingRole,
    handleSaveRole,
    showRoleModal,
    setShowRoleModal,
    availablePermissions,
    selectedPermissions,
    togglePermission,
    // —— 权限 ——
    groupedPermissions,
    handleOpenCreatePermission,
    handleOpenEditPermission,
    handleDeletePermission,
    permissionFormData,
    setPermissionFormData,
    isEditingPermission,
    handleSavePermission,
    showPermissionModal,
    setShowPermissionModal,
    permissionFilter,
    setPermissionFilter,
    // —— 日志 ——
    permissionLogs,
    logColumns,
    logPage,
    setLogPage,
    logPerPage,
    logTotal,
  };
}
