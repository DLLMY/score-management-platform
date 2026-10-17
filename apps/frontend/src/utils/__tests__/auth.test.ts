import { describe, it, expect, beforeEach } from 'vitest';
import { ADMIN_ROLES, getUserRole, getUserRoles, isAdmin } from '../auth';

describe('auth · 角色判定', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('常量角色集合', () => {
    expect(ADMIN_ROLES).toContain('admin');
  });

  it('getUserRole：role 优先于 role_type，空用户回 undefined', () => {
    expect(getUserRole(null)).toBeUndefined();
    expect(getUserRole(undefined)).toBeUndefined();
    expect(getUserRole({})).toBeUndefined();
    expect(getUserRole({ role: 'admin' })).toBe('admin');
    expect(getUserRole({ role_type: 'teacher' })).toBe('teacher');
  });

  it('getUserRoles：roles 数组优先，否则单 role 包成数组', () => {
    expect(getUserRoles(null)).toEqual([]);
    expect(getUserRoles({ role: 'admin' })).toEqual(['admin']);
    expect(getUserRoles({ roles: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('isAdmin：ADMIN_ROLES 集合包含判定', () => {
    const admin = { roles: ['admin', 'super_admin'] };
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin({ role: 'teacher' })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
