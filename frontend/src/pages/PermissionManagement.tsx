// -*- coding: utf-8 -*-
/**
 * 统一权限管理页面 - 整合用户管理、角色管理、权限管理
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  Shield,
  School,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  CheckCircle,
  XCircle,
  Crown,
} from 'lucide-react';
import api, { ClassInfo } from '../services/api';
import rbacApi, { Permission, RoleWithPermissions } from '../services/rbacApi';
import {
  Card,
  Button,
  Modal,
  LoadingSpinner,
  SearchFilter,
  PermissionButton,
  DataTable,
} from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useStableToast } from '../hooks/useStableToast';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { UserRole, Admin, ID } from '../types';

interface PermissionLog {
  id: number;
  action: string;
  target_type: string;
  description: string;
  ip_address: string;
  created_at: string;
}

interface AdminFormData {
  username: string;
  password?: string;
  real_name: string;
  phone: string;
  role: UserRole;
  roles: string[];
  class_name: string;
}

interface ClassFormData {
  name: string;
  grade: string;
  description: string;
}

interface RoleFormData {
  role_code: string;
  role_name: string;
  description: string;
  permissions: string[];
  is_active: boolean;
}

interface PermissionFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
}

function PermissionManagement() {
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
      const [adminsData, classesData, logsData] = await Promise.all([
        api.admins.getAll(),
        api.classes.getAll(),
        api.permissionLogs.getAll(),
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
      setPermissionLogs(
        Array.isArray(logsData) ? logsData : (logsData as { logs?: PermissionLog[] })?.logs || []
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

  // ========== Utils ==========
  const getRoleLabel = useMemo(() => {
    return (role: string): string => {
      const roles: Record<string, string> = {
        super_admin: '超级管理员',
        admin: '管理员',
        teacher: '班主任',
        subject_teacher: '任课教师',
        dashboard: '数据大屏用户',
        dashboard_viewer: '数据大屏用户',
        head_teacher: '年级组长',
        viewer: '查看者',
        operator: '运维人员',
      };
      return roles[role] || role;
    };
  }, []);

  const getRoleBadgeColor = useMemo(() => {
    return (role: string): string => {
      const colors: Record<string, string> = {
        super_admin: 'bg-red-100 text-red-800',
        admin: 'bg-pink-100 text-pink-800',
        teacher: 'bg-blue-100 text-blue-800',
        subject_teacher: 'bg-green-100 text-green-800',
        dashboard: 'bg-purple-100 text-purple-800',
        dashboard_viewer: 'bg-purple-100 text-purple-800',
        head_teacher: 'bg-orange-100 text-orange-800',
        viewer: 'bg-gray-100 text-gray-800',
        operator: 'bg-cyan-100 text-cyan-800',
      };
      return colors[role] || 'bg-gray-100 text-gray-800';
    };
  }, []);

  const PERMISSION_CATEGORIES = [
    { value: '', label: '全部分类' },
    { value: '学生管理', label: '学生管理' },
    { value: '教务管理', label: '教务管理' },
    { value: '积分管理', label: '积分管理' },
    { value: '设备管理', label: '设备管理' },
    { value: '成绩管理', label: '成绩管理' },
    { value: '数据分析', label: '数据分析' },
    { value: '通知中心', label: '通知中心' },
    { value: '系统管理', label: '系统管理' },
    { value: '班主任工作台', label: '班主任工作台' },
    // 兼容后端RBAC返回的英文category值
    { value: 'homework', label: '班主任工作台·作业' },
    { value: 'attendance', label: '班主任工作台·考勤' },
    { value: 'mental_health', label: '班主任工作台·心理' },
    { value: 'activity', label: '班主任工作台·活动' },
    { value: 'study_group', label: '班主任工作台·学习小组' },
    { value: 'study_guide', label: '班主任工作台·学法指导' },
  ];

  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      if (permissionFilter.category && p.category !== permissionFilter.category) {
        return false;
      }
      if (permissionFilter.search) {
        const search = permissionFilter.search.toLowerCase();
        return (
          p.name.toLowerCase().includes(search) ||
          p.code.toLowerCase().includes(search) ||
          p.description?.toLowerCase().includes(search) ||
          false
        );
      }
      return true;
    });
  }, [permissions, permissionFilter]);

  const groupedPermissions = useMemo(() => {
    return filteredPermissions.reduce((acc, p) => {
      const cat = p.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [filteredPermissions]);

  // ========== DataTable Columns ==========
  const adminColumns = useMemo<ColumnType<Admin>[]>(
    () => [
      {
        title: '用户',
        key: 'user',
        dataIndex: 'real_name',
        width: 200,
        render: (_, admin) => (
          <div className='flex items-center'>
            <div className='flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center'>
              <span className='text-white font-bold'>
                {(admin.real_name || admin.username)[0]}
              </span>
            </div>
            <div className='ml-4'>
              <div className='text-sm font-medium text-gray-900'>{admin.real_name}</div>
              <div className='text-sm text-gray-500'>{admin.username}</div>
            </div>
          </div>
        ),
      },
      {
        title: '角色',
        key: 'roles',
        width: 220,
        render: (_, admin) => (
          <div className='flex flex-wrap gap-1'>
            {adminRolesMap[admin.id]?.map((roleCode) => {
              const role = roles.find((r) => r.role_code === roleCode);
              const roleName = role?.role_name || getRoleLabel(roleCode);
              const colorClass = getRoleBadgeColor(roleCode);
              return (
                <span
                  key={roleCode}
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}
                >
                  {roleName}
                </span>
              );
            }) || (
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                  admin.role
                )}`}
              >
                {getRoleLabel(admin.role)}
              </span>
            )}
          </div>
        ),
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'is_active',
        width: 80,
        render: (value) =>
          value ? (
            <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800'>
              启用
            </span>
          ) : (
            <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-600'>
              禁用
            </span>
          ),
      },
      {
        title: '班级',
        key: 'class_name',
        dataIndex: 'class_name',
        width: 120,
        render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
      },
      {
        title: '电话',
        key: 'phone',
        dataIndex: 'phone',
        width: 130,
        render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
      },
    ],
    [adminRolesMap, roles, getRoleLabel, getRoleBadgeColor]
  );

  const classColumns = useMemo<ColumnType<ClassInfo>[]>(
    () => [
      {
        title: '班级名称',
        key: 'name',
        dataIndex: 'name',
        width: 180,
        render: (value) => (
          <div className='text-sm font-medium text-gray-900'>{value as string}</div>
        ),
      },
      {
        title: '年级',
        key: 'grade',
        dataIndex: 'grade',
        width: 120,
        render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
      },
      {
        title: '描述',
        key: 'description',
        dataIndex: 'description',
        render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'is_active',
        width: 100,
        render: (value) =>
          value !== false ? (
            <span className='flex items-center text-green-600'>
              <CheckCircle className='w-5 h-5' />
              <span className='ml-1 text-sm'>启用</span>
            </span>
          ) : (
            <span className='flex items-center text-red-600'>
              <XCircle className='w-5 h-5' />
              <span className='ml-1 text-sm'>禁用</span>
            </span>
          ),
      },
    ],
    []
  );

  const roleColumns = useMemo<ColumnType<RoleWithPermissions>[]>(
    () => [
      {
        title: '角色名称',
        key: 'role_name',
        dataIndex: 'role_name',
        width: 200,
        render: (_, role) => (
          <div>
            <div className='font-medium text-gray-900'>{role.role_name}</div>
            {role.description && <div className='text-sm text-gray-500'>{role.description}</div>}
          </div>
        ),
      },
      {
        title: '角色代码',
        key: 'role_code',
        dataIndex: 'role_code',
        width: 140,
        render: (value) => <span className='text-sm text-gray-500 font-mono'>{value as string}</span>,
      },
      {
        title: '权限数量',
        key: 'permission_count',
        width: 100,
        render: (_, role) => (
          <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800'>
            {role.permissions?.length || 0}
          </span>
        ),
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'is_active',
        width: 80,
        render: (value) => (
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {value ? '启用' : '禁用'}
          </span>
        ),
      },
    ],
    []
  );

  const logColumns = useMemo<ColumnType<PermissionLog>[]>(
    () => [
      {
        title: '操作',
        key: 'action',
        dataIndex: 'action',
        width: 120,
        render: (value) => {
          const action = value as string;
          return (
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                action.includes('创建')
                  ? 'bg-green-100 text-green-800'
                  : action.includes('删除')
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {action}
            </span>
          );
        },
      },
      {
        title: '目标类型',
        key: 'target_type',
        dataIndex: 'target_type',
        width: 120,
        render: (value) => <span className='text-sm text-gray-500'>{value as string}</span>,
      },
      {
        title: '描述',
        key: 'description',
        dataIndex: 'description',
        render: (value) => <span className='text-sm text-gray-500'>{value as string}</span>,
      },
      {
        title: 'IP地址',
        key: 'ip_address',
        dataIndex: 'ip_address',
        width: 150,
        render: (value) => <span className='text-sm text-gray-500 font-mono'>{value as string}</span>,
      },
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        width: 180,
        render: (value) => (
          <span className='text-sm text-gray-500'>
            {value ? new Date(value as string).toLocaleString('zh-CN') : '--'}
          </span>
        ),
      },
    ],
    []
  );

  // ========== Render ==========
  if (loading) return <LoadingSpinner />;

  return (
    <div className='space-y-6'>
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>权限管理系统</h1>
          <p className='text-gray-500 mt-1'>管理系统用户、角色和权限</p>
        </div>
      </div>

      <div className='border-b border-gray-200'>
        <nav className='flex space-x-8'>
          {/* 用户管理 */}
          <button
            onClick={() => setActiveTab('admins')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'admins'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Users className='w-5 h-5' />
              <span>用户管理</span>
            </div>
          </button>

          {/* 班级管理 */}
          <button
            onClick={() => setActiveTab('classes')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'classes'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <School className='w-5 h-5' />
              <span>班级管理</span>
            </div>
          </button>

          {/* 角色管理 */}
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Crown className='w-5 h-5' />
              <span>角色管理</span>
            </div>
          </button>

          {/* 权限管理 */}
          <button
            onClick={() => setActiveTab('permissions')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'permissions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Shield className='w-5 h-5' />
              <span>权限管理</span>
            </div>
          </button>

          {/* 权限日志 */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Shield className='w-5 h-5' />
              <span>权限日志</span>
            </div>
          </button>
        </nav>
      </div>

      {/* ========== Admins Tab ========== */}
      {activeTab === 'admins' && (
        <div>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>管理员列表</h2>
            <PermissionButton permission='system.users' onClick={handleCreateAdmin}>
              <UserPlus className='w-4 h-4 mr-2' />
              添加管理员
            </PermissionButton>
          </div>

          <Card>
            <DataTable<Admin>
              columns={adminColumns}
              dataSource={admins}
              rowKey='id'
              scroll={{ x: 900 }}
              empty={{
                icon: 'users',
                title: '暂无管理员',
                description: '点击「添加管理员」创建第一个管理员',
              }}
              rowActions={(admin) => (
                <div className='flex items-center justify-end gap-2'>
                  <PermissionButton
                    permission='system.users'
                    variant='secondary'
                    size='sm'
                    onClick={() => handleEditAdmin(admin)}
                  >
                    <Edit2 className='w-4 h-4' />
                  </PermissionButton>
                  <PermissionButton
                    permission='system.roles'
                    variant='outline'
                    size='sm'
                    onClick={() => handleOpenRoleAssign(admin)}
                  >
                    <Crown className='w-4 h-4' />
                  </PermissionButton>
                  {admin.username !== 'admin' && (
                    <PermissionButton
                      permission='system.users'
                      variant='danger'
                      size='sm'
                      onClick={() => handleDeleteAdmin(admin)}
                    >
                      <Trash2 className='w-4 h-4' />
                    </PermissionButton>
                  )}
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* ========== Classes Tab ========== */}
      {activeTab === 'classes' && (
        <div>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>班级列表</h2>
            <PermissionButton permission='class.manage' onClick={handleCreateClass}>
              <Plus className='w-4 h-4 mr-2' />
              添加班级
            </PermissionButton>
          </div>

          <Card>
            <DataTable<ClassInfo>
              columns={classColumns}
              dataSource={classes}
              rowKey='id'
              scroll={{ x: 720 }}
              empty={{
                icon: 'data',
                title: '暂无班级',
                description: '点击「添加班级」创建第一个班级',
              }}
              rowActions={(cls) => (
                <div className='flex items-center justify-end gap-2'>
                  <PermissionButton
                    permission='class.manage'
                    variant='secondary'
                    size='sm'
                    onClick={() => handleEditClass(cls)}
                  >
                    <Edit2 className='w-4 h-4' />
                  </PermissionButton>
                  <PermissionButton
                    permission='class.manage'
                    variant='danger'
                    size='sm'
                    onClick={() => handleDeleteClass(cls)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </PermissionButton>
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* ========== Roles Tab ========== */}
      {activeTab === 'roles' && (
        <div>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>角色列表</h2>
            <PermissionButton permission='system.roles' onClick={handleOpenCreateRole}>
              <Plus className='w-4 h-4 mr-2' />
              创建角色
            </PermissionButton>
          </div>

          <Card>
            <DataTable<RoleWithPermissions>
              columns={roleColumns}
              dataSource={roles}
              rowKey='role_code'
              scroll={{ x: 720 }}
              empty={{
                icon: 'data',
                title: '暂无角色',
                description: '点击「创建角色」创建第一个角色',
              }}
              rowActions={(role) => (
                <div className='flex items-center justify-end gap-2'>
                  <PermissionButton
                    permission='system.roles'
                    variant='secondary'
                    size='sm'
                    onClick={() => handleOpenEditRole(role)}
                  >
                    <Edit2 className='w-4 h-4' />
                  </PermissionButton>
                  <PermissionButton
                    permission='system.roles'
                    variant='danger'
                    size='sm'
                    onClick={() => handleDeleteRole(role)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </PermissionButton>
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* ========== Permissions Tab ========== */}
      {activeTab === 'permissions' && (
        <div>
          <div className='flex gap-4 mb-4'>
            <SearchFilter
              placeholder='搜索权限...'
              value={permissionFilter.search}
              onChange={(value) => setPermissionFilter((prev) => ({ ...prev, search: value }))}
              className='flex-1'
            />
            <select
              value={permissionFilter.category}
              onChange={(e) =>
                setPermissionFilter((prev) => ({ ...prev, category: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 rounded-lg text-sm'
            >
              <option value=''>全部分类</option>
              {PERMISSION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <PermissionButton permission='system.roles' onClick={handleOpenCreatePermission}>
              <Plus className='w-4 h-4 mr-2' />
              创建权限
            </PermissionButton>
          </div>

          <div className='space-y-6'>
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <Card key={category}>
                <div className='px-4 py-3 border-b border-gray-200'>
                  <h3 className='font-medium text-gray-900'>
                    {PERMISSION_CATEGORIES.find((c) => c.value === category)?.label || category}
                  </h3>
                </div>
                <div className='divide-y divide-gray-200'>
                  {perms.map((permission) => (
                    <div
                      key={permission.id}
                      className='px-4 py-3 flex items-center justify-between hover:bg-gray-50'
                    >
                      <div>
                        <div className='font-medium text-gray-900'>{permission.name}</div>
                        <div className='text-sm text-gray-500 font-mono'>{permission.code}</div>
                        {permission.description && (
                          <div className='text-sm text-gray-400 mt-1'>{permission.description}</div>
                        )}
                      </div>
                      <div className='flex items-center gap-3'>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            permission.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {permission.is_active ? '启用' : '禁用'}
                        </span>
                        <div className='flex gap-1'>
                          <PermissionButton
                            permission='system.roles'
                            variant='secondary'
                            size='sm'
                            onClick={() => handleOpenEditPermission(permission)}
                          >
                            <Edit2 className='w-4 h-4' />
                          </PermissionButton>
                          <PermissionButton
                            permission='system.roles'
                            variant='danger'
                            size='sm'
                            onClick={() => handleDeletePermission(permission)}
                          >
                            <Trash2 className='w-4 h-4' />
                          </PermissionButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========== Logs Tab ========== */}
      {activeTab === 'logs' && (
        <div>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>权限操作日志</h2>
          <Card>
            <DataTable<PermissionLog>
              columns={logColumns}
              dataSource={permissionLogs}
              rowKey='id'
              scroll={{ x: 800 }}
              empty={{
                icon: 'data',
                title: '暂无权限日志',
                description: '这里还没有任何操作记录',
              }}
            />
          </Card>
        </div>
      )}

      {/* ========== Modals ========== */}
      {/* Admin Modal */}
      <Modal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        title={editingAdmin ? '编辑管理员' : '添加管理员'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>用户名</label>
            <input
              type='text'
              value={adminFormData.username}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, username: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {editingAdmin ? '新密码（留空不修改）' : '密码'}
            </label>
            <input
              type='password'
              value={adminFormData.password || ''}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, password: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>真实姓名</label>
            <input
              type='text'
              value={adminFormData.real_name}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, real_name: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>电话</label>
            <input
              type='text'
              value={adminFormData.phone}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>角色（可多选）</label>
            <div className='flex flex-wrap gap-3'>
              {roles
                .filter((r) => r.is_active)
                .map((role) => (
                  <label
                    key={role.role_code}
                    className='flex items-center space-x-2 cursor-pointer'
                  >
                    <input
                      type='checkbox'
                      checked={adminFormData.roles.includes(role.role_code)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setAdminFormData((prev) => ({
                          ...prev,
                          roles: isChecked
                            ? [...prev.roles, role.role_code]
                            : prev.roles.filter((r) => r !== role.role_code),
                          role: (isChecked
                            ? role.role_code
                            : prev.roles.length > 1
                            ? prev.role
                            : 'viewer') as UserRole,
                        }));
                      }}
                      className='w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500'
                    />
                    <span className='text-sm text-gray-700'>{role.role_name}</span>
                  </label>
                ))}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {adminFormData.roles.length} 个角色
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级</label>
            <select
              value={adminFormData.class_name}
              onChange={(e) =>
                setAdminFormData((prev) => ({ ...prev, class_name: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              <option value=''>无</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowAdminModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveAdmin)} disabled={submitting}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* Admin Role Assignment Modal */}
      <Modal
        isOpen={showRoleAssignModal}
        onClose={() => setShowRoleAssignModal(false)}
        title={`为 ${selectedAdminForRoles?.real_name || selectedAdminForRoles?.username} 分配角色`}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择角色</label>
            <div className='border border-gray-200 rounded-lg max-h-64 overflow-y-auto'>
              {roles.length === 0 ? (
                <div className='p-4 text-center text-gray-500 text-sm'>暂无角色可选</div>
              ) : (
                <div className='divide-y divide-gray-100'>
                  {roles.map((role) => (
                    <label
                      key={role.role_code}
                      className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer'
                    >
                      <div>
                        <div className='font-medium text-gray-900 text-sm'>{role.role_name}</div>
                        <div className='text-xs text-gray-500 font-mono'>{role.role_code}</div>
                        {role.description && (
                          <div className='text-xs text-gray-400 mt-1'>{role.description}</div>
                        )}
                      </div>
                      <input
                        type='checkbox'
                        checked={selectedRolesForAdmin.includes(role.role_code)}
                        onChange={() => toggleAdminRole(role.role_code)}
                        className='w-4 h-4 text-blue-600 rounded'
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {selectedRolesForAdmin.length} 个角色
            </div>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowRoleAssignModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveAdminRoles)} disabled={submitting}>保存分配</Button>
          </div>
        </div>
      </Modal>

      {/* Class Modal */}
      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={editingClass ? '编辑班级' : '添加班级'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级名称</label>
            <input
              type='text'
              value={classFormData.name}
              onChange={(e) => setClassFormData((prev) => ({ ...prev, name: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>年级</label>
            <input
              type='text'
              value={classFormData.grade}
              onChange={(e) => setClassFormData((prev) => ({ ...prev, grade: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={classFormData.description}
              onChange={(e) =>
                setClassFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              rows={2}
            />
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowClassModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveClass)} disabled={submitting}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={isEditingRole ? '编辑角色' : '创建角色'}
        size='lg'
      >
        <div className='space-y-4'>
          {!isEditingRole && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                角色代码 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={roleFormData.role_code}
                onChange={(e) =>
                  setRoleFormData((prev) => ({ ...prev, role_code: e.target.value }))
                }
                placeholder='如: operator'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              />
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              角色名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={roleFormData.role_name}
              onChange={(e) => setRoleFormData((prev) => ({ ...prev, role_name: e.target.value }))}
              placeholder='如: 运维人员'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={roleFormData.description}
              onChange={(e) =>
                setRoleFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder='角色描述...'
              rows={2}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>权限分配</label>
            <div className='border border-gray-200 rounded-lg max-h-64 overflow-y-auto'>
              {availablePermissions.length === 0 ? (
                <div className='p-4 text-center text-gray-500 text-sm'>暂无权限可选</div>
              ) : (
                <div className='divide-y divide-gray-100'>
                  {availablePermissions.map((perm) => (
                    <label
                      key={perm.id}
                      className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer'
                    >
                      <div>
                        <div className='font-medium text-gray-900 text-sm'>{perm.name}</div>
                        <div className='text-xs text-gray-500 font-mono'>{perm.code}</div>
                      </div>
                      <input
                        type='checkbox'
                        checked={selectedPermissions.includes(perm.code)}
                        onChange={() => togglePermission(perm.code)}
                        className='w-4 h-4 text-blue-600 rounded'
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {selectedPermissions.length} 个权限
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='role-is-active'
              checked={roleFormData.is_active}
              onChange={(e) =>
                setRoleFormData((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              className='w-4 h-4 text-blue-600 rounded'
            />
            <label htmlFor='role-is-active' className='text-sm text-gray-700'>
              启用此角色
            </label>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowRoleModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveRole)} disabled={submitting}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* Permission Modal */}
      <Modal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title={isEditingPermission ? '编辑权限' : '创建权限'}
      >
        <div className='space-y-4'>
          {!isEditingPermission && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                权限代码 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={permissionFormData.code}
                onChange={(e) =>
                  setPermissionFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder='如: device.create'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              />
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              权限名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={permissionFormData.name}
              onChange={(e) => setPermissionFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder='如: 创建设备'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>分类</label>
            <select
              value={permissionFormData.category}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              {PERMISSION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={permissionFormData.description}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder='权限描述...'
              rows={2}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='perm-is-active'
              checked={permissionFormData.is_active}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              className='w-4 h-4 text-blue-600 rounded'
            />
            <label htmlFor='perm-is-active' className='text-sm text-gray-700'>
              启用此权限
            </label>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowPermissionModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSavePermission)} disabled={submitting}>保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PermissionManagement;
