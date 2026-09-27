import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  PERMISSION_MAP,
  DEFAULT_PERMISSIONS_FOR_TEACHER,
  DEFAULT_PERMISSIONS_FOR_ADMIN,
  ADMIN_ROLES,
  getPermissionByName,
  getPermissionsByCategory,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../permissions';

describe('config/permissions 纯函数', () => {
  it('PERMISSIONS 非空且 code 唯一', () => {
    expect(PERMISSIONS.length).toBeGreaterThan(0);
    const codes = PERMISSIONS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('PERMISSION_MAP 与 PERMISSIONS 一一对应', () => {
    expect(Object.keys(PERMISSION_MAP).length).toBe(PERMISSIONS.length);
    expect(PERMISSION_MAP['all'].code).toBe('all');
  });

  it('DEFAULT_PERMISSIONS_FOR_TEACHER 含 student.view', () => {
    expect(DEFAULT_PERMISSIONS_FOR_TEACHER).toContain('student.view');
    expect(DEFAULT_PERMISSIONS_FOR_TEACHER.length).toBeGreaterThan(0);
  });

  it('DEFAULT_PERMISSIONS_FOR_ADMIN 为 ["all"]', () => {
    expect(DEFAULT_PERMISSIONS_FOR_ADMIN).toEqual(['all']);
  });

  it('ADMIN_ROLES 为非空数组', () => {
    expect(Array.isArray(ADMIN_ROLES)).toBe(true);
    expect(ADMIN_ROLES.length).toBeGreaterThan(0);
  });

  describe('hasPermission', () => {
    it('含 all 直接放行', () => {
      expect(hasPermission(['all'], 'system.users')).toBe(true);
    });
    it('含目标权限放行', () => {
      expect(hasPermission(['student.view'], 'student.view')).toBe(true);
    });
    it('不含目标权限拒绝', () => {
      expect(hasPermission(['student.view'], 'student.delete')).toBe(false);
      expect(hasPermission([], 'student.view')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('含 all 直接放行', () => {
      expect(hasAnyPermission(['all'], ['a', 'b'])).toBe(true);
    });
    it('命中任一权限放行', () => {
      expect(hasAnyPermission(['x', 'y'], ['a', 'y'])).toBe(true);
    });
    it('全部未命中拒绝', () => {
      expect(hasAnyPermission(['x'], ['a', 'b'])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('含 all 直接放行', () => {
      expect(hasAllPermissions(['all'], ['a', 'b'])).toBe(true);
    });
    it('全部命中放行', () => {
      expect(hasAllPermissions(['x', 'y'], ['x', 'y'])).toBe(true);
    });
    it('部分缺失拒绝', () => {
      expect(hasAllPermissions(['x'], ['x', 'y'])).toBe(false);
    });
  });

  describe('getPermissionByName', () => {
    it('按名称查找返回定义', () => {
      const r = getPermissionByName('查看学生');
      expect(r?.code).toBe('student.view');
    });
    it('名称不存在返回 undefined', () => {
      expect(getPermissionByName('不存在的权限')).toBeUndefined();
    });
  });

  describe('getPermissionsByCategory', () => {
    it('按分类查找返回非空数组且分类一致', () => {
      const r = getPermissionsByCategory('系统管理');
      expect(Array.isArray(r)).toBe(true);
      expect(r.length).toBeGreaterThan(0);
      expect(r.every((p) => p.category === '系统管理')).toBe(true);
    });
    it('未知分类返回空数组', () => {
      expect(getPermissionsByCategory('不存在的分类')).toEqual([]);
    });
  });
});
