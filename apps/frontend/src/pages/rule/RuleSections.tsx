import { ChangeEvent, FormEvent } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  X,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  Sliders,
  Info,
  Filter,
  LayoutTemplate,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { EmptyState, Skeleton, SearchFilter, Button, PermissionButton } from '../../components';
import type { Rule, Category, FormData, FormErrors, RuleTemplate } from '../RuleList';

export interface RuleViewProps {
  loadError: boolean;
  error: string | null;
  categories: Category[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  filteredRules: Rule[];
  rulesLoading: boolean;
  editingRule: Rule | null;
  setEditingRule: (r: Rule | null) => void;
  setFormData: (data: Partial<FormData>) => void;
  openModal: () => void;
  closeModal: () => void;
  showModal: boolean;
  openImportModal: () => void;
  closeImportModal: () => void;
  showImportModal: boolean;
  openTemplateModal: () => void;
  closeTemplateModal: () => void;
  showTemplateModal: boolean;
  templates: RuleTemplate[];
  formData: FormData;
  formErrors: FormErrors;
  setFormErrors: (e: FormErrors) => void;
  submitting: boolean;
  runSubmit: (fn: () => Promise<void>) => void;
  handleSubmit: (e?: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
  handleExport: () => Promise<void>;
  handleExportFile: (format: 'excel' | 'pdf') => Promise<void>;
  handleDownloadTemplate: () => Promise<void>;
  handleImport: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  importing: boolean;
  handleApplyTemplate: (templateId: string) => Promise<void>;
  applyingTemplate: boolean;
  fetchRules: () => Promise<void>;
  setError: (e: string | null) => void;
  getCategoryColor: (id: number | null) => string;
  getCategoryName: (id: number | null) => string;
}

export default function RuleView({
  loadError,
  error,
  categories,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  filteredRules,
  rulesLoading,
  editingRule,
  setEditingRule,
  setFormData,
  openModal,
  closeModal,
  showModal,
  openImportModal,
  closeImportModal,
  showImportModal,
  openTemplateModal,
  closeTemplateModal,
  showTemplateModal,
  templates,
  formData,
  formErrors,
  setFormErrors,
  submitting,
  runSubmit,
  handleSubmit,
  handleDelete,
  handleExport,
  handleExportFile,
  handleDownloadTemplate,
  handleImport,
  importing,
  handleApplyTemplate,
  applyingTemplate,
  fetchRules,
  setError,
  getCategoryColor,
  getCategoryName,
}: RuleViewProps) {
  return (
    <div className='max-w-7xl mx-auto'>
      {loadError && !error && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            分类/模板数据加载失败，部分功能可能不可用，请刷新重试
          </p>
        </div>
      )}
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30'>
            <Sliders className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='page-title'>积分规则</h2>
            <p className='page-subtitle'>管理积分规则的创建和配置</p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='outline' onClick={() => fetchRules()} disabled={rulesLoading}>
            <RefreshCw className={`w-4 h-4 ${rulesLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant='outline' onClick={handleDownloadTemplate}>
            <Download className='w-4 h-4' />
            下载模板
          </Button>
          <PermissionButton
            permission='rule.manage'
            variant='outline'
            onClick={() => openImportModal()}
          >
            <Upload className='w-4 h-4' />
            导入规则
          </PermissionButton>
          <PermissionButton
            permission='rule.manage'
            variant='outline'
            onClick={() => openTemplateModal()}
          >
            <LayoutTemplate className='w-4 h-4' />
            使用模板
          </PermissionButton>
          <Button variant='outline' onClick={handleExport}>
            <FileJson className='w-4 h-4' />
            导出JSON
          </Button>
          <Button variant='outline' onClick={() => handleExportFile('excel')}>
            <FileSpreadsheet className='w-4 h-4' />
            导出Excel
          </Button>
          <PermissionButton
            permission='rule.manage'
            onClick={() => {
              setEditingRule(null);
              openModal();
            }}
          >
            <Plus className='w-5 h-5 mr-2' />
            添加规则
          </PermissionButton>
        </div>
      </div>

      {error && (
        <div className='mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3'>
          <AlertCircle className='w-5 h-5' />
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              fetchRules();
            }}
            className='ml-auto text-danger-600 hover:text-danger-800'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>
      )}

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

      {showImportModal && (
        <div className='modal-overlay' onClick={closeImportModal}>
          <div className='modal-content max-w-2xl' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center'>
                  <Upload className='w-5 h-5 text-white' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>导入规则</h3>
                  <p className='text-xs text-gray-500'>从Excel文件导入积分规则</p>
                </div>
              </div>
              <button
                onClick={closeImportModal}
                className='p-2.5 hover:bg-gray-100 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <div className='modal-body'>
              <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6'>
                <div className='flex items-start gap-3'>
                  <Info className='w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5' />
                  <div>
                    <h4 className='font-medium text-blue-800'>导入说明</h4>
                    <ul className='text-sm text-blue-700 mt-2 space-y-1'>
                      <li>• 支持 Excel 格式文件（.xlsx, .xls）</li>
                      <li>
                        •
                        第一行必须为表头（规则名称、描述、分类名称、分数、是否启用、每日上限、最小间隔(秒)）
                      </li>
                      <li>• 如果分类名称不存在，将自动创建</li>
                      <li>• 如果规则名称已存在，将更新该规则</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-3'>选择导入文件</label>
                <div className='border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-500 transition-colors'>
                  <input
                    type='file'
                    accept='.xlsx,.xls'
                    onChange={handleImport}
                    className='hidden'
                    id='ruleImportFile'
                    disabled={importing}
                  />
                  <label htmlFor='ruleImportFile' className='cursor-pointer'>
                    <Upload className='w-12 h-12 text-gray-400 mx-auto mb-3' />
                    <p className='text-gray-600 font-medium'>
                      {importing ? '正在导入...' : '点击选择文件或拖拽到此处'}
                    </p>
                    <p className='text-sm text-gray-500 mt-1'>支持 .xlsx, .xls 格式</p>
                  </label>
                </div>
              </div>

              <div className='flex items-center justify-between pt-6 border-t border-gray-100'>
                <Button variant='ghost' onClick={handleDownloadTemplate}>
                  <Download className='w-4 h-4' />
                  下载导入模板
                </Button>
                <Button variant='outline' onClick={closeImportModal}>
                  关闭
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className='modal-overlay' onClick={closeTemplateModal}>
          <div className='modal-content max-w-3xl' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center'>
                  <LayoutTemplate className='w-5 h-5 text-white' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>选择规则模板</h3>
                  <p className='text-xs text-gray-500'>应用预设的积分规则模板，快速创建常用规则</p>
                </div>
              </div>
              <button
                onClick={closeTemplateModal}
                className='p-2.5 hover:bg-gray-100 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <div className='modal-body max-h-[60vh] overflow-y-auto'>
              <div className='grid gap-4'>
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className='border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer group'
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <h4 className='font-semibold text-gray-800 group-hover:text-primary-600 transition-colors'>
                          {template.name}
                        </h4>
                        <p className='text-sm text-gray-500 mt-1'>{template.description}</p>
                        <div className='mt-3 flex flex-wrap gap-2'>
                          {template.rules.slice(0, 4).map((rule, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                rule.score >= 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {rule.name}
                              <span className='ml-1'>
                                {rule.score >= 0 ? '+' : ''}
                                {rule.score}
                              </span>
                            </span>
                          ))}
                          {template.rules.length > 4 && (
                            <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600'>
                              +{template.rules.length - 4} 更多
                            </span>
                          )}
                        </div>
                      </div>
                      <div className='flex-shrink-0 ml-4'>
                        <Button
                          variant='primary'
                          size='sm'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyTemplate(template.id);
                          }}
                          disabled={applyingTemplate}
                        >
                          <Check className='w-4 h-4 mr-1' />
                          {applyingTemplate ? '应用中...' : '应用'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className='modal-footer'>
              <Button variant='outline' onClick={closeTemplateModal}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
