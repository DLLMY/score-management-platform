import type { Admin, UserRole } from '../../types';
import type { ClassInfo } from '../../services/api';
import type { Permission, RoleWithPermissions } from '../../services/rbacApi';

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

export type { Admin, ClassInfo, UserRole, Permission, RoleWithPermissions };
