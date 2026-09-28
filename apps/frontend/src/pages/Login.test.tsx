import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { FormEvent, ChangeEvent } from 'react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { validateForm } from '../utils/validation';
import { isAdmin } from '../utils/auth';

// ── 隔离依赖：桩掉展示层 + mock 网络/工具/国际化（路径与 Login.tsx 自身 import 一致）──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: {} }),
}));

vi.mock('../utils/validation', () => ({
  validateForm: vi.fn(),
}));

vi.mock('../utils/auth', () => ({
  isAdmin: vi.fn(),
}));

const mockLogin = vi.fn();
const mockChangePassword = vi.fn();
const mockFetchCsrf = vi.fn();
vi.mock('../services/api', () => ({
  default: {
    auth: { login: (...args: unknown[]) => mockLogin(...args) },
    admins: { changePassword: (...args: unknown[]) => mockChangePassword(...args) },
  },
  fetchCsrfToken: (...args: unknown[]) => mockFetchCsrf(...args),
}));

// LoginView 桩：渲染交互元素 + 暴露关键 state 便于断言
interface StubProps {
  username: string;
  password: string;
  loading: boolean;
  error: string;
  formErrors: Record<string, unknown>;
  usernameFocused: boolean;
  passwordFocused: boolean;
  showForceChangePassword: boolean;
  newPassword: string;
  confirmPassword: string;
  changePasswordLoading: boolean;
  changePasswordError: string;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleUsernameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleUsernameFocus: () => void;
  handleUsernameBlur: () => void;
  handlePasswordChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handlePasswordFocus: () => void;
  handlePasswordBlur: () => void;
  handleChangePassword: (e: FormEvent<HTMLFormElement>) => void;
  handleCloseModal: () => void;
  setNewPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;
}

vi.mock('./login/LoginView', () => ({
  default: (props: StubProps) => (
    <form data-testid='login-form' onSubmit={props.handleSubmit}>
      <input
        aria-label='username'
        value={props.username}
        onChange={props.handleUsernameChange}
        onFocus={props.handleUsernameFocus}
        onBlur={props.handleUsernameBlur}
      />
      <input
        aria-label='password'
        type='password'
        value={props.password}
        onChange={props.handlePasswordChange}
        onFocus={props.handlePasswordFocus}
        onBlur={props.handlePasswordBlur}
      />
      <input
        aria-label='newPassword'
        value={props.newPassword}
        onChange={(e) => props.setNewPassword(e.target.value)}
      />
      <input
        aria-label='confirmPassword'
        value={props.confirmPassword}
        onChange={(e) => props.setConfirmPassword(e.target.value)}
      />
      <button type='submit'>login</button>
      <button
        type='button'
        onClick={(e) => props.handleChangePassword(e as unknown as FormEvent<HTMLFormElement>)}
      >
        change
      </button>
      <button type='button' onClick={props.handleCloseModal}>
        close
      </button>
      <span data-testid='error'>{props.error}</span>
      <span data-testid='force'>{String(props.showForceChangePassword)}</span>
      <span data-testid='cperr'>{props.changePasswordError}</span>
      <span data-testid='loading'>{String(props.loading)}</span>
    </form>
  ),
}));

const flush = () => waitFor(() => expect(screen.getByTestId('login-form')).toBeTruthy());

