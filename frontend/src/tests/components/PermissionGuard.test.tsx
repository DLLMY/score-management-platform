/**
 * PermissionGuard 测试 —— 覆盖报告 P0 指出的"死锁/超时分支"
 * 关键分支：superadmin 直通、加载中转圈、12s 超时恢复 UI、
 * 已登录但空权限恢复 UI、未登录跳转、单/多权限 allow-deny、fallback。
 */
/// <reference types="jest" />
import { screen, fireEvent, act, cleanup, render } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PermissionGuard from '../../components/PermissionGuard';
import { ToastProvider } from '../../context/ToastContext';
import { renderWithProviders, mockLocalStorage } from '../utils/test-utils';

const h = vi.hoisted(() => ({ perms: {} as Record<string, unknown> }));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => h.perms,
}));

const reload = vi.fn();
const base = {
  permissions: [] as string[],
  roles: [] as string[],
  isLoading: false,
  error: null as string | null,
  isAdmin: false,
  isSuperAdmin: false,
  hasPermission: (code: string) => (h.perms.permissions as string[]).includes(code),
  hasAnyPermission: (codes: string[]) =>
    codes.some((c) => (h.perms.permissions as string[]).includes(c)),
  hasAllPermissions: (codes: string[]) =>
    codes.every((c) => (h.perms.permissions as string[]).includes(c)),
  reload,
};

const setPerms = (overrides: Record<string, unknown> = {}) => {
  h.perms = { ...base, ...overrides };
};

describe('PermissionGuard', () => {
  beforeEach(() => {
    mockLocalStorage();
    localStorage.removeItem('admin');
    vi.clearAllMocks();
    setPerms();
  });

  // 显式清理：卸载组件（清除其内部 12s 超时定时器，避免遗留 open handle 导致 worker 退出挂起）+ 还原真实定时器
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test('superadmin bypasses guard and renders children', () => {
    setPerms({ roles: ['super_admin'], isSuperAdmin: true });
    renderWithProviders(
      <PermissionGuard>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('机密内容')).toBeInTheDocument();
  });

  test('shows loading spinner while isLoading (no permanent lock)', () => {
    setPerms({ isLoading: true });
    renderWithProviders(
      <PermissionGuard>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('加载权限...')).toBeInTheDocument();
    expect(screen.queryByText('机密内容')).not.toBeInTheDocument();
  });

  test('12s timeout shows recovery UI with reload action (deadlock guard)', () => {
    setPerms({ isLoading: true });
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <PermissionGuard>
          <div>机密内容</div>
        </PermissionGuard>
      );
      act(() => {
        vi.advanceTimersByTime(13000);
      });
      expect(screen.getByText('权限加载超时，请重试或重新登录')).toBeInTheDocument();
      fireEvent.click(screen.getByText('重新加载'));
      expect(reload).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test('empty permissions + logged in shows recovery UI (no infinite spinner)', () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, username: 't', role: 'teacher' }));
    setPerms({ permissions: [], isLoading: false });
    renderWithProviders(
      <PermissionGuard>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('权限加载未完成')).toBeInTheDocument();
    fireEvent.click(screen.getByText('重新加载权限'));
    expect(reload).toHaveBeenCalled();
  });

  // 必须提供 /login 路由：<Navigate> 跳转后 guard 需被卸载。
  // 若只套 BrowserRouter 而无 <Routes>，guard 常驻 → 反复 Navigate 形成无限跳转，
  // 且每轮 state={{ from: location }} 嵌套上一个 location，history 结构化克隆的对象链
  // 持续加深 → 堆内存级数增长直至 worker OOM（曾致 CI/本地全量单测崩溃）。
  test('empty permissions + not logged in redirects (no children, no recovery)', () => {
    localStorage.removeItem('admin');
    setPerms({ permissions: [], isLoading: false });
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <ToastProvider>
          <Routes>
            <Route
              path='/secret'
              element={
                <PermissionGuard>
                  <div>机密内容</div>
                </PermissionGuard>
              }
            />
            <Route path='/login' element={<div>登录页</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
    // 确实跳到了 /login（原实现无 Routes 时无法验证跳转目标）
    expect(screen.getByText('登录页')).toBeInTheDocument();
    expect(screen.queryByText('机密内容')).not.toBeInTheDocument();
    expect(screen.queryByText('权限加载未完成')).not.toBeInTheDocument();
    expect(screen.queryByText('加载权限...')).not.toBeInTheDocument();
  });

  test('renders children when has required single permission', () => {
    setPerms({ permissions: ['score.view'] });
    renderWithProviders(
      <PermissionGuard requiredPermission='score.view'>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('机密内容')).toBeInTheDocument();
  });

  test('renders 权限不足 when missing single permission', () => {
    setPerms({ permissions: ['score.view'] });
    renderWithProviders(
      <PermissionGuard requiredPermission='score.edit'>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('权限不足')).toBeInTheDocument();
    expect(screen.queryByText('机密内容')).not.toBeInTheDocument();
  });

  test('requiredPermissions requireAll: denies when missing one', () => {
    setPerms({ permissions: ['a', 'b'] });
    renderWithProviders(
      <PermissionGuard requiredPermissions={['a', 'c']} requireAll>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('权限不足')).toBeInTheDocument();
  });

  test('requiredPermissions requireAny: allows when has one', () => {
    setPerms({ permissions: ['a'] });
    renderWithProviders(
      <PermissionGuard requiredPermissions={['a', 'c']} requireAll={false}>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('机密内容')).toBeInTheDocument();
  });

  test('renders fallback instead of 权限不足 when fallback provided', () => {
    setPerms({ permissions: ['a'] });
    renderWithProviders(
      <PermissionGuard requiredPermission='zzz' fallback={<div>无权限提示</div>}>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('无权限提示')).toBeInTheDocument();
    expect(screen.queryByText('机密内容')).not.toBeInTheDocument();
  });
});
