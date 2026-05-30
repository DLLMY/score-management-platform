import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, AlertCircle, Shield, Fingerprint } from 'lucide-react';
import api from '../services/api';
import { validateForm } from '../utils/validation';
import { fetchCsrfToken } from '../services/api';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const navigate = useNavigate();

  const validationRules = {
    username: ['required', { minLength: 2 }, { maxLength: 50 }],
    password: ['required', { minLength: 6 }, { maxLength: 100 }]
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { isValid, errors } = validateForm({ username, password }, validationRules);

    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setLoading(true);

    try {
      const result = await api.admins.login({ username, password });

      const adminData = result.admin || result;
      localStorage.setItem('admin', JSON.stringify(adminData));

      if (result.access_token) {
        localStorage.setItem('access_token', result.access_token);
      }
      if (result.refresh_token) {
        localStorage.setItem('refresh_token', result.refresh_token);
      }

      await fetchCsrfToken();

      const role = adminData.role;
      if (role === 'dashboard') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.error || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/50 to-purple-900/50 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f172a_70%)]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600 rounded-3xl shadow-2xl shadow-primary-500/40 mb-6 animate-fade-in">
            <LogIn className="w-10 h-10 text-white relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600 rounded-3xl opacity-50 blur-xl animate-pulse-slow" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
              <Shield className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
            积分管理平台
          </h1>
          <p className="text-slate-400 animate-fade-in" style={{ animationDelay: '200ms' }}>请登录以继续</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-center gap-2 mb-6 text-xs text-slate-400">
            <Fingerprint className="w-4 h-4 text-green-400" />
            <span>安全登录 - 数据已加密</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                用户名 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 pointer-events-none ${
                  usernameFocused ? 'bg-gradient-to-r from-primary-500/20 via-blue-500/20 to-cyan-500/20 shadow-lg shadow-primary-500/15 ring-2 ring-primary-500/30' : 'bg-slate-700/50'
                }`} />
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${usernameFocused ? 'text-primary-400 scale-110' : 'text-slate-400'}`}>
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (formErrors.username) {
                      setFormErrors(prev => ({ ...prev, username: null }));
                    }
                  }}
                  placeholder="请输入用户名"
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                  autoComplete="username"
                  className={`w-full pl-12 pr-4 py-3.5 bg-transparent border-2 border-transparent rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                    formErrors.username ? 'ring-2 ring-red-500/50' : ''
                  }`}
                />
              </div>
              {formErrors.username && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {formErrors.username}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                密码 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 pointer-events-none ${
                  passwordFocused ? 'bg-gradient-to-r from-primary-500/20 via-blue-500/20 to-cyan-500/20 shadow-lg shadow-primary-500/15 ring-2 ring-primary-500/30' : 'bg-slate-700/50'
                }`} />
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${passwordFocused ? 'text-primary-400 scale-110' : 'text-slate-400'}`}>
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) {
                      setFormErrors(prev => ({ ...prev, password: null }));
                    }
                  }}
                  placeholder="请输入密码"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  autoComplete="current-password"
                  className={`w-full pl-12 pr-4 py-3.5 bg-transparent border-2 border-transparent rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                    formErrors.password ? 'ring-2 ring-red-500/50' : ''
                  }`}
                />
              </div>
              {formErrors.password && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {formErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 text-white py-3.5 px-6 rounded-xl font-semibold text-base hover:shadow-2xl hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-primary-500/30 overflow-hidden"
            >
              <span className={loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}>
                {loading ? '' : '登录'}
              </span>
              {loading && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/30 rounded-full animate-spin border-t-white" />
                </span>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 text-sm text-slate-400">
          <p>© 2024 积分管理平台</p>
        </div>
      </div>
    </div>
  );
}

export default Login;