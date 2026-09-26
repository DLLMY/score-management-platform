import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';
import { usePermissionStore } from '../../../stores';

const hoisted = vi.hoisted(() => ({
  hasPermission: vi.fn(() => true),
  hasAnyPermission: vi.fn(() => true),
  navigateFn: vi.fn(),
  loadPermissions: vi.fn(),
  locationPathname: '/dashboard',
}));

vi.mock('../../../config/permissions', () => ({
  DEFAULT_PERMISSIONS_FOR_TEACHER: ['all'],
  DEFAULT_PERMISSIONS_FOR_ADMIN: ['all'],
}));

vi.mock('../../../stores', () => ({
  usePermissionStore: vi.fn(() => ({
    isAdmin: false,
    hasPermission: hoisted.hasPermission,
    hasAnyPermission: hoisted.hasAnyPermission,
    permissions: [],
    isLoading: false,
  })),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    // @ts-expect-error partial mock
    ...actual,
    useNavigate: () => hoisted.navigateFn,
    useLocation: () => ({ pathname: hoisted.locationPathname }),
  };
});

(usePermissionStore as unknown as { getState: () => unknown }).getState = vi.fn(() => ({
  loadPermissions: hoisted.loadPermissions,
}));

const renderSidebar = (
  props: { isMobileMenuOpen?: boolean; onCloseMobileMenu?: () => void } = {}
) =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar {...props} />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  hoisted.hasPermission.mockReset().mockReturnValue(true);
  hoisted.hasAnyPermission.mockReset().mockReturnValue(true);
  hoisted.navigateFn.mockReset();
  hoisted.loadPermissions.mockReset();
  hoisted.locationPathname = '/dashboard';
  vi.mocked(usePermissionStore).mockReturnValue({
    isAdmin: false,
    hasPermission: hoisted.hasPermission,
    hasAnyPermission: hoisted.hasAnyPermission,
    permissions: [],
    isLoading: false,
  });
});

describe('Sidebar 基础渲染', () => {
  it('渲染平台标题', () => {
    renderSidebar();
    expect(screen.getByText('积分管理平台')).toBeInTheDocument();
  });

  it('默认渲染学生管理等菜单项', () => {
    renderSidebar();
    expect(screen.getByText('学生管理')).toBeInTheDocument();
    expect(screen.getByText('积分规则')).toBeInTheDocument();
  });

  it('admin 角色也能正常渲染', () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    renderSidebar();
    expect(screen.getByText('学生管理')).toBeInTheDocument();
  });

  it('localStorage 解析失败时回退不崩溃', () => {
    localStorage.setItem('admin', '{bad json');
    expect(() => renderSidebar()).not.toThrow();
  });
});

describe('Sidebar 展开与折叠', () => {
  it('Ctrl+B 切换折叠状态', () => {
    const { container } = renderSidebar();
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('w-64');
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(container.querySelector('aside')?.className).toContain('w-16');
  });

  it('点击分组头切换展开', () => {
    renderSidebar();
    // 积分管理 初始未展开，点击其分组头后应可正常切换且不崩溃
    const groupHeader = screen.getByText('积分管理');
    fireEvent.click(groupHeader);
    expect(screen.getByText('积分规则')).toBeInTheDocument();
  });
});

describe('Sidebar 移动端抽屉', () => {
  it('mobile-menu-open 事件打开抽屉', () => {
    const { container } = renderSidebar();
    expect(container.querySelector('.w-80')).toBeNull();
    fireEvent(window, new Event('mobile-menu-open'));
    expect(container.querySelector('.w-80')).not.toBeNull();
  });

  it('Escape 关闭抽屉', async () => {
    const { container } = renderSidebar();
    fireEvent(window, new Event('mobile-menu-open'));
    expect(container.querySelector('.w-80')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(container.querySelector('.w-80')).toBeNull());
  });
});

describe('Sidebar 登出', () => {
  it('退出登录清除 localStorage 并跳转 /login', () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    localStorage.setItem('access_token', 'tok');
    localStorage.setItem('refresh_token', 'rtok');
    renderSidebar();
    fireEvent.click(screen.getByText('退出登录'));
    expect(localStorage.getItem('admin')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(hoisted.navigateFn).toHaveBeenCalledWith('/login');
  });
});

describe('Sidebar 权限加载', () => {
  it('isLoading 且有 admin 时调用 loadPermissions', () => {
    localStorage.setItem('admin', JSON.stringify({ id: 42, role: 'admin' }));
    vi.mocked(usePermissionStore).mockReturnValue({
      isAdmin: true,
      hasPermission: hoisted.hasPermission,
      hasAnyPermission: hoisted.hasAnyPermission,
      permissions: [],
      isLoading: true,
    });
    renderSidebar();
    expect(hoisted.loadPermissions).toHaveBeenCalledWith(42);
  });
});
