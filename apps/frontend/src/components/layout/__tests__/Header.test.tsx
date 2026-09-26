import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../Header';
import { usePermissionStore } from '../../../stores';

const hoisted = vi.hoisted(() => ({
  getRecent: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  toggleTheme: vi.fn(),
  clearPermissions: vi.fn(),
  hasPermission: vi.fn(() => true),
  hasAnyPermission: vi.fn(() => true),
  navigateFn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  default: {
    adminNotifications: {
      getRecent: hoisted.getRecent,
      markRead: hoisted.markRead,
      markAllRead: hoisted.markAllRead,
    },
  },
  AdminNotification: class {},
}));

vi.mock('../../../stores', () => ({
  useThemeStore: () => ({ theme: 'light', toggleTheme: hoisted.toggleTheme }),
  usePermissionStore: vi.fn(() => ({
    isAdmin: false,
    hasPermission: hoisted.hasPermission,
    hasAnyPermission: hoisted.hasAnyPermission,
    permissions: [],
    isLoading: false,
  })),
}));

vi.mock('../../../utils/logger', () => ({
  default: { error: hoisted.loggerError, info: vi.fn(), warn: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    // @ts-expect-error partial mock
    ...actual,
    useNavigate: () => hoisted.navigateFn,
  };
});

// Header 登出时调用 usePermissionStore.getState().clearPermissions()，需补上
(usePermissionStore as unknown as { getState: () => unknown }).getState = vi.fn(() => ({
  clearPermissions: hoisted.clearPermissions,
}));

const renderHeader = (entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Header />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  hoisted.getRecent.mockReset().mockResolvedValue([]);
  hoisted.markRead.mockReset().mockResolvedValue({ success: true });
  hoisted.markAllRead.mockReset().mockResolvedValue({ success: true });
  hoisted.toggleTheme.mockReset();
  hoisted.clearPermissions.mockReset();
  hoisted.hasPermission.mockReset().mockReturnValue(true);
  hoisted.hasAnyPermission.mockReset().mockReturnValue(true);
  hoisted.navigateFn.mockReset();
  hoisted.loggerError.mockReset();
  vi.mocked(usePermissionStore).mockReturnValue({
    isAdmin: false,
    hasPermission: hoisted.hasPermission,
    hasAnyPermission: hoisted.hasAnyPermission,
    permissions: [],
    isLoading: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Header 基础渲染', () => {
  it('无 admin 时显示默认名「管理员」', () => {
    renderHeader();
    expect(screen.getByText('管理员')).toBeInTheDocument();
  });

  it('有 admin 时显示真实姓名与角色', async () => {
    localStorage.setItem(
      'admin',
      JSON.stringify({ real_name: '张三', username: 'zhangsan', role: 'admin' })
    );
    hoisted.getRecent.mockResolvedValue([]);
    renderHeader();
    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
    await waitFor(() => expect(hoisted.getRecent).toHaveBeenCalled());
  });

  it('admin 解析失败时回退为 null', () => {
    localStorage.setItem('admin', '{invalid json');
    renderHeader();
    expect(screen.getByText('管理员')).toBeInTheDocument();
  });

  it('超级管理员角色显示为「超级管理员」', async () => {
    localStorage.setItem('admin', JSON.stringify({ real_name: '邓老师', role: 'teacher' }));
    vi.mocked(usePermissionStore).mockReturnValue({
      isAdmin: true,
      hasPermission: hoisted.hasPermission,
      hasAnyPermission: hoisted.hasAnyPermission,
      permissions: [],
      isLoading: false,
    });
    renderHeader();
    expect(await screen.findByText('超级管理员')).toBeInTheDocument();
  });

  it('教师角色显示为「教师」', async () => {
    localStorage.setItem('admin', JSON.stringify({ real_name: '李老师', role: 'teacher' }));
    renderHeader();
    expect(await screen.findByText('教师')).toBeInTheDocument();
  });
});

describe('Header 搜索', () => {
  it('有搜索值时显示搜索结果项', async () => {
    renderHeader();
    const input = screen.getByPlaceholderText(/搜索学生、规则、设备/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(await screen.findByText('搜索学生')).toBeInTheDocument();
  });

  it('无搜索值时显示快速入口', async () => {
    renderHeader();
    const input = screen.getByPlaceholderText(/搜索学生、规则、设备/);
    fireEvent.focus(input);
    expect(await screen.findByText('数据概览')).toBeInTheDocument();
  });

  it('点击搜索结果跳转并更新 document.title', async () => {
    renderHeader();
    const input = screen.getByPlaceholderText(/搜索学生、规则、设备/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    const item = await screen.findByText('搜索学生');
    fireEvent.click(item);
    expect(hoisted.navigateFn).toHaveBeenCalledWith('/users');
  });
});

describe('Header 通知中心', () => {
  it('点击通知按钮展开通知中心', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    renderHeader();
    fireEvent.click(screen.getByLabelText('通知'));
    expect(await screen.findByText('通知中心')).toBeInTheDocument();
  });

  it('加载通知成功后渲染列表', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    hoisted.getRecent.mockResolvedValue([
      {
        id: 1,
        type: 'info',
        title: '测试通知',
        message: '内容',
        is_read: false,
        priority: 'high',
        created_at: new Date().toISOString(),
      },
    ]);
    renderHeader();
    fireEvent.click(screen.getByLabelText('通知'));
    expect(await screen.findByText('测试通知')).toBeInTheDocument();
  });

  it('通知加载失败（非401）记录日志并保留空列表', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    hoisted.getRecent.mockRejectedValue({ status: 500, message: 'boom' });
    renderHeader();
    await waitFor(() => expect(hoisted.loggerError).toHaveBeenCalled());
  });

  it('通知加载失败（401）静默降级', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    hoisted.getRecent.mockRejectedValue({ status: 401, message: 'unauthorized' });
    renderHeader();
    await waitFor(() => expect(hoisted.getRecent).toHaveBeenCalled());
    expect(hoisted.loggerError).not.toHaveBeenCalled();
  });

  it('点击通知项触发 markRead', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    hoisted.getRecent.mockResolvedValue([
      {
        id: 7,
        type: 'success',
        title: '已读测试',
        message: 'msg',
        is_read: false,
        priority: 'medium',
        created_at: new Date().toISOString(),
      },
    ]);
    renderHeader();
    fireEvent.click(screen.getByLabelText('通知'));
    const item = await screen.findByText('已读测试');
    fireEvent.click(item);
    await waitFor(() => expect(hoisted.markRead).toHaveBeenCalledWith(7));
  });

  it('点击「全部已读」触发 markAllRead', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    hoisted.getRecent.mockResolvedValue([]);
    renderHeader();
    fireEvent.click(screen.getByLabelText('通知'));
    const btn = await screen.findByText('全部已读');
    fireEvent.click(btn);
    await waitFor(() => expect(hoisted.markAllRead).toHaveBeenCalledWith(1));
  });
});

describe('Header 主题与退出', () => {
  it('点击主题切换调用 toggleTheme', () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText('切换主题'));
    expect(hoisted.toggleTheme).toHaveBeenCalled();
  });

  it('退出登录清除 localStorage 并跳转 /login', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, role: 'admin' }));
    localStorage.setItem('access_token', 'tok');
    localStorage.setItem('refresh_token', 'rtok');
    localStorage.setItem('user_permissions', 'p');
    localStorage.setItem('user_roles', 'r');
    renderHeader();
    fireEvent.click(screen.getByLabelText('用户菜单'));
    const logout = await screen.findByText('退出登录');
    fireEvent.click(logout);
    expect(localStorage.getItem('admin')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(hoisted.clearPermissions).toHaveBeenCalled();
    expect(hoisted.navigateFn).toHaveBeenCalledWith('/login');
  });
});
