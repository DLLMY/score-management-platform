import { useState, useEffect, useCallback, useMemo, FormEvent, ChangeEvent } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, X, RefreshCw, Tag, Palette } from 'lucide-react';
import api, { Category } from '../services/api';
import { useForm, useModal, useConfirmDialog } from '../hooks';
import { useStableToast } from '../hooks/useStableToast';
import { validateForm } from '../utils/validation';
import { EmptyState, CategoryCardSkeleton, Button, PermissionButton } from '../components';
import { ToggleSwitch } from '../components/form/ToggleSwitch';
import ImportExportPanel from '../components/special/ImportExportPanel';
import { useDebouncedValue } from '../hooks';

interface FormData {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface FormErrors {
  name?: string;
  description?: string;
  [key: string]: string | undefined;
}

const COLORS: string[] = [
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useStableToast();
  useConfirmDialog();

  const {
    formData,
    setFormData,
    resetForm,
    errors: formErrors,
    setErrors: setFormErrors,
  } = useForm<FormData>(
    {
      name: '',
      description: '',
      color: COLORS[0],
      is_active: true,
    },
    {
      name: { required: true, maxLength: 50 },
      description: { maxLength: 200 },
    }
  );

  const {
    isOpen: showModal,
    open: openModal,
    close: closeModal,
  } = useModal<Category | null>({
    onClose: () => {
      resetForm();
      setEditingCategory(null);
    },
  });

  const validationRules = {
    name: ['required', { maxLength: 50 }],
    description: [{ maxLength: 200 }],
  };

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const fetchCategories = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.scoreCategories.getAll();
      setCategories(data);
    } catch (err: unknown) {
      setError('获取分类列表失败: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const { isValid, errors } = validateForm(formData, validationRules);

    if (!isValid) {
      setFormErrors(errors as FormErrors);
      return;
    }

    setFormErrors({});

    try {
      if (editingCategory) {
        await api.scoreCategories.update(editingCategory.id, formData);
        showToast('success', '分类更新成功');
        // 后端仅返回 message（解包为 null）或 {category}；统一重新拉取列表，避免列表项被替换为 null
        fetchCategories();
      } else {
        await api.scoreCategories.create(formData);
        showToast('success', '分类添加成功');
        fetchCategories();
      }
      closeModal();
    } catch (err: unknown) {
      showToast('error', '操作失败: ' + (err as Error).message);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('确定要删除该分类吗？此操作不可撤销。')) return;

    try {
      await api.scoreCategories.delete(id);
      showToast('success', '删除成功');

      setCategories((prevCategories) => prevCategories.filter((cat) => cat.id !== id));
    } catch (err: unknown) {
      showToast('error', '删除失败: ' + (err as Error).message);
    }
  };

  const filteredCategories = useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase();
    return categories.filter(
      (cat: Category) =>
        cat.name.toLowerCase().includes(searchLower) ||
        cat.description.toLowerCase().includes(searchLower)
    );
  }, [categories, debouncedSearchTerm]);

  return (
    <div className='max-w-6xl mx-auto'>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30'>
            <Tag className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='page-title'>分类管理</h2>
            <p className='page-subtitle'>管理积分规则的分类体系</p>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => fetchCategories()}
            className='btn btn-outline flex items-center gap-2'
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <div className='hidden md:block'>
            <ImportExportPanel
              type='category'
              onImportComplete={() => fetchCategories()}
              permissions={{
                import: 'category.manage',
                export: 'category.manage',
                template: 'category.manage',
              }}
            />
          </div>
          <button
            onClick={() => {
              setEditingCategory(null);
              openModal();
            }}
            className='btn btn-primary shadow-lg hover:shadow-xl transition-all'
          >
            <Plus className='w-5 h-5 mr-2' />
            添加分类
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3'>
          <AlertCircle className='w-5 h-5' />
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              fetchCategories();
            }}
            className='ml-auto text-danger-600 hover:text-danger-800'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>
      )}

      <div className='card'>
        <div className='card-header flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div className='relative'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
            <input
              type='text'
              placeholder='搜索分类名称或描述...'
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className='form-input pl-12 w-72'
            />
          </div>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl'>
              <Tag className='w-4 h-4 text-primary-600' />
              <span className='text-sm font-semibold text-primary-700'>
                {filteredCategories.length} 个分类
              </span>
            </div>
          </div>
        </div>

        <div className='card-body'>
          {isLoading ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {Array.from({ length: 8 }).map((_, i: number) => (
                <CategoryCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {filteredCategories.map((cat: Category) => (
                <div
                  key={cat.id}
                  className='card card-hover p-5 border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1'
                  style={{ borderColor: `${cat.color}33` }}
                >
                  <div className='flex items-start justify-between mb-4'>
                    <div className='flex items-center gap-3'>
                      <div
                        className='w-12 h-12 rounded-xl flex items-center justify-center shadow-lg'
                        style={{ backgroundColor: `${cat.color}20` }}
                      >
                        <Tag className='w-6 h-6' style={{ color: cat.color }} />
                      </div>
                      <div>
                        <h3 className='text-lg font-semibold text-gray-800'>{cat.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            cat.is_active
                              ? 'bg-success-100 text-success-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {cat.is_active ? '启用' : '禁用'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className='text-sm text-gray-600 mb-4'>{cat.description || '暂无描述'}</p>

                  <div className='flex items-center justify-between pt-4 border-t border-gray-100'>
                    <div className='flex items-center gap-2'>
                      <Palette className='w-4 h-4 text-gray-500' />
                      <div className='flex gap-1'>
                        <div
                          className='w-4 h-4 rounded-full border-2 border-white shadow-sm'
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className='text-xs text-gray-500 font-mono'>{cat.color}</span>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setFormData({
                            name: cat.name,
                            description: cat.description,
                            color: cat.color,
                            is_active: cat.is_active,
                          });
                          openModal();
                        }}
                        className='btn-icon text-warning-500 hover:bg-warning-50 hover:text-warning-600'
                      >
                        <Edit2 className='w-5 h-5' />
                      </button>
                      <PermissionButton
                        permission='rule.manage'
                        onClick={() => handleDelete(cat.id)}
                        className='btn-icon text-danger-500 hover:bg-danger-50 hover:text-danger-600'
                      >
                        <Trash2 className='w-5 h-5' />
                      </PermissionButton>
                    </div>
                  </div>
                </div>
              ))}

              {filteredCategories.length === 0 && !isLoading && (
                <div className='col-span-full'>
                  <EmptyState
                    icon='folder'
                    title='暂无分类数据'
                    description='添加分类开始组织积分规则'
                    actionLabel='添加分类'
                    onAction={() => openModal()}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className='modal-overlay' onClick={closeModal}>
          <div className='modal-content max-w-md' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center'>
                  {editingCategory ? (
                    <Edit2 className='w-5 h-5 text-white' />
                  ) : (
                    <Plus className='w-5 h-5 text-white' />
                  )}
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>
                    {editingCategory ? '编辑分类' : '添加新分类'}
                  </h3>
                  <p className='text-xs text-gray-500'>
                    {editingCategory ? '修改分类的详细信息' : '创建新的分类'}
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
            <form onSubmit={handleSubmit} className='modal-body'>
              <div className='form-group'>
                <label className='form-label'>
                  分类名称 <span className='text-danger-500'>*</span>
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
                  placeholder='请输入分类名称'
                />
                {formErrors.name && (
                  <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div className='form-group'>
                <label className='form-label'>分类描述</label>
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
                  placeholder='请输入分类描述'
                />
                {formErrors.description && (
                  <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className='form-group'>
                <label className='form-label'>颜色标识</label>
                <div className='flex items-center gap-3'>
                  <div className='flex flex-wrap gap-2'>
                    {COLORS.map((color: string) => (
                      <button
                        key={color}
                        type='button'
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                          formData.color === color
                            ? 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                            : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    type='text'
                    value={formData.color}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className='form-input w-32 font-mono text-sm'
                    placeholder='#3B82F6'
                  />
                </div>
              </div>

              <div className='form-group'>
                <div className='flex items-center justify-between'>
                  <label className='text-sm font-medium text-gray-700'>启用分类</label>
                  <ToggleSwitch
                    checked={formData.is_active}
                    onChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                </div>
              </div>

              <div className='modal-footer'>
                <Button variant='outline' onClick={closeModal}>
                  取消
                </Button>
                <Button type='submit'>{editingCategory ? '保存修改' : '添加分类'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryList;
