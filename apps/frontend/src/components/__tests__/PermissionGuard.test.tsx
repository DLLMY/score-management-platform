import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PermissionGuard, PermissionButton, PermissionView } from '../PermissionGuard';

// 单元化守卫逻辑：避免加载真实 react-router-dom（worker 下易导致 fork 进程崩溃），
// 用最小桩替身覆盖 useLocation / Navigate / MemoryRouter。
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', state: null, search: '', hash: '' }),
  Navigate: () => null,
  MemoryRouter: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockUsePermissions = vi.hoisted(() => ({
  permissions: [] as string[],
  isLoading: false,
  hasPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
  hasAllPermissions: vi.fn(),
  roles: [] as string[],
  reload: vi.fn(),
  error: null as Error | null,
  isSuperAdmin: false,
}));

vi.mock('../../hooks', () => ({
  usePermissions: () => mockUsePermissions,
}));

function wrap(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PermissionGuard 权限守卫', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.isLoading = false;
    mockUsePermissions.isSuperAdmin = false;
    mockUsePermissions.permissions = [];
    mockUsePermissions.roles = [];
    mockUsePermissions.error = null;
    mockUsePermissions.hasPermission.mockReturnValue(true);
    mockUsePermissions.hasAnyPermission.mockReturnValue(true);
    mockUsePermissions.hasAllPermissions.mockReturnValue(true);
    localStorage.clear();
  });

  it('超级管理员 → 直接渲染 children', () => {
    mockUsePermissions.roles = ['admin'];
    wrap(
      <PermissionGuard requiredPermission='x'>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('机密内容')).toBeInTheDocument();
  });

  it('加载中 → 渲染转圈，不渲染 children', () => {
    mockUsePermissions.isLoading = true;
    wrap(
      <PermissionGuard>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.queryByText('机密内容')).toBeNull();
    expect(screen.getByText('加载权限...')).toBeInTheDocument();
  });

  it('权限为空且无 admin → 不渲染 children（重定向分支）', () => {
    mockUsePermissions.permissions = [];
    wrap(
      <PermissionGuard>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.queryByText('机密内容')).toBeNull();
  });

  it('权限为空但有 admin 缓存 → 渲染恢复界面', () => {
    mockUsePermissions.permissions = [];
    localStorage.setItem('admin', '1');
    wrap(
      <PermissionGuard>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('权限加载未完成')).toBeInTheDocument();
  });

  it('requiredPermission 有权限 → 渲染 children', () => {
    mockUsePermissions.permissions = ['read'];
    mockUsePermissions.hasPermission.mockReturnValue(true);
    wrap(
      <PermissionGuard requiredPermission='read'>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('机密内容')).toBeInTheDocument();
  });

  it('requiredPermission 无权限且无 fallback → 渲染 forbidden（renderForbidden）', () => {
    mockUsePermissions.permissions = ['other'];
    mockUsePermissions.hasPermission.mockReturnValue(false);
    wrap(
      <PermissionGuard requiredPermission='read'>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('权限不足')).toBeInTheDocument();
    expect(screen.queryByText('机密内容')).toBeNull();
  });

  it('requiredPermission 无权限且有 fallback → 渲染 fallback', () => {
    mockUsePermissions.permissions = ['other'];
    mockUsePermissions.hasPermission.mockReturnValue(false);
    wrap(
      <PermissionGuard requiredPermission='read' fallback={<div>无权限提示</div>}>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('无权限提示')).toBeInTheDocument();
    expect(screen.queryByText('机密内容')).toBeNull();
  });

  it('requiredPermissions requireAll 无权限 → forbidden', () => {
    mockUsePermissions.permissions = ['a'];
    mockUsePermissions.hasAllPermissions.mockReturnValue(false);
    wrap(
      <PermissionGuard requiredPermissions={['a', 'b']} requireAll>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('权限不足')).toBeInTheDocument();
  });

  it('requiredPermissions requireAny 有权限 → children', () => {
    mockUsePermissions.permissions = ['a'];
    mockUsePermissions.hasAnyPermission.mockReturnValue(true);
    wrap(
      <PermissionGuard requiredPermissions={['a', 'b']} requireAll={false}>
        <div>机密内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('机密内容')).toBeInTheDocument();
  });

  it('PermissionButton 超级管理员 → 渲染 Button 内容', () => {
    mockUsePermissions.isSuperAdmin = true;
    wrap(<PermissionButton permission='x'>按钮文字</PermissionButton>);
    expect(screen.getByText('按钮文字')).toBeInTheDocument();
  });

  it('PermissionButton 加载中 → 渲染禁用 Button（仍展示 children）', () => {
    mockUsePermissions.isLoading = true;
    wrap(<PermissionButton permission='x'>按钮文字</PermissionButton>);
    expect(screen.getByText('按钮文字')).toBeInTheDocument();
  });

  it('PermissionButton 无权限且有 fallback → 渲染 fallback', () => {
    mockUsePermissions.isSuperAdmin = false;
    mockUsePermissions.isLoading = false;
    mockUsePermissions.permissions = [];
    mockUsePermissions.hasPermission.mockReturnValue(false);
    wrap(
      <PermissionButton permission='x' fallback={<div>隐藏</div>}>
        按钮文字
      </PermissionButton>
    );
    expect(screen.getByText('隐藏')).toBeInTheDocument();
    expect(screen.queryByText('按钮文字')).toBeNull();
  });

  it('PermissionView 加载中 → 渲染 spinner（不渲染 children）', () => {
    mockUsePermissions.isLoading = true;
    wrap(
      <PermissionView permission='x'>
        <div>内容</div>
      </PermissionView>
    );
    expect(screen.queryByText('内容')).toBeNull();
  });

  it('PermissionView 无权限且有 fallback → 渲染 fallback', () => {
    mockUsePermissions.isSuperAdmin = false;
    mockUsePermissions.isLoading = false;
    mockUsePermissions.permissions = [];
    mockUsePermissions.hasPermission.mockReturnValue(false);
    wrap(
      <PermissionView permission='x' fallback={<div>不可见</div>}>
        <div>内容</div>
      </PermissionView>
    );
    expect(screen.getByText('不可见')).toBeInTheDocument();
    expect(screen.queryByText('内容')).toBeNull();
  });
});
