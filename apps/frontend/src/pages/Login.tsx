import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { validateForm } from '../utils/validation';
import { fetchCsrfToken } from '../services/api';
import { isAdmin } from '../utils/auth';
import LoginView from './login/LoginView';
import type { FormErrors, ApiError } from './login/types';

/**
 * 登录页（逻辑层）：表单状态、认证校验、提交与强制改密流程。
 * 视图见 ./login/LoginView。
 */
function Login() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [usernameFocused, setUsernameFocused] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [showForceChangePassword, setShowForceChangePassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [changePasswordLoading, setChangePasswordLoading] = useState<boolean>(false);
  const [changePasswordError, setChangePasswordError] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const adminStr = localStorage.getItem('admin');
        if (adminStr) {
          navigate('/', { replace: true });
          return;
        }
      } catch {
        // ignore
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  // 如果还在检查认证状态，显示加载中
  if (isCheckingAuth) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500'></div>
      </div>
    );
  }

  const validationRules: Record<string, (string | { [key: string]: number })[]> = {
    username: ['required', { minLength: 2 }, { maxLength: 50 }],
    password: ['required', { minLength: 6 }, { maxLength: 100 }],
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    const { isValid, errors } = validateForm({ username, password }, validationRules);

    if (!isValid) {
      setFormErrors(errors as FormErrors);
      return;
    }

    setFormErrors({});
    setLoading(true);

    try {
      const result = await api.auth.login({ username, password });

      const userData = result.user;

      if (userData && isAdmin(userData)) {
        localStorage.setItem('admin', JSON.stringify(userData));
      } else if (userData) {
        localStorage.setItem('subaccount', JSON.stringify(userData));
      }

      // M10: 双身份隔离——登录管理端时清除学生端凭证，防止 URL 串访
      localStorage.removeItem('student');
      localStorage.removeItem('student_token');

      // 十评 P2-1 完全 cookie 化：token 由后端 Set-Cookie HttpOnly 写入，前端不再存储
      localStorage.removeItem('user_permissions');

      try {
        await fetchCsrfToken();
      } catch {
        // ignore csrf errors on login
      }

      if (userData?.force_password_change) {
        setShowForceChangePassword(true);
      } else {
        const role = userData?.role;
        const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
        if (role === 'dashboard') {
          navigate('/dashboard', { replace: true });
        } else if (fromPath && fromPath !== '/login') {
          navigate(fromPath, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || apiError.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setUsername(e.target.value);
    if (formErrors.username) {
      setFormErrors((prev: FormErrors) => ({ ...prev, username: null }));
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
    if (formErrors.password) {
      setFormErrors((prev: FormErrors) => ({ ...prev, password: null }));
    }
  };

  const handleUsernameFocus = (): void => setUsernameFocused(true);
  const handleUsernameBlur = (): void => setUsernameFocused(false);
  const handlePasswordFocus = (): void => setPasswordFocused(true);
  const handlePasswordBlur = (): void => setPasswordFocused(false);

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setChangePasswordError('');

    if (newPassword !== confirmPassword) {
      setChangePasswordError('两次输入的密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      setChangePasswordError('密码长度至少为6位');
      return;
    }

    setChangePasswordLoading(true);

    try {
      const adminStr = localStorage.getItem('admin');
      if (!adminStr) {
        setChangePasswordError('无法获取用户信息');
        return;
      }
      const admin = JSON.parse(adminStr);

      await api.admins.changePassword(admin.id, {
        old_password: password,
        new_password: newPassword,
      });

      admin.force_password_change = false;
      localStorage.setItem('admin', JSON.stringify(admin));

      setShowForceChangePassword(false);
      navigate('/');
    } catch (err) {
      const apiError = err as ApiError;
      setChangePasswordError(apiError.error || apiError.message || '修改密码失败');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleCloseModal = (): void => {
    localStorage.clear();
    setShowForceChangePassword(false);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <LoginView
      username={username}
      password={password}
      loading={loading}
      error={error}
      formErrors={formErrors}
      usernameFocused={usernameFocused}
      passwordFocused={passwordFocused}
      showForceChangePassword={showForceChangePassword}
      newPassword={newPassword}
      confirmPassword={confirmPassword}
      changePasswordLoading={changePasswordLoading}
      changePasswordError={changePasswordError}
      handleSubmit={handleSubmit}
      handleUsernameChange={handleUsernameChange}
      handleUsernameFocus={handleUsernameFocus}
      handleUsernameBlur={handleUsernameBlur}
      handlePasswordChange={handlePasswordChange}
      handlePasswordFocus={handlePasswordFocus}
      handlePasswordBlur={handlePasswordBlur}
      handleChangePassword={handleChangePassword}
      handleCloseModal={handleCloseModal}
      setNewPassword={setNewPassword}
      setConfirmPassword={setConfirmPassword}
    />
  );
}

export default Login;
