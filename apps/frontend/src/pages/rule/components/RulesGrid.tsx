// T12-6 拆分（2026-09-12）：自 RuleSections.tsx 原样搬出，行为逐字节等价。
import { Filter, Sliders, Edit2, Trash2 } from 'lucide-react';
import { SearchFilter, Skeleton, EmptyState, PermissionButton } from '../../../components';
import type { RuleViewProps } from '../types';

export function RulesGrid({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
  filteredRules,
  rulesLoading,
  getCategoryColor,
  getCategoryName,
  setEditingRule,
  setFormData,
  openModal,
  handleDelete,
}: RuleViewProps) {
  return (
    <>
      <div className='card'>
        <div className='card-header flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div className='flex items-center gap-4'>
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder='搜索规则名称或描述...'
            />
            <div className='flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5'>
              <Filter className='w-5 h-5 text-gray-500' />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className='bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none cursor-pointer'
              >
                <option value=''>全部分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl'>
              <Sliders className='w-4 h-4 text-primary-600' />
              <span className='text-sm font-semibold text-primary-700'>
                {filteredRules.length} 条规则
              </span>
            </div>
          </div>
        </div>

        <div className='card-body'>
          {rulesLoading ? (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className='bg-white rounded-2xl border border-gray-100 p-5 animate-pulse'
                >
                  <div className='flex items-start gap-3 mb-4'>
                    <Skeleton variant='rectangular' className='w-10 h-10 rounded-xl' />
                    <div className='flex-1 space-y-2'>
                      <Skeleton variant='text' className='w-32 h-4' />
                      <Skeleton variant='text' className='w-20 h-3' />
                    </div>
                  </div>
                  <Skeleton variant='text' className='w-full h-3 mb-2' />
                  <Skeleton variant='text' className='w-3/4 h-3 mb-4' />
                  <div className='flex gap-2 mt-4'>
                    <Skeleton variant='rectangular' className='w-20 h-8 rounded-lg' />
                    <Skeleton variant='rectangular' className='w-20 h-8 rounded-lg' />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className='group relative bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden'
                >
                  <div
                    className='absolute left-0 top-0 bottom-0 w-1.5'
                    style={{ backgroundColor: getCategoryColor(rule.category_id) }}
                  />
                  <div className='p-5 pl-6'>
                    <div className='flex items-start justify-between mb-3'>
                      <div className='flex items-center gap-3'>
                        <div
                          className='w-10 h-10 rounded-xl flex items-center justify-center'
                          style={{ backgroundColor: `${getCategoryColor(rule.category_id)}20` }}
                        >
                          <span
                            className='text-lg'
                            style={{ color: getCategoryColor(rule.category_id) }}
                          >
                            {rule.score >= 0 ? '+' : ''}
                            {rule.score}
                          </span>
                        </div>
                        <div>
                          <h3 className='font-semibold text-gray-800 text-lg'>{rule.name}</h3>
                          <div className='flex items-center gap-2 mt-1'>
                            <span
                              className='text-xs font-medium px-2 py-0.5 rounded-full'
                              style={{
                                backgroundColor: `${getCategoryColor(rule.category_id)}20`,
                                color: getCategoryColor(rule.category_id),
                              }}
                            >
                              {getCategoryName(rule.category_id)}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                rule.is_active
                                  ? 'bg-success-100 text-success-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {rule.is_active ? '启用' : '禁用'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {rule.description && (
                      <p className='text-sm text-gray-500 mb-4 line-clamp-2'>{rule.description}</p>
                    )}

                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        {rule.daily_limit > 0 && (
                          <span className='text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg'>
                            每日{rule.daily_limit}次
                          </span>
                        )}
                        {rule.min_interval > 0 && (
                          <span className='text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg'>
                            间隔{rule.min_interval}秒
                          </span>
                        )}
                        {rule.score_min !== null && rule.score_min !== undefined && (
                          <span className='text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg'>
                            下限{rule.score_min}
                          </span>
                        )}
                        {rule.score_max !== null && rule.score_max !== undefined && (
                          <span className='text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg'>
                            上限{rule.score_max}
                          </span>
                        )}
                      </div>

                      <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                        <PermissionButton
                          permission='rule.manage'
                          onClick={() => {
                            setEditingRule(rule);
                            setFormData({
                              name: rule.name,
                              description: rule.description ?? '',
                              category_id: String(rule.category_id || ''),
                              score: rule.score,
                              is_active: rule.is_active,
                              daily_limit: rule.daily_limit,
                              min_interval: rule.min_interval,
                            });
                            openModal();
                          }}
                          className='p-2 hover:bg-warning-50 rounded-lg text-gray-400 hover:text-warning-500 transition-all'
                          title='编辑'
                        >
                          <Edit2 className='w-4 h-4' />
                        </PermissionButton>
                        {/* S1: rule.delete 后端无此码，统一 rule.manage */}
                        <PermissionButton
                          permission='rule.manage'
                          onClick={() => handleDelete(rule.id)}
                          className='p-2 hover:bg-danger-50 rounded-lg text-gray-400 hover:text-danger-500 transition-all'
                          title='删除'
                        >
                          <Trash2 className='w-4 h-4' />
                        </PermissionButton>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredRules.length === 0 && !rulesLoading && (
                <EmptyState
                  icon='file'
                  title='暂无规则数据'
                  description='添加规则开始配置积分系统'
                  actionLabel='添加规则'
                  onAction={() => openModal()}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
