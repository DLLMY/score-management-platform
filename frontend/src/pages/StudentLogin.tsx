import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, User, LogIn, AlertCircle } from 'lucide-react';
import api from '../services/api';

function StudentLogin() {
  const [cardId, setCardId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('student')) {
      navigate('/student', { replace: true });
      return;
    }
    setChecking(false);
  }, [navigate]);

  if (checking) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500'></div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    if (!cardId.trim() || !name.trim()) {
      setError('请输入学号和姓名');
      return;
    }
    setLoading(true);
    try {
      const result = await api.student.login({ card_id: cardId.trim(), name: name.trim() });
      // M10: 双身份隔离——登录学生端时清除管理端凭证，防止 URL 串访
      localStorage.removeItem('admin');
      localStorage.removeItem('subaccount');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // 十评 P2-1 完全 cookie 化：student_token 由后端 HttpOnly cookie 写入
      localStorage.setItem('student', JSON.stringify(result.student));
      navigate('/student', { replace: true });
    } catch (err: unknown) {
      setError((err as Error)?.message || '登录失败，请检查学号和姓名');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/50 to-purple-50/30 flex items-center justify-center p-4'>
      <div className='w-full max-w-sm relative z-10'>
        <div className='text-center mb-6'>
          <div className='inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600 rounded-3xl shadow-2xl shadow-primary-500/40 mb-4'>
            <LogIn className='w-8 h-8 text-white' />
          </div>
          <h1 className='text-2xl font-bold text-gray-800'>学生自助查询</h1>
          <p className='text-sm text-gray-500 mt-1'>使用学号与姓名登录，查询个人积分</p>
        </div>

        <div className='bg-white rounded-3xl shadow-xl border border-gray-200/50 p-6'>
          <form onSubmit={handleSubmit} className='space-y-5'>
            {error && (
              <div
                className='bg-red-500/20 border border-red-500/40 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2'
                role='alert'
              >
                <AlertCircle className='w-5 h-5 flex-shrink-0' />
                {error}
              </div>
            )}

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                学号 / 卡号 <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <CreditCard className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='text'
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  placeholder='请输入学号'
                  autoComplete='off'
                  className='w-full pl-12 pr-4 py-3 bg-gray-100 border-2 border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-primary-500 transition-all'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                姓名 <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <User className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='请输入姓名'
                  autoComplete='off'
                  className='w-full pl-12 pr-4 py-3 bg-gray-100 border-2 border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-primary-500 transition-all'
                />
              </div>
            </div>

            <button
              type='submit'
              disabled={loading}
              className='w-full bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50'
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>

        <div className='text-center mt-4 text-xs text-gray-500'>
          <p>© 2024 积分管理平台 · 学生自助端</p>
        </div>
      </div>
    </div>
  );
}

export default StudentLogin;
