import type { Dispatch, SetStateAction } from 'react';
import type { Admin, UserRole } from '../../types';
import type { ClassInfo } from '../../services/api';
import type { Permission, RoleWithPermissions } from '../../services/rbacApi';
import type { ColumnType } from '../../components';

export interface PermissionLog {
  id: number;
  action: string;
  target_type: string;
  description: string;
  ip_address: string;
  created_at: string;
}

export interface AdminFormData {
  username: string;
  password?: string;
  real_name: string;
  phone: string;
  role: UserRole;
  roles: string[];
  class_name: string;
}

export interface ClassFormData {
  name: string;
  grade: string;
  description: string;
}

export interface RoleFormData {
  role_code: string;
  role_name: string;
  description: string;
  permissions: string[];
  is_active: boolean;
}

export interface PermissionFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
}

export interface PermissionManagementViewProps {
  loading: boolean;
  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;

  // admins
  admins: Admin[];
  adminColumns: ColumnType<Admin>[];
  handleCreateAdmin: () => void;
  handleEditAdmin: (admin: Admin) => void;
  handleOpenRoleAssign: (admin: Admin) => void;
  handleDeleteAdmin: (admin: Admin) => void;

  // classes
  classes: ClassInfo[];
  classColumns: ColumnType<ClassInfo>[];
  handleCreateClass: () => void;
  handleEditClass: (cls: ClassInfo) => void;
  handleDeleteClass: (cls: ClassInfo) => void;

  // roles
  roles: RoleWithPermissions[];
  roleColumns: ColumnType<RoleWithPermissions>[];
  handleOpenCreateRole: () => void;
  handleOpenEditRole: (role: RoleWithPermissions) => void;
  handleDeleteRole: (role: RoleWithPermissions) => void;

  // permissions
  permissionFilter: { category: string; search: string };
  setPermissionFilter: Dispatch<SetStateAction<{ category: string; search: string }>>;
  groupedPermissions: Record<string, Permission[]>;
  handleOpenCreatePermission: () => void;
  handleOpenEditPermission: (permission: Permission) => void;
  handleDeletePermission: (permission: Permission) => void;

  // logs
  permissionLogs: PermissionLog[];
  logColumns: ColumnType<PermissionLog>[];
  logPage: number;
  setLogPage: Dispatch<SetStateAction<number>>;
  logTotal: number;
  logPerPage: number;

  // admin modal
  showAdminModal: boolean;
  setShowAdminModal: Dispatch<SetStateAction<boolean>>;
  editingAdmin: Admin | null;
  adminFormData: AdminFormData;
  setAdminFormData: Dispatch<SetStateAction<AdminFormData>>;
  submitting: boolean;
  handleSaveAdmin: () => Promise<void>;
  runSubmit: (fn: () => Promise<void>) => Promise<void>;

  // role assign modal
  showRoleAssignModal: boolean;
  setShowRoleAssignModal: Dispatch<SetStateAction<boolean>>;
  selectedAdminForRoles: Admin | null;
  selectedRolesForAdmin: string[];
  toggleAdminRole: (roleCode: string) => void;
  handleSaveAdminRoles: () => Promise<void>;

  // class modal
  showClassModal: boolean;
  setShowClassModal: Dispatch<SetStateAction<boolean>>;
  editingClass: ClassInfo | null;
  classFormData: ClassFormData;
  setClassFormData: Dispatch<SetStateAction<ClassFormData>>;
  handleSaveClass: () => Promise<void>;

  // role modal
  showRoleModal: boolean;
  setShowRoleModal: Dispatch<SetStateAction<boolean>>;
  isEditingRole: boolean;
  roleFormData: RoleFormData;
  setRoleFormData: Dispatch<SetStateAction<RoleFormData>>;
  availablePermissions: Permission[];
  selectedPermissions: string[];
  togglePermission: (permCode: string) => void;
  handleSaveRole: () => Promise<void>;

  // permission modal
  showPermissionModal: boolean;
  setShowPermissionModal: Dispatch<SetStateAction<boolean>>;
  isEditingPermission: boolean;
  permissionFormData: PermissionFormData;
  setPermissionFormData: Dispatch<SetStateAction<PermissionFormData>>;
  handleSavePermission: () => Promise<void>;
}

export type { Admin, ClassInfo, UserRole, Permission, RoleWithPermissions };
