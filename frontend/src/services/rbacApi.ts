// -*- coding: utf-8 -*-
/**
 * RBAC权限管理API服务
 */

import { request } from './api';

// ========== Types ==========

export interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string;
  category?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RoleWithPermissions {
  role_code: string;
  role_name: string;
  description?: string;
  permissions: string[];
  parent_roles: string[];
  child_roles: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminWithRoles {
  id: number;
  username: string;
  real_name?: string;
  roles: string[];
  permissions: string[];
}

export interface RoleHierarchy {
  role_code: string;
  parent_roles: string[];
  child_roles: string[];
}

// ========== RBAC API ==========

const rbacApi = {
  // ========== Permission APIs ==========
  
  /**
   * 获取权限列表
   */
  getPermissions: async (params?: { category?: string; is_active?: boolean }): Promise<Permission[]> => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active));
    
    const query = queryParams.toString();
    const url = `/api/rbac/permissions${query ? `?${query}` : ''}`;
    return request(url) as Promise<Permission[]>;
  },

  /**
   * 获取权限详情
   */
  getPermission: async (code: string): Promise<Permission> => {
    return request(`/api/rbac/permissions/${code}`) as Promise<Permission>;
  },

  /**
   * 创建权限
   */
  createPermission: async (data: Partial<Permission>): Promise<{ id: number }> => {
    return request('/api/rbac/permissions', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ id: number }>;
  },

  /**
   * 更新权限
   */
  updatePermission: async (code: string, data: Partial<Permission>): Promise<void> => {
    return request(`/api/rbac/permissions/${code}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<void>;
  },

  /**
   * 删除权限
   */
  deletePermission: async (code: string): Promise<void> => {
    return request(`/api/rbac/permissions/${code}`, { method: 'DELETE' }) as Promise<void>;
  },

  // ========== Role APIs ==========

  /**
   * 获取角色列表（含权限）
   */
  getRoles: async (): Promise<RoleWithPermissions[]> => {
    return request('/api/rbac/roles') as Promise<RoleWithPermissions[]>;
  },

  /**
   * 获取角色详情（含权限）
   */
  getRole: async (roleCode: string): Promise<RoleWithPermissions> => {
    return request(`/api/rbac/roles/${roleCode}`) as Promise<RoleWithPermissions>;
  },

  /**
   * 创建角色
   */
  createRole: async (data: {
    role_code: string;
    role_name?: string;
    description?: string;
    permissions?: string[];
    parent_roles?: string[];
    is_active?: boolean;
  }): Promise<void> => {
    return request('/api/rbac/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<void>;
  },

  /**
   * 更新角色
   */
  updateRole: async (roleCode: string, data: Partial<RoleWithPermissions>): Promise<void> => {
    return request(`/api/rbac/roles/${roleCode}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<void>;
  },

  /**
   * 删除角色
   */
  deleteRole: async (roleCode: string): Promise<void> => {
    return request(`/api/rbac/roles/${roleCode}`, { method: 'DELETE' }) as Promise<void>;
  },

  // ========== Admin-Role APIs ==========

  /**
   * 获取管理员的角色和权限
   */
  getAdminRoles: async (adminId: number): Promise<AdminWithRoles> => {
    return request(`/api/rbac/admin-roles/${adminId}`, { skipCache: true }) as Promise<AdminWithRoles>;
  },

  /**
   * 为管理员分配角色（覆盖式）
   */
  assignRoles: async (adminId: number, roleCodes: string[]): Promise<void> => {
    return request(`/api/rbac/admin-roles/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify({ role_codes: roleCodes }),
    }) as Promise<void>;
  },

  /**
   * 为管理员添加单个角色
   */
  addAdminRole: async (adminId: number, roleCode: string): Promise<void> => {
    return request(`/api/rbac/admin-roles/${adminId}/${roleCode}`, { method: 'POST' }) as Promise<void>;
  },

  /**
   * 移除管理员的单个角色
   */
  removeAdminRole: async (adminId: number, roleCode: string): Promise<void> => {
    return request(`/api/rbac/admin-roles/${adminId}/${roleCode}`, { method: 'DELETE' }) as Promise<void>;
  },

  // ========== Role-Permission APIs ==========

  /**
   * 获取角色的权限
   */
  getRolePermissions: async (roleCode: string): Promise<{ permissions: string[] }> => {
    return request(`/api/rbac/role-permissions/${roleCode}`) as Promise<{ permissions: string[] }>;
  },

  /**
   * 设置角色的权限（覆盖式）
   */
  setRolePermissions: async (roleCode: string, permissions: string[]): Promise<void> => {
    return request(`/api/rbac/role-permissions/${roleCode}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }) as Promise<void>;
  },

  /**
   * 为角色添加单个权限
   */
  addRolePermission: async (roleCode: string, permissionCode: string): Promise<void> => {
    return request(`/api/rbac/role-permissions/${roleCode}/${permissionCode}`, { method: 'POST' }) as Promise<void>;
  },

  /**
   * 移除角色的单个权限
   */
  removeRolePermission: async (roleCode: string, permissionCode: string): Promise<void> => {
    return request(`/api/rbac/role-permissions/${roleCode}/${permissionCode}`, { method: 'DELETE' }) as Promise<void>;
  },

  // ========== Role Hierarchy APIs ==========

  /**
   * 获取角色的层级关系
   */
  getRoleHierarchy: async (roleCode: string): Promise<RoleHierarchy> => {
    return request(`/api/rbac/role-hierarchy/${roleCode}`) as Promise<RoleHierarchy>;
  },

  // ========== Check Permission API ==========

  /**
   * 检查当前用户的权限
   */
  checkPermission: async (permission: string): Promise<{ has_permission: boolean }> => {
    return request(`/api/rbac/check?permission=${permission}`) as Promise<{ has_permission: boolean }>;
  },
};

export default rbacApi;
