import { Lock, User, LogIn, AlertCircle, Shield, Fingerprint, RefreshCw } from 'lucide-react';
import type { ForceChangePasswordModalProps, LoginViewProps } from './types';

/**
 * 登录页视图层：主渲染 + 强制修改密码模态。
 * 状态与提交逻辑见 ../Login。
 */
export default function LoginView({
  username,
  password,
  loading,
  error,
  formErrors,
  usernameFocused,
  passwordFocused,
  showForceChangePassword,
  newPassword,
  confirmPassword,
  changePasswordLoading,
  changePasswordError,
  handleSubmit,
  handleUsernameChange,
  handleUsernameFocus,
  handleUsernameBlur,
  handlePasswordChange,
  handlePasswordFocus,
  handlePasswordBlur,
  handleChangePassword,
  handleCloseModal,
  setNewPassword,
  setConfirmPassword,
}: LoginViewProps) {
  const ForceChangePasswordModal = ({ isOpen, onClose }: ForceChangePasswordModalProps) => {
    if (!isOpen) return null;

    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
        <div
          className='fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in'
          onClick={onClose}
        />
        <div className='relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-scale-in'>
          <div className='flex items-center gap-3 mb-6'>
            <div className='w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center'>
              <RefreshCw className='w-6 h-6 text-white' />
            </div>
            <div>
              <h2 className='text-xl font-bold text-gray-800'>强制修改密码</h2>
              <p className='text-sm text-gray-500'>首次登录或密码已过期，请设置新密码</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className='space-y-5'>
            {changePasswordError && (
              <div
                className='bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2'
                role='alert'
              >
                <AlertCircle className='w-5 h-5 flex-shrink-0' />
                {changePasswordError}
              </div>
            )}

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                当前密码 <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <Lock className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='password'
                  value={password}
                  disabled
                  className='w-full pl-12 pr-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-primary-500 transition-all'
                  placeholder='当前密码'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                新密码 <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <Lock className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='password'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder='请输入新密码（至少6位）'
                  className='w-full pl-12 pr-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-primary-500 transition-all'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                确认新密码 <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <Lock className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder='请再次输入新密码'
                  className='w-full pl-12 pr-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-primary-500 transition-all'
                />
              </div>
            </div>

            <div className='flex gap-3'>
              <button
                type='button'
                onClick={onClose}
                className='flex-1 py-3 px-6 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-all'
              >
                取消登录
              </button>
              <button
                type='submit'
                disabled={changePasswordLoading}
                className='flex-1 bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {changePasswordLoading ? (
                  <span className='flex items-center gap-2'>
                    <div className='w-4 h-4 border-2 border-white/30 rounded-full animate-spin border-t-white' />
                    修改中
                  </span>
                ) : (
                  '修改密码并登录'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/50 to-purple-50/30 flex items-center justify-center p-4'>
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow' />
        <div
          className='absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow'
          style={{ animationDelay: '1s' }}
        />
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/6 rounded-full blur-3xl' />
      </div>

      <div className='w-full max-w-sm sm:max-w-md relative z-10'>
        <div className='text-center mb-6 sm:mb-8'>
          <div className='relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600 rounded-3xl shadow-2xl shadow-primary-500/40 mb-4 sm:mb-6 animate-fade-in'>
            <LogIn className='w-8 h-8 sm:w-10 sm:h-10 text-white relative z-10' />
            <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600 rounded-3xl opacity-50 blur-xl animate-pulse-slow' />
            <div className='absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md'>
              <Shield className='w-2 h-2 sm:w-2.5 sm:h-2.5 text-white' />
            </div>
          </div>
          <h1
            className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 animate-fade-in'
            style={{ animationDelay: '100ms' }}
          >
            积分管理平台
          </h1>
          <p
            className='text-sm sm:text-base text-gray-500 animate-fade-in'
            style={{ animationDelay: '200ms' }}
          >
            请登录以继续
          </p>
        </div>

        <div
          className='bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/50 p-6 sm:p-8 animate-fade-in'
          style={{ animationDelay: '300ms' }}
        >
          <div className='flex items-center justify-center gap-2 mb-4 sm:mb-6 text-xs text-gray-500'>
            <Fingerprint className='w-4 h-4 text-green-500' />
            <span>安全登录 - 数据已加密</span>
          </div>

          <form onSubmit={handleSubmit} className='space-y-5 sm:space-y-6'>
            {error && (
              <div
                className='bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake'
                role='alert'
                aria-live='polite'
                aria-label='登录错误提示'
              >
                <AlertCircle className='w-5 h-5 flex-shrink-0' aria-hidden='true' />
                {error}
              </div>
            )}

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                用户名 <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <div
                  className={`absolute inset-0 rounded-xl transition-all duration-300 pointer-events-none ${
                    usernameFocused
                      ? 'bg-gradient-to-r from-primary-500/10 via-blue-500/10 to-cyan-500/10 shadow-lg shadow-primary-500/10 ring-2 ring-primary-500/30'
                      : 'bg-gray-100'
                  }`}
                />
                <div
                  className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${
                    usernameFocused ? 'text-primary-500 scale-110' : 'text-gray-400'
                  }`}
                >
                  <User className='w-4 h-4 sm:w-5 sm:h-5' />
                </div>
                <input
                  type='text'
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder='请输入用户名'
                  onFocus={handleUsernameFocus}
                  onBlur={handleUsernameBlur}
                  autoComplete='username'
                  aria-label='用户名'
                  aria-required={true}
                  aria-invalid={!!formErrors.username}
                  className={`w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-transparent border-2 border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none transition-all ${
                    formErrors.username ? 'ring-2 ring-red-500/50' : ''
                  }`}
                />
              </div>
              {formErrors.username && (
                <p className='mt-2 text-sm text-red-500 flex items-center gap-1'>
                  <AlertCircle className='w-4 h-4' />
                  {formErrors.username}
                </p>
              )}
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                密码 <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <div
                  className={`absolute inset-0 rounded-xl transition-all duration-300 pointer-events-none ${
                    passwordFocused
                      ? 'bg-gradient-to-r from-primary-500/10 via-blue-500/10 to-cyan-500/10 shadow-lg shadow-primary-500/10 ring-2 ring-primary-500/30'
                      : 'bg-gray-100'
                  }`}
                />
                <div
                  className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${
                    passwordFocused ? 'text-primary-500 scale-110' : 'text-gray-400'
                  }`}
                >
                  <Lock className='w-4 h-4 sm:w-5 sm:h-5' />
                </div>
                <input
                  type='password'
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder='请输入密码'
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  autoComplete='current-password'
                  aria-label='密码'
                  aria-required={true}
                  aria-invalid={!!formErrors.password}
                  className={`w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-transparent border-2 border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none transition-all ${
                    formErrors.password ? 'ring-2 ring-red-500/50' : ''
                  }`}
                />
              </div>
              {formErrors.password && (
                <p className='mt-2 text-sm text-red-500 flex items-center gap-1'>
                  <AlertCircle className='w-4 h-4' />
                  {formErrors.password}
                </p>
              )}
            </div>

            <button
              type='submit'
              disabled={loading}
              aria-label='登录'
              aria-busy={loading}
              className='relative w-full bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 text-white py-3 sm:py-3.5 px-6 rounded-xl font-semibold text-sm sm:text-base hover:shadow-2xl hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-primary-500/30 overflow-hidden'
            >
              <span
                className={loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}
              >
                {loading ? '' : '登录'}
              </span>
              {loading && (
                <span className='absolute inset-0 flex items-center justify-center'>
                  <div className='w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 rounded-full animate-spin border-t-white' />
                </span>
              )}
            </button>
          </form>
        </div>

        <div className='text-center mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500'>
          <p>© 2024 积分管理平台</p>
        </div>
      </div>

      <ForceChangePasswordModal isOpen={showForceChangePassword} onClose={handleCloseModal} />
    </div>
  );
}
