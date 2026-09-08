export const ADMIN_ROLES = ['admin', 'super_admin'];

export const TEACHER_ROLES = ['teacher', 'subject_teacher', 'head_teacher'];

export const VIEWER_ROLES = ['dashboard', 'dashboard_viewer', 'viewer'];

export interface UserInfo {
  role?: string;
  role_type?: string;
  roles?: string[];
}

export const getUserRole = (user: UserInfo | null | undefined): string | undefined => {
  if (!user) return undefined;
  return user.role || user.role_type;
};

export const getUserRoles = (user: UserInfo | null | undefined): string[] => {
  if (!user) return [];
  if (user.roles && Array.isArray(user.roles)) {
    return user.roles;
  }
  const role = getUserRole(user);
  return role ? [role] : [];
};

export const isAdmin = (user: UserInfo | null | undefined): boolean => {
  const roles = getUserRoles(user);
  return roles.some((role) => ADMIN_ROLES.includes(role));
};

export const isTeacher = (user: UserInfo | null | undefined): boolean => {
  const roles = getUserRoles(user);
  return roles.some((role) => TEACHER_ROLES.includes(role));
};

export const isViewer = (user: UserInfo | null | undefined): boolean => {
  const roles = getUserRoles(user);
  return roles.some((role) => VIEWER_ROLES.includes(role));
};

export const hasRole = (user: UserInfo | null | undefined, role: string): boolean => {
  const roles = getUserRoles(user);
  return roles.includes(role);
};

export const getAdminFromStorage = (): UserInfo | null => {
  const adminStr = localStorage.getItem('admin');
  if (!adminStr) return null;
  try {
    return JSON.parse(adminStr);
  } catch {
    return null;
  }
};

export const getSubAccountFromStorage = (): UserInfo | null => {
  const subAccountStr = localStorage.getItem('subaccount');
  if (!subAccountStr) return null;
  try {
    return JSON.parse(subAccountStr);
  } catch {
    return null;
  }
};

export const getCurrentUser = (): UserInfo | null => {
  return getAdminFromStorage() || getSubAccountFromStorage();
};

export const isAdminLoggedIn = (): boolean => {
  const admin = getAdminFromStorage();
  return isAdmin(admin);
};

export const isLoggedIn = (): boolean => {
  // 十评 P2-1：凭证在 HttpOnly cookie（JS 不可读），登录态以非凭证 marker 判断
  return !!localStorage.getItem('admin') || !!localStorage.getItem('student');
};
