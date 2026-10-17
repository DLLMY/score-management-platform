export const ADMIN_ROLES = ['admin', 'super_admin'];

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
