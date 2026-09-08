import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Compass } from 'lucide-react';

/**
 * 404 兜底页（S1 修复）：任何未匹配路由的收尾，提供恢复入口，避免主体白屏。
 */
function NotFound() {
  const navigate = useNavigate();

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4'>
      <div className='text-center max-w-md w-full'>
        <div className='w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6'>
          <Compass className='w-10 h-10 text-white' />
        </div>
        <h1 className='text-6xl font-black text-slate-800 dark:text-slate-100 bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent'>
          404
        </h1>
        <p className='mt-3 text-lg font-semibold text-slate-700 dark:text-slate-300'>页面不存在</p>
        <p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>
          您访问的地址不存在或已失效，请检查链接或返回首页继续使用。
        </p>
        <div className='mt-8 flex items-center justify-center gap-3'>
          <button
            onClick={() => navigate('/')}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium'
          >
            <Home className='w-4 h-4' />
            返回首页
          </button>
          <button
            onClick={() => navigate(-1)}
            className='flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium'
          >
            <ArrowLeft className='w-4 h-4' />
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
