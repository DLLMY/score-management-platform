/**
 * Login组件测试 - 增强版
 */
/// <reference types="jest" />
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Login from '../../pages/Login';

const mockLocalStorage = () => {
  const store: Record<string, string> = {};

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: { value: 0 },
    },
    writable: true,
  });

  return store;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Login Component', () => {
  beforeEach(() => {
    mockLocalStorage();
    jest.clearAllMocks();
  });

  test('登录页面可以渲染并显示表单', async () => {
    render(<Login />, { wrapper });

    await waitFor(() => {
      const usernameInput = screen.getByPlaceholderText(/用户名/i);
      expect(usernameInput).toBeInTheDocument();
    });

    await waitFor(() => {
      const passwordInput = screen.getByPlaceholderText(/密码/i);
      expect(passwordInput).toBeInTheDocument();
    });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /登录/i });
      expect(submitButton).toBeInTheDocument();
    });
  });

  test('表单验证 - 空用户名显示错误', async () => {
    render(<Login />, { wrapper });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /登录/i });
      expect(submitButton).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /登录/i });
    userEvent.click(submitButton);

    await waitFor(() => {
      const errorMessages = screen.getAllByText(/必填/i);
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('表单验证 - 密码过短显示错误', async () => {
    render(<Login />, { wrapper });

    await waitFor(() => {
      const usernameInput = screen.getByPlaceholderText(/用户名/i);
      expect(usernameInput).toBeInTheDocument();
    });

    await waitFor(() => {
      const passwordInput = screen.getByPlaceholderText(/密码/i);
      expect(passwordInput).toBeInTheDocument();
    });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /登录/i });
      expect(submitButton).toBeInTheDocument();
    });

    const usernameInput = screen.getByPlaceholderText(/用户名/i);
    const passwordInput = screen.getByPlaceholderText(/密码/i);
    const submitBtn = screen.getByRole('button', { name: /登录/i });

    await userEvent.type(usernameInput, 'admin');
    await userEvent.type(passwordInput, '123');
    userEvent.click(submitBtn);

    await waitFor(() => {
      const minLengthError = screen.getByText(/最少/i);
      expect(minLengthError).toBeInTheDocument();
    });
  });
});

describe('Login Component - Force Password Change', () => {
  beforeEach(() => {
    mockLocalStorage();
    jest.clearAllMocks();
  });

  test('登录页面初始状态下不显示强制改密弹窗', async () => {
    render(<Login />, { wrapper });

    await waitFor(() => {
      const modal = screen.queryByRole('dialog');
      expect(modal).not.toBeInTheDocument();
    });
  });

  test('登录页面渲染完整的登录表单', async () => {
    render(<Login />, { wrapper });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/用户名/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/密码/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    });
  });

  test('localStorage mock 工作正常', async () => {
    const store = mockLocalStorage();
    store['test_key'] = 'test_value';

    expect(window.localStorage.getItem('test_key')).toBe('test_value');
    window.localStorage.setItem('new_key', 'new_value');
    expect(store['new_key']).toBe('new_value');
  });
});
