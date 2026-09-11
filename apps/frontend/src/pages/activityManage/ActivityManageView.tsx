import React from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Users,
  X,
  Check,
  UserPlus,
  UserMinus,
  Search,
} from 'lucide-react';
import { Activity } from '../../types';
import {
  ClassSelect,
  ToggleSwitch,
  WorkbenchBreadcrumb,
  CurrentClassLabel,
  DateRangeField,
  EmptyState,
  LoadingSpinner,
} from '../../components';
import { Pagination } from 'antd';

export interface ActivityFormData {
  id: number | null;
  title: string;
  description: string;
  activity_type: string;
  start_date: string;
  end_date: string;
  location: string;
  organizer: string;
  is_published: boolean;
}

export const defaultActivityForm: ActivityFormData = {
  id: null,
  title: '',
  description: '',
  activity_type: '文体活动',
  start_date: '',
  end_date: '',
  location: '',
  organizer: '',
  is_published: true,
};

const activityTypes = ['文体活动', '运动会', '文艺汇演', '志愿服务', '其他'];

interface ActivityListResult {
  items: Activity[];
  loading: boolean;
  total: number;
  refetch: () => void;
}

interface ActivityManageViewProps {
  activityPage: number;
  setActivityPage: (p: number) => void;
  filterClassId: number;
  setFilterClassId: (v: number) => void;
  selectedClassId: number;
  setSelectedClassId: (v: number) => void;
  submitting: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  publishedFilter: boolean | undefined;
  setPublishedFilter: (v: boolean | undefined) => void;
  showModal: boolean;
  formData: ActivityFormData;
  formErrors: Record<string, string>;
  activities: ActivityListResult;
  filteredActivities: Activity[];
  onOpenCreate: () => void;
  onOpenEdit: (a: Activity) => void;
  onCloseModal: () => void;
  onSubmit: () => void;
  onDelete: (id: number) => void;
  onRegister: (id: number) => void;
  onCancelRegistration: (id: number) => void;
  onChange: (field: keyof ActivityFormData, value: string | boolean) => void;
}

