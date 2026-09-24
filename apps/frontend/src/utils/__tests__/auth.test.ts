import { describe, it, expect, beforeEach } from 'vitest';
import {
  ADMIN_ROLES,
  TEACHER_ROLES,
  VIEWER_ROLES,
  getUserRole,
  getUserRoles,
  isAdmin,
  isTeacher,
  isViewer,
  hasRole,
  getAdminFromStorage,
  getSubAccountFromStorage,
  getCurrentUser,
  isAdminLoggedIn,
  isLoggedIn,
} from '../auth';

describe('auth · 角色判定', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('常量角色集合', () => {
    expect(ADMIN_ROLES).toContain('admin');
    expect(TEACHER_ROLES).toContain('teacher');
    expect(VIEWER_ROLES).toContain('viewer');
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

  it('isAdmin/isTeacher/isViewer/hasRole：集合包含判定', () => {
    const admin = { roles: ['admin', 'super_admin'] };
    expect(isAdmin(admin)).toBe(true);
    expect(isTeacher(admin)).toBe(false);
    expect(isViewer(admin)).toBe(false);
    expect(hasRole(admin, 'super_admin')).toBe(true);
    expect(hasRole(admin, 'teacher')).toBe(false);

    const teacher = { role: 'teacher' };
    expect(isTeacher(teacher)).toBe(true);
    expect(isAdmin(teacher)).toBe(false);

    const viewer = { role: 'viewer' };
    expect(isViewer(viewer)).toBe(true);
  });

  it('存储读取：getAdminFromStorage / getSubAccountFromStorage / getCurrentUser', () => {
    expect(getAdminFromStorage()).toBeNull();
    localStorage.setItem('admin', JSON.stringify({ role: 'admin', name: '邓老师' }));
    expect(getAdminFromStorage()).toMatchObject({ role: 'admin' });
    // 损坏 JSON 容错
    localStorage.setItem('admin', '{bad json');
    expect(getAdminFromStorage()).toBeNull();

    localStorage.removeItem('admin');
    expect(getSubAccountFromStorage()).toBeNull();
    localStorage.setItem('subaccount', JSON.stringify({ role: 'teacher' }));
    expect(getSubAccountFromStorage()).toMatchObject({ role: 'teacher' });

    // getCurrentUser：admin 优先
    localStorage.setItem('admin', JSON.stringify({ role: 'admin' }));
    expect(getCurrentUser()).toMatchObject({ role: 'admin' });
    localStorage.removeItem('admin');
    expect(getCurrentUser()).toMatchObject({ role: 'teacher' });
  });

  it('isAdminLoggedIn / isLoggedIn：登录态判定', () => {
    expect(isAdminLoggedIn()).toBe(false);
    expect(isLoggedIn()).toBe(false);

    localStorage.setItem('admin', JSON.stringify({ role: 'admin' }));
    expect(isAdminLoggedIn()).toBe(true);
    expect(isLoggedIn()).toBe(true);

    localStorage.clear();
    localStorage.setItem('student', '1');
    expect(isLoggedIn()).toBe(true);
    expect(isAdminLoggedIn()).toBe(false);
  });
});
