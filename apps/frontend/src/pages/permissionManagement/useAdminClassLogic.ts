import {
  useState,
  useCallback,
  useMemo,
  type MutableRefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import api, { ClassInfo } from '../../services/api';
import { useConfirm } from '../../components';
import { useStableToast } from '../../hooks';
import { UserRole, Admin, ID } from '../../types';
import { createAdminColumns, createClassColumns } from './helpers';
import type { AdminFormData, ClassFormData } from './types';
import type { RoleWithPermissions } from '../../services/rbacApi';

export interface AdminClassLogicDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  confirmRef: MutableRefObject<ReturnType<typeof useConfirm>>;
  roles: RoleWithPermissions[];
}

export interface AdminClassLogicResult {
  admins: Admin[];
  setAdmins: Dispatch<SetStateAction<Admin[]>>;
  adminRolesMap: Record<ID, string[]>;
  setAdminRolesMap: Dispatch<SetStateAction<Record<ID, string[]>>>;
  adminColumns: ReturnType<typeof createAdminColumns>;
  showAdminModal: boolean;
  setShowAdminModal: Dispatch<SetStateAction<boolean>>;
  editingAdmin: Admin | null;
  adminFormData: AdminFormData;
  setAdminFormData: Dispatch<SetStateAction<AdminFormData>>;
  handleCreateAdmin: () => void;
  handleEditAdmin: (admin: Admin) => void;
  handleSaveAdmin: () => Promise<void>;
  handleDeleteAdmin: (admin: Admin) => Promise<void>;
  classes: ClassInfo[];
  setClasses: Dispatch<SetStateAction<ClassInfo[]>>;
  classColumns: ReturnType<typeof createClassColumns>;
  showClassModal: boolean;
  setShowClassModal: Dispatch<SetStateAction<boolean>>;
  editingClass: ClassInfo | null;
  classFormData: ClassFormData;
  setClassFormData: Dispatch<SetStateAction<ClassFormData>>;
  handleCreateClass: () => void;
  handleEditClass: (cls: ClassInfo) => void;
  handleSaveClass: () => Promise<void>;
  handleDeleteClass: (cls: ClassInfo) => Promise<void>;
}

/**
 * 管理员 + 班级管理逻辑子模块。
 * 状态与 handler 原样搬自 usePermissionManagementLogic.ts，函数体逐字不变；
 * showToast / confirmRef / roles 经 deps 注入（admins 数据由主 hook 的 fetchData 初始化）。
 */
export function useAdminClassLogic(deps: AdminClassLogicDeps): AdminClassLogicResult {
  const { showToast, confirmRef, roles } = deps;
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

  // ========== Classes Management ==========
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [classFormData, setClassFormData] = useState<ClassFormData>({
    name: '',
    grade: '',
    description: '',
  });

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

  // ========== Derived Data ==========
  const adminColumns = useMemo(
    () => createAdminColumns(adminRolesMap, roles),
    [adminRolesMap, roles]
  );
  const classColumns = useMemo(() => createClassColumns(), []);

  return {
    admins,
    setAdmins,
    adminRolesMap,
    setAdminRolesMap,
    adminColumns,
    showAdminModal,
    setShowAdminModal,
    editingAdmin,
    adminFormData,
    setAdminFormData,
    handleCreateAdmin,
    handleEditAdmin,
    handleSaveAdmin,
    handleDeleteAdmin,
    classes,
    setClasses,
    classColumns,
    showClassModal,
    setShowClassModal,
    editingClass,
    classFormData,
    setClassFormData,
    handleCreateClass,
    handleEditClass,
    handleSaveClass,
    handleDeleteClass,
  };
}
