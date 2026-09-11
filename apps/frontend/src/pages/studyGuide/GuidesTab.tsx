import { Pagination } from 'antd';
import { BookOpen, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { EmptyState } from '../../components';
import type { StudyGuide } from '../../types';

interface GuidesTabProps {
  filteredGuides: StudyGuide[];
  expandedGuide: number | null;
  setExpandedGuide: (id: number | null) => void;
  handleOpenGuideEdit: (guide: StudyGuide) => void;
  handleDeleteGuide: (guideId: number) => void;
  handleOpenGuideCreate: () => void;
  guidePage: number;
  guideTotal: number;
  setGuidePage: (p: number) => void;
}

export default function GuidesTab({
  filteredGuides,
  expandedGuide,
  setExpandedGuide,
  handleOpenGuideEdit,
  handleDeleteGuide,
  handleOpenGuideCreate,
  guidePage,
  guideTotal,
  setGuidePage,
}: GuidesTabProps) {
  if (filteredGuides.length === 0) {
    return (
      <EmptyState
        icon='file'
        title='暂无指导文章'
        description='还没有指导文章'
        actionLabel='创建第一篇文章'
        onAction={handleOpenGuideCreate}
      />
    );
  }

  return (
    <>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {filteredGuides.map((guide, index) => (
          <div
            key={guide.id}
            className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 hover:shadow-md transition-all duration-300 group cursor-pointer'
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
          >
            <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500' />

            <div className='relative'>
              <div className='flex items-start justify-between mb-3'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20'>
                    <BookOpen className='w-5 h-5 text-white' />
                  </div>
                  <div>
                    <h3 className='font-semibold text-slate-800 dark:text-slate-100 line-clamp-1'>
                      {guide.title}
                    </h3>
                    <div className='flex items-center gap-2 mt-1'>
                      <span className='text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'>
                        {guide.guide_type || '未分类'}
                      </span>
                      <span className='text-xs text-slate-400'>
                        {guide.target_audience || '全体'}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className='flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity'
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleOpenGuideEdit(guide)}
                    className='p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all'
                    title='编辑'
                  >
                    <Edit2 className='w-4 h-4' />
                  </button>
                  <button
                    onClick={() => handleDeleteGuide(guide.id)}
                    className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                    title='删除'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              </div>

              {guide.content && (
                <p className='text-sm text-slate-500 dark:text-slate-400 line-clamp-2'>
                  {guide.content}
                </p>
              )}

              {expandedGuide === guide.id && guide.content && (
                <div className='mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto'>
                  {guide.content}
                </div>
              )}

              <div className='mt-3 flex items-center justify-between text-xs text-slate-400'>
                <span>{guide.is_published ? '已发布' : '草稿'}</span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    expandedGuide === guide.id ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {guideTotal > 50 && (
        <div className='mt-5 flex justify-center'>
          <Pagination
            current={guidePage}
            total={guideTotal}
            pageSize={50}
            onChange={(p) => setGuidePage(p)}
            showSizeChanger={false}
          />
        </div>
      )}
    </>
  );
}