describe('pages/Login 逻辑层', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('检查认证：无 admin 时结束 loading 渲染表单', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    expect(screen.getByTestId('login-form')).toBeTruthy();
  });

  it('检查认证：已存 admin 时直接跳转根路径且不渲染表单', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1 }));
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByTestId('login-form')).toBeNull());
  });

  it('提交校验失败：setFormErrors 并返回', async () => {
    (validateForm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: false,
      errors: { username: 'required' },
    });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe(''));
  });

  it('提交成功：管理员 → 写 admin、清学生凭证、清权限缓存', async () => {
    (validateForm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: true,
      errors: {},
    });
    (isAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockLogin.mockResolvedValue({ user: { id: 1, role: 'admin', force_password_change: false } });
    mockFetchCsrf.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    expect(localStorage.getItem('admin')).toBeTruthy();
    expect(localStorage.getItem('student')).toBeNull();
    expect(localStorage.getItem('user_permissions')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  });

  it('提交成功：非管理员 → 写 subaccount', async () => {
    (validateForm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: true,
      errors: {},
    });
    (isAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    mockLogin.mockResolvedValue({ user: { id: 2, role: 'teacher', force_password_change: false } });
    mockFetchCsrf.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() => expect(localStorage.getItem('subaccount')).toBeTruthy());
  });

  it('提交成功：force_password_change → 弹强制改密', async () => {
    (validateForm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: true,
      errors: {},
    });
    (isAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockLogin.mockResolvedValue({ user: { id: 1, role: 'admin', force_password_change: true } });
    mockFetchCsrf.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() => expect(screen.getByTestId('force').textContent).toBe('true'));
  });

  it('提交成功：role=dashboard → 跳 /dashboard', async () => {
    (validateForm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: true,
      errors: {},
    });
    (isAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockLogin.mockResolvedValue({
      user: { id: 1, role: 'dashboard', force_password_change: false },
    });
    mockFetchCsrf.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
  });

  it('提交成功：来自非 login 路径 → 跳回 fromPath', async () => {
    (validateForm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: true,
      errors: {},
    });
    (isAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockLogin.mockResolvedValue({ user: { id: 1, role: 'admin', force_password_change: false } });
    mockFetchCsrf.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/x' } } }]}>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
  });

  it('提交异常：setError 兜底', async () => {
    (validateForm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: true,
      errors: {},
    });
    (isAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockLogin.mockRejectedValue({ error: 'bad', message: 'fail' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('bad'));
  });

  it('用户名/密码输入回调 + 焦点切换', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    const u = screen.getByLabelText('username') as HTMLInputElement;
    fireEvent.change(u, { target: { value: 'alice' } });
    fireEvent.focus(u);
    fireEvent.blur(u);
    const p = screen.getByLabelText('password') as HTMLInputElement;
    fireEvent.change(p, { target: { value: 'secret' } });
    fireEvent.focus(p);
    fireEvent.blur(p);
    expect(u.value).toBe('alice');
    expect(p.value).toBe('secret');
  });

  it('强制改密：两次密码不一致 → 报错', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.change(screen.getByLabelText('newPassword'), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByText('change'));
    await waitFor(() =>
      expect(screen.getByTestId('cperr').textContent).toBe('login.passwordMismatch')
    );
  });

  it('强制改密：新密码过短 → 报错', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.change(screen.getByLabelText('newPassword'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('change'));
    await waitFor(() =>
      expect(screen.getByTestId('cperr').textContent).toBe('login.passwordTooShort')
    );
  });

  it('强制改密：无 admin 信息 → 报错', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    fireEvent.change(screen.getByLabelText('newPassword'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByText('change'));
    await waitFor(() => expect(screen.getByTestId('cperr').textContent).toBe('login.noUserInfo'));
  });

  it('强制改密：成功 → 更新 admin、关弹窗、跳根', async () => {
    mockChangePassword.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    localStorage.setItem('admin', JSON.stringify({ id: 7, force_password_change: true }));
    fireEvent.change(screen.getByLabelText('newPassword'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByText('change'));
    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith(7, {
        old_password: '',
        new_password: 'abcdef',
      })
    );
    const updated = JSON.parse(localStorage.getItem('admin') as string);
    expect(updated.force_password_change).toBe(false);
    await waitFor(() => expect(screen.getByTestId('force').textContent).toBe('false'));
  });

  it('强制改密：接口异常 → 报错', async () => {
    mockChangePassword.mockRejectedValue({ error: 'cp fail', message: 'cp fail' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    localStorage.setItem('admin', JSON.stringify({ id: 7, force_password_change: true }));
    fireEvent.change(screen.getByLabelText('newPassword'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByText('change'));
    await waitFor(() => expect(screen.getByTestId('cperr').textContent).toBe('cp fail'));
  });

  it('关闭弹窗：清 localStorage 与表单状态', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await flush();
    localStorage.setItem('admin', JSON.stringify({ id: 7 }));
    fireEvent.change(screen.getByLabelText('newPassword'), { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByText('close'));
    expect(localStorage.getItem('admin')).toBeNull();
    expect((screen.getByLabelText('newPassword') as HTMLInputElement).value).toBe('');
  });
});
