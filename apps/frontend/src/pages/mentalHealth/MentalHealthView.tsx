import { Pagination } from 'antd';
import {
  Brain,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  X,
  Check,
  Heart,
  Moon,
  Activity,
  Frown,
  Meh,
  Smile,
} from 'lucide-react';
import {
  DataTable,
  StatCard,
  ClassSelect,
  StudentSelect,
  CurrentClassLabel,
  WorkbenchBreadcrumb,
} from '../../components';
import type { MentalHealthRecord } from '../../types';
import type { MentalHealthViewProps } from './types';
import { columns } from './columns';
import { getAlertSeverityColor, getAlertSeverityLabel } from './helpers';
// 兼容父组件（pages/MentalHealth.tsx）从本文件具名导入
export { defaultRecordForm } from './types';
export type { RecordFormData, MentalHealthViewProps } from './types';

export default function MentalHealthView(props: MentalHealthViewProps) {
  const {
    records,
    isLoading,
    alerts,
    filteredRecords,
    unresolvedAlerts,
    resolvedAlerts,
    avgMood,
    avgStress,
    avgSleep,
    recordTotal,
    alertTotal,
    recordPage,
    alertPage,
    activeTab,
    resolvedFilter,
    searchTerm,
    filterClassId,
    showForm,
    formData,
    errors,
    submitting,
    setSearchTerm,
    setActiveTab,
    setResolvedFilter,
    setRecordPage,
    setAlertPage,
    setFilterClassId,
    setFormData,
    handleOpenForm,
    handleCloseForm,
    handleSubmit,
    handleResolveAlert,
    runSubmit,
  } = props;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20'>
              <Brain className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                心理健康
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                记录心理健康数据与预警管理
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <WorkbenchBreadcrumb current='心理健康' />
            <CurrentClassLabel />
            <button
              onClick={handleOpenForm}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              快速记录
            </button>
          </div>
        </div>
      </div>

      <div className='px-6 py-5'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-5'>
          <StatCard
            label='平均心情'
            value={avgMood}
            icon={<Heart className='w-6 h-6 text-white' />}
            iconGradient='from-cyan-500 to-blue-500'
            decoGradient='from-cyan-500/10 to-blue-500/10'
            size='sm'
          />
          <StatCard
            label='平均压力'
            value={avgStress}
            icon={<Activity className='w-6 h-6 text-white' />}
            iconGradient='from-amber-500 to-orange-500'
            decoGradient='from-amber-500/10 to-orange-500/10'
            size='sm'
          />
          <StatCard
            label='平均睡眠'
            value={`${avgSleep}h`}
            icon={<Moon className='w-6 h-6 text-white' />}
            iconGradient='from-indigo-500 to-purple-500'
            decoGradient='from-indigo-500/10 to-purple-500/10'
            size='sm'
          />
          <StatCard
            label='未处理预警'
            value={alerts === null ? '—' : unresolvedAlerts.length}
            icon={<AlertTriangle className='w-6 h-6 text-white' />}
            iconGradient='from-red-500 to-pink-500'
            decoGradient='from-red-500/10 to-pink-500/10'
            size='sm'
          />
        </div>
      </div>

      <div className='flex-1 px-6 pb-6'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800 flex items-center justify-between'>
            <div className='flex items-center gap-4'>
              <div className='relative'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
                <input
                  type='text'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder='搜索学生或备注...'
                  aria-label='搜索心理健康记录'
                  className='w-64 max-w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm'
                />
              </div>
            </div>
            <div className='flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl'>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'records'
                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                记录 ({records.length})
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'alerts'
                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                预警 ({alerts === null ? '—' : unresolvedAlerts.length})
              </button>
            </div>
          </div>

          {activeTab === 'records' ? (
            <div>
              <DataTable<MentalHealthRecord>
                columns={columns}
                dataSource={filteredRecords}
                loading={isLoading}
                rowKey='id'
                empty={{
                  icon: 'data',
                  title: '暂无心理健康记录',
                  actionLabel: '创建第一条记录',
                  onAction: handleOpenForm,
                }}
              />
              {recordTotal > 50 && (
                <div className='mt-4 flex justify-center'>
                  <Pagination
                    current={recordPage}
                    total={recordTotal}
                    pageSize={50}
                    onChange={(p) => setRecordPage(p)}
                    showSizeChanger={false}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className='p-5 space-y-4'>
                <div
                  className='inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl'
                  role='group'
                  aria-label='按处理状态筛选预警'
                >
                  {(
                    [
                      [undefined, '全部'],
                      [false, '未处理'],
                      [true, '已处理'],
                    ] as const
                  ).map(([key, label], idx) => (
                    <button
                      key={idx}
                      type='button'
                      onClick={() => setResolvedFilter(key)}
                      aria-pressed={resolvedFilter === key}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        resolvedFilter === key
                          ? 'bg-white dark:bg-slate-600 text-cyan-600 dark:text-cyan-300 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <h3 className='flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3'>
                    <AlertTriangle className='w-4 h-4 text-red-500' />
                    未处理预警 ({unresolvedAlerts.length})
                  </h3>
                  {alerts === null ? (
                    <div className='bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-8 text-center'>
                      <AlertTriangle className='w-10 h-10 text-gray-400 mx-auto mb-2' />
                      <p className='text-gray-500 dark:text-slate-400 font-medium'>预警加载失败</p>
                      <p className='text-xs text-gray-400 mt-1'>请刷新或稍后重试</p>
                    </div>
                  ) : unresolvedAlerts.length === 0 ? (
                    <div className='bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-5 py-8 text-center'>
                      <CheckCircle className='w-10 h-10 text-emerald-500 mx-auto mb-2' />
                      <p className='text-emerald-700 dark:text-emerald-300 font-medium'>
                        所有预警已处理
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-3'>
                      {unresolvedAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-xl border ${getAlertSeverityColor(
                            alert.severity
                          )} transition-all hover:shadow-md`}
                        >
                          <div className='flex items-start justify-between'>
                            <div className='flex items-start gap-3'>
                              <div className='w-10 h-10 rounded-xl bg-white/50 dark:bg-slate-800/50 flex items-center justify-center'>
                                <AlertTriangle className='w-5 h-5' />
                              </div>
                              <div>
                                <div className='flex items-center gap-2 mb-1'>
                                  <span className='font-semibold'>
                                    {alert.student_name || `学生 #${alert.student_id}`}
                                  </span>
                                  <span className='text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-slate-800/50 font-medium'>
                                    {getAlertSeverityLabel(alert.severity)}
                                  </span>
                                </div>
                                <p className='text-sm opacity-80'>{alert.message}</p>
                                <p className='text-xs mt-1 opacity-60'>{alert.created_at}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleResolveAlert(alert.id)}
                              className='flex items-center gap-1 px-3 py-1.5 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all text-sm font-medium'
                            >
                              <Check className='w-4 h-4' />
                              解决
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {resolvedAlerts.length > 0 && (
                  <div>
                    <h3 className='flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3'>
                      <CheckCircle className='w-4 h-4 text-emerald-500' />
                      已处理预警 ({resolvedAlerts.length})
                    </h3>
                    <div className='space-y-2'>
                      {resolvedAlerts.slice(0, 5).map((alert) => (
                        <div
                          key={alert.id}
                          className='p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-70'
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-2'>
                              <span className='font-medium text-sm'>
                                {alert.student_name || `学生 #${alert.student_id}`}
                              </span>
                              <span className='text-xs text-slate-500 dark:text-slate-400'>
                                {alert.message}
                              </span>
                            </div>
                            <span className='text-xs text-emerald-500 flex items-center gap-1'>
                              <CheckCircle className='w-3 h-3' />
                              已解决
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {alertTotal > 50 && (
                  <div className='mt-4 flex justify-center'>
                    <Pagination
                      current={alertPage}
                      total={alertTotal}
                      pageSize={50}
                      onChange={(p) => setAlertPage(p)}
                      showSizeChanger={false}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseForm}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center'>
                    <Brain className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>快速记录</h3>
                </div>
                <button
                  onClick={handleCloseForm}
                  aria-label='关闭快速记录弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  学生 <span className='text-red-500'>*</span>
                </label>
                <StudentSelect
                  value={formData.student_id}
                  onChange={(id) => setFormData((prev) => ({ ...prev, student_id: id }))}
                  allowEmpty
                  emptyLabel='请选择学生'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                    errors.student_id
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-cyan-500'
                  }`}
                />
                {errors.student_id && (
                  <p className='mt-1 text-xs text-red-500'>{errors.student_id}</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  心情等级
                </label>
                <div className='flex items-center gap-2'>
                  {[
                    { value: 1, icon: <Frown className='w-6 h-6' />, label: '很差', color: 'red' },
                    {
                      value: 2,
                      icon: <Frown className='w-6 h-6' />,
                      label: '较差',
                      color: 'orange',
                    },
                    { value: 3, icon: <Meh className='w-6 h-6' />, label: '一般', color: 'amber' },
                    { value: 4, icon: <Smile className='w-6 h-6' />, label: '良好', color: 'lime' },
                    {
                      value: 5,
                      icon: <Smile className='w-6 h-6' />,
                      label: '优秀',
                      color: 'emerald',
                    },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type='button'
                      onClick={() => setFormData((prev) => ({ ...prev, mood_level: m.value }))}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                        formData.mood_level === m.value
                          ? `bg-${m.color}-500 text-white shadow-lg`
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {m.icon}
                      <span className='text-xs font-medium'>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  压力等级
                </label>
                <div className='flex items-center gap-2'>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type='button'
                      onClick={() => setFormData((prev) => ({ ...prev, stress_level: level }))}
                      className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                        formData.stress_level >= level
                          ? level <= 2
                            ? 'bg-emerald-500 text-white'
                            : level <= 3
                            ? 'bg-amber-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div className='flex justify-between text-xs text-slate-400 mt-1'>
                  <span>低</span>
                  <span>高</span>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  睡眠小时数 ({formData.sleep_hours}h)
                </label>
                <input
                  type='range'
                  min='0'
                  max='24'
                  step='0.5'
                  value={formData.sleep_hours}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sleep_hours: Number(e.target.value) }))
                  }
                  className='w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500'
                />
                <div className='flex justify-between text-xs text-slate-400 mt-1'>
                  <span>0h</span>
                  <span>12h</span>
                  <span>24h</span>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  备注
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder='添加备注（可选）'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none text-slate-800 dark:text-slate-100'
                />
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSubmit(handleSubmit);
              }}
              className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'
            >
              <button
                type='button'
                onClick={handleCloseForm}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                type='submit'
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '保存中...' : '保存记录'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