const ActivityManageView: React.FC<ActivityManageViewProps> = ({
  activityPage,
  setActivityPage,
  filterClassId,
  setFilterClassId,
  selectedClassId,
  setSelectedClassId,
  submitting,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  publishedFilter,
  setPublishedFilter,
  showModal,
  formData,
  formErrors,
  activities,
  filteredActivities,
  onOpenCreate,
  onOpenEdit,
  onCloseModal,
  onSubmit,
  onDelete,
  onRegister,
  onCancelRegistration,
  onChange,
}) => {
  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20'>
                <Calendar className='w-6 h-6 text-white' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                文体活动管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级文体活动、学生报名与参与情况
              </p>
            </div>
          </div>
          <button
            onClick={onOpenCreate}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Plus className='w-5 h-5' />
            新建活动
          </button>
        </div>
      </div>

      <div className='px-6 py-4 flex items-center flex-wrap gap-4'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='搜索活动名称或描述...'
            aria-label='搜索活动'
            className='w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm transition-all'
          />
        </div>
        <div className='w-44 shrink-0'>
          <ClassSelect
            allowEmpty
            emptyLabel='全部班级'
            value={filterClassId}
            onChange={setFilterClassId}
          />
        </div>
        <WorkbenchBreadcrumb current='文体活动管理' />
        <CurrentClassLabel />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm'
        >
          <option value=''>全部类型</option>
          {activityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div
          className='flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl shrink-0'
          role='group'
          aria-label='按发布状态筛选活动'
        >
          {(
            [
              [undefined, '全部'],
              [true, '已发布'],
              [false, '未发布'],
            ] as const
          ).map(([key, label], idx) => (
            <button
              key={idx}
              type='button'
              onClick={() => setPublishedFilter(key)}
              aria-pressed={publishedFilter === key}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                publishedFilter === key
                  ? 'bg-white dark:bg-slate-600 text-violet-600 dark:text-violet-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className='flex-1 px-6 pb-6 overflow-y-auto'>
        {activities.loading ? (
          <div className='flex items-center justify-center py-20'>
            <LoadingSpinner text='加载活动列表...' />
          </div>
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            icon='folder'
            title='暂无活动数据'
            description='还没有任何活动记录'
            actionLabel='创建第一个活动'
            onAction={onOpenCreate}
          />
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {filteredActivities.map((activity, index) => (
              <div
                key={activity.id}
                className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 hover:shadow-md transition-all duration-300 group'
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/5 to-purple-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500' />

                <div className='relative'>
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20'>
                        <Calendar className='w-5 h-5 text-white' />
                      </div>
                      <div>
                        <h3 className='font-semibold text-slate-800 dark:text-slate-100 line-clamp-1'>
                          {activity.title}
                        </h3>
                        <span className='text-xs text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full'>
                          {activity.activity_type || '未分类'}
                        </span>
                      </div>
                    </div>
                    <div className='flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity'>
                      <button
                        onClick={() => onOpenEdit(activity)}
                        className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                        title='编辑'
                      >
                        <Edit2 className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => onDelete(activity.id)}
                        className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                        title='删除'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </div>

                  {activity.description && (
                    <p className='text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2'>
                      {activity.description}
                    </p>
                  )}

                  <div className='space-y-2 text-sm text-slate-500 dark:text-slate-400'>
                    {activity.start_date && (
                      <div className='flex items-center gap-2'>
                        <Calendar className='w-4 h-4' />
                        <span>
                          {activity.start_date}
                          {activity.end_date && ` ~ ${activity.end_date}`}
                        </span>
                      </div>
                    )}
                    {activity.location && (
                      <div className='flex items-center gap-2'>
                        <MapPin className='w-4 h-4' />
                        <span>{activity.location}</span>
                      </div>
                    )}
                    <div className='flex items-center gap-2'>
                      <Users className='w-4 h-4' />
                      <span>
                        已报名{' '}
                        {activity.registration_count != null ? activity.registration_count : '--'}{' '}
                        人
                      </span>
                    </div>
                  </div>

                  <div className='mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-2'>
                    <button
                      onClick={() => onRegister(activity.id)}
                      className='flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:shadow-md hover:shadow-violet-500/20 transition-all text-sm font-medium'
                    >
                      <UserPlus className='w-4 h-4' />
                      报名
                    </button>
                    <button
                      onClick={() => onCancelRegistration(activity.id)}
                      className='flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all text-sm font-medium'
                    >
                      <UserMinus className='w-4 h-4' />
                      取消
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {activities.total > 50 && (
          <div className='mt-5 flex justify-center'>
            <Pagination
              current={activityPage}
              total={activities.total}
              pageSize={50}
              onChange={(p) => setActivityPage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={onCloseModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-white dark:from-violet-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center'>
                    <Calendar className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑活动' : '创建活动'}
                  </h3>
                </div>
                <button
                  onClick={onCloseModal}
                  aria-label='关闭活动弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  班级 <span className='text-red-500'>*</span>
                </label>
                <ClassSelect
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  disabled={!!formData.id}
                  emptyPlaceholder='暂无班级'
                />
                {formData.id && <p className='mt-1 text-xs text-slate-400'>编辑时班级不可更改</p>}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动标题 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.title}
                  onChange={(e) => onChange('title', e.target.value)}
                  placeholder='输入活动标题'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                    formErrors.title
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-violet-500'
                  }`}
                />
                {formErrors.title && (
                  <p className='mt-1 text-xs text-red-500'>{formErrors.title}</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动类型
                </label>
                <select
                  value={formData.activity_type}
                  onChange={(e) => onChange('activity_type', e.target.value)}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-800 dark:text-slate-100'
                >
                  {activityTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => onChange('description', e.target.value)}
                  placeholder='输入活动描述'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all resize-none text-slate-800 dark:text-slate-100'
                />
              </div>

              <DateRangeField
                startValue={formData.start_date}
                endValue={formData.end_date}
                onStartChange={(v) => onChange('start_date', v)}
                onEndChange={(v) => onChange('end_date', v)}
                startError={null}
                endError={formErrors.end_date}
                focusColor='focus:ring-violet-500/50'
              />

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动地点
                </label>
                <input
                  type='text'
                  value={formData.location}
                  onChange={(e) => onChange('location', e.target.value)}
                  placeholder='输入活动地点'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  主办方
                </label>
                <input
                  type='text'
                  value={formData.organizer}
                  onChange={(e) => onChange('organizer', e.target.value)}
                  placeholder='输入主办方名称'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                  发布活动
                </label>
                <ToggleSwitch
                  checked={formData.is_published}
                  onChange={(v) => onChange('is_published', v)}
                  activeClass='bg-gradient-to-r from-violet-500 to-purple-500'
                />
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={onCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={onSubmit}
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityManageView;
