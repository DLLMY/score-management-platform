import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

// ---- 共享可变桩（hoist 至 vi.mock 之前，供工厂闭包引用）----
const hoisted = vi.hoisted(() => {
  const storeState = {
    hasPermission: vi.fn((code?: string) => !!code),
    hasAnyPermission: vi.fn((codes?: string[]) => Array.isArray(codes) && codes.length > 0),
    isAdmin: false,
    permissions: ['all'] as string[],
    isLoading: false,
    loadPermissions: vi.fn(),
  };
  const usePermissionStore = vi.fn(() => storeState);
  (usePermissionStore as unknown as { getState: ReturnType<typeof vi.fn> }).getState = vi.fn(
    () => storeState
  );
  const navigateFn = vi.fn();
  return { storeState, usePermissionStore, navigateFn };
});

vi.mock('../../stores', () => ({
  usePermissionStore: hoisted.usePermissionStore,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => hoisted.navigateFn,
  };
});

// 找到某菜单组 header 按钮对应的内层 <ul>（用于断言展开/收起 className）
function getGroupInnerUl(container: HTMLElement, groupLabel: string): HTMLElement | null {
  const headerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes(groupLabel)
  );
  if (!headerBtn) return null;
  const li = headerBtn.parentElement;
  return li ? li.querySelector('ul') : null;
}

function renderSidebar(entries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <Sidebar />
    </MemoryRouter>
  );
}

describe('Sidebar 渲染与分支覆盖 B54', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 storeState 到默认 teacher 态
    hoisted.storeState.hasPermission = vi.fn((code?: string) => !!code);
    hoisted.storeState.hasAnyPermission = vi.fn(
      (codes?: string[]) => Array.isArray(codes) && codes.length > 0
    );
    hoisted.storeState.isAdmin = false;
    hoisted.storeState.permissions = ['all'];
    hoisted.storeState.isLoading = false;
    localStorage.clear();
  });

  it('默认展开（teacher）：渲染主菜单', () => {
    renderSidebar();

    // 主菜单项可见
    expect(screen.getByText('积分管理平台')).toBeInTheDocument();
    expect(screen.getByText('数据概览')).toBeInTheDocument();
    expect(screen.getByText('积分规则')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });

  it('折叠/展开按钮切换：覆盖 isCollapsed 双向分支', () => {
    const { container } = renderSidebar();

    const collapseBtn = screen.getByTitle(/收起侧边栏/);
    fireEvent.click(collapseBtn);
    // 折叠后标题切换为「展开侧边栏」
    expect(screen.getByTitle(/展开侧边栏/)).toBeInTheDocument();

    // 折叠态 logo 小图（w-12 h-12）出现
    const logo = container.querySelector('.w-12.h-12');
    expect(logo).not.toBeNull();

    // 再次点击恢复展开
    fireEvent.click(screen.getByTitle(/展开侧边栏/));
    expect(screen.getByTitle(/收起侧边栏/)).toBeInTheDocument();
  });

  it('菜单组展开/收起：toggleGroup 改变内层 ul 高度类', () => {
    const { container } = renderSidebar();

    const ulBefore = getGroupInnerUl(container, '积分管理');
    expect(ulBefore?.className).toContain('max-h-0');

    const headerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('积分管理')
    )!;
    fireEvent.click(headerBtn);

    const ulAfter = getGroupInnerUl(container, '积分管理');
    expect(ulAfter?.className).toContain('max-h-[500px]');
  });

  it('admin 角色（role=admin）：管理员组可见', () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    renderSidebar();

    expect(screen.getByText('系统设置')).toBeInTheDocument();
    expect(screen.getByText('数据概览')).toBeInTheDocument();
  });

  it('权限过滤：整组权限被拒时该组被丢弃', () => {
    // 拒绝 systemAdmin 组权限（组级 permission + 全部 item permission）→ 整组从 filteredMenuGroups 移除
    hoisted.storeState.hasPermission = vi.fn(
      (code?: string) => code !== 'system.settings' && code !== 'system.roles'
    );
    renderSidebar();

    // systemAdmin 整组被丢弃
    expect(screen.queryByText('系统设置')).toBeNull();
    // 其它组（main 等）仍显示
    expect(screen.getByText('数据概览')).toBeInTheDocument();
  });

  it('退出登录：清理 localStorage 并导航到 /login', () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'teacher' }));
    renderSidebar();

    fireEvent.click(screen.getByText('退出登录'));

    expect(localStorage.getItem('admin')).toBeNull();
    expect(hoisted.navigateFn).toHaveBeenCalledWith('/login');
  });

  it('移动端抽屉：打开与关闭', () => {
    renderSidebar();

    // 默认关闭：无「关闭菜单」按钮（该按钮仅有 aria-label，无文字）
    expect(screen.queryByLabelText('关闭菜单')).toBeNull();

    fireEvent.click(screen.getByLabelText('打开菜单'));
    expect(screen.getByLabelText('关闭菜单')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('关闭菜单'));
    expect(screen.queryByLabelText('关闭菜单')).toBeNull();
  });

  it('折叠态 hover 菜单项：显示 tooltip', () => {
    const { container } = renderSidebar();
    fireEvent.click(screen.getByTitle(/收起侧边栏/)); // 进入折叠态

    // 折叠态下退出登录 label span 仅在 !isCollapsed 渲染，故无文字
    expect(screen.queryByText('退出登录')).toBeNull();
    const logoutBtn = container.querySelector('button.text-red-500')!;
    fireEvent.mouseEnter(logoutBtn);

    // tooltip 渲染一份 label
    expect(screen.getByText('退出登录')).toBeInTheDocument();
  });

  it('Ctrl+B 快捷键：切换折叠', () => {
    renderSidebar();

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.getByTitle(/展开侧边栏/)).toBeInTheDocument();
  });

  it('isLoading + 已登录：触发 loadPermissions', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 7, role: 'teacher' }));
    hoisted.storeState.isLoading = true;
    renderSidebar();

    await vi.waitFor(() => expect(hoisted.storeState.loadPermissions).toHaveBeenCalled());
  });
});
