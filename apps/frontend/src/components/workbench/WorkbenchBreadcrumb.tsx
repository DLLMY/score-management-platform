import { Link } from 'react-router-dom';
import { ChevronRight, LayoutDashboard } from 'lucide-react';

interface WorkbenchBreadcrumbProps {
  /** 当前子页标题，用于面包屑末端展示 */
  current: string;
}

/**
 * 班主任工作台子页共享面包屑：工作台总览 / 当前页
 * 「工作台总览」可点击返回 /workbench，统一各子页导航入口（P3-e）。
 */
export default function WorkbenchBreadcrumb({ current }: WorkbenchBreadcrumbProps) {
  return (
    <nav
      aria-label='breadcrumb'
      className='flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400'
    >
      <LayoutDashboard className='w-4 h-4 shrink-0' />
      <Link
        to='/workbench'
        className='font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
      >
        工作台总览
      </Link>
      <ChevronRight className='w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600' />
      <span className='font-semibold text-slate-800 dark:text-slate-100'>{current}</span>
    </nav>
  );
}
