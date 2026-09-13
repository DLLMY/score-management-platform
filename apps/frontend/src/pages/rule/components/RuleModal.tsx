// T12-6 拆分（2026-09-12）：自 RuleSections.tsx 原样搬出，行为逐字节等价。
import { Edit2, Plus, X, AlertCircle } from 'lucide-react';
import { Button } from '../../../components';
import { ChangeEvent } from 'react';
import type { RuleViewProps } from '../types';

export function RuleModal({
  showModal,
  closeModal,
  editingRule,
  runSubmit,
  handleSubmit,
  formData,
  formErrors,
  setFormData,
  setFormErrors,
  categories,
  submitting,
}: RuleViewProps) {
  return (
    <>
      {showModal && (
        <div className='modal-overlay' onClick={closeModal}>
          <div className='modal-content max-w-lg' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center'>
                  {editingRule ? (
                    <Edit2 className='w-5 h-5 text-white' />
                  ) : (
                    <Plus className='w-5 h-5 text-white' />
                  )}
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>
                    {editingRule ? '编辑规则' : '添加新规则'}
                  </h3>
                  <p className='text-xs text-gray-500'>
                    {editingRule ? '修改规则的详细信息' : '创建新的积分规则'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className='p-2.5 hover:bg-gray-100 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSubmit(handleSubmit);
              }}
              className='modal-body'
            >
              <div className='form-group'>
                <label className='form-label'>
                  规则名称 <span className='text-danger-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) {
                      setFormErrors({ ...formErrors, name: undefined });
                    }
                  }}
                  className={`form-input ${
                    formErrors.name ? 'border-danger-300 focus:ring-danger-500' : ''
                  }`}
                  placeholder='请输入规则名称'
                />
                {formErrors.name && (
                  <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div className='form-group'>
                <label className='form-label'>分类</label>
                <select
                  value={formData.category_id}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                  className='form-select'
                >
                  <option value=''>请选择分类</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className='form-group'>
                <label className='form-label'>
                  积分值 <span className='text-danger-500'>*</span>
                </label>
                <input
                  type='number'
                  min='-1000'
                  max='1000'
                  value={formData.score}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const value = parseInt(e.target.value);
                    setFormData({ ...formData, score: isNaN(value) ? 0 : value });
                    if (formErrors.score) {
                      setFormErrors({ ...formErrors, score: undefined });
                    }
                  }}
                  className={`form-input ${
                    formErrors.score ? 'border-danger-300 focus:ring-danger-500' : ''
                  }`}
                  placeholder='正数为加分，负数为扣分'
                />
                {formErrors.score && (
                  <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.score}
                  </p>
                )}
              </div>

              <div className='form-group'>
                <label className='form-label'>规则描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) {
                      setFormErrors({ ...formErrors, description: undefined });
                    }
                  }}
                  className={`form-input resize-none ${
                    formErrors.description ? 'border-danger-300 focus:ring-danger-500' : ''
                  }`}
                  rows={3}
                  placeholder='请输入规则描述'
                />
                {formErrors.description && (
                  <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='form-group'>
                  <label className='form-label'>每日上限次数</label>
                  <input
                    type='number'
                    min='0'
                    value={formData.daily_limit}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setFormData({ ...formData, daily_limit: parseInt(e.target.value) || 0 });
                      if (formErrors.daily_limit) {
                        setFormErrors({ ...formErrors, daily_limit: undefined });
                      }
                    }}
                    className={`form-input ${
                      formErrors.daily_limit ? 'border-danger-300 focus:ring-danger-500' : ''
                    }`}
                    placeholder='0表示无限制'
                  />
                  {formErrors.daily_limit && (
                    <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                      <AlertCircle className='w-4 h-4' />
                      {formErrors.daily_limit}
                    </p>
                  )}
                </div>
                <div className='form-group'>
                  <label className='form-label'>最小间隔(分钟)</label>
                  <input
                    type='number'
                    min='0'
                    value={formData.min_interval}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setFormData({ ...formData, min_interval: parseInt(e.target.value) || 0 });
                      if (formErrors.min_interval) {
                        setFormErrors({ ...formErrors, min_interval: undefined });
                      }
                    }}
                    className={`form-input ${
                      formErrors.min_interval ? 'border-danger-300 focus:ring-danger-500' : ''
                    }`}
                    placeholder='0表示无限制'
                  />
                  {formErrors.min_interval && (
                    <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                      <AlertCircle className='w-4 h-4' />
                      {formErrors.min_interval}
                    </p>
                  )}
                </div>
              </div>

              <div className='form-group'>
                <label className='flex items-center gap-3 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={formData.is_active}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className='w-5 h-5 text-primary-600 rounded focus:ring-primary-500'
                  />
                  <span className='text-sm font-medium text-gray-700'>启用规则</span>
                </label>
              </div>

              <div className='modal-footer'>
                <Button variant='outline' onClick={closeModal}>
                  取消
                </Button>
                <Button type='submit' disabled={submitting}>
                  {editingRule ? '保存修改' : '添加规则'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
