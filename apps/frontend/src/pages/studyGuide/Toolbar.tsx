import { Search } from 'lucide-react';
import { ClassSelect, WorkbenchBreadcrumb, CurrentClassLabel } from '../../components';

interface ToolbarProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  activeTab: 'guides' | 'plans';
  setActiveTab: (t: 'guides' | 'plans') => void;
  filterClassId: number;
  setFilterClassId: (id: number) => void;
}

export default function Toolbar({
  searchTerm,
  setSearchTerm,
  activeTab,
  setActiveTab,
  filterClassId,
  setFilterClassId,
}: ToolbarProps) {
  return (
    <div className='px-6 py-4 flex items-center flex-wrap gap-4'>
      <div className='relative flex-1 max-w-md'>
        <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
        <input
          type='text'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={activeTab === 'guides' ? '搜索文章标题或内容...' : '搜索学生或计划内容...'}
          aria-label='搜索指导文章或改进计划'
          className='w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all'
        />
      </div>
      {activeTab === 'guides' && (
        <>
          <div className='w-44 shrink-0'>
            <ClassSelect
              allowEmpty
              emptyLabel='全部班级'
              value={filterClassId}
              onChange={setFilterClassId}
            />
          </div>
          <WorkbenchBreadcrumb current='学法指导' />
          <CurrentClassLabel />
        </>
      )}
      <div className='flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-1'>
        <button
          onClick={() => setActiveTab('guides')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'guides'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
          }`}
        >
          指导文章
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'plans'
              ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
          }`}
        >
          改进计划
        </button>
      </div>
    </div>
  );
}
