import { useState, useMemo, useRef, FormEvent } from 'react';
import api, { Category } from '../services/api';
import {
  useForm,
  useModal,
  useListData,
  useSubmitGuard,
  useStableToast,
  useDebouncedValue,
} from '../hooks';
import { validateForm } from '../utils/validation';
import { useConfirm } from '../components';
import CategoryListView from './categoryList/CategoryListView';
import { COLORS } from './categoryList/types';
import type { FormData, FormErrors } from './categoryList/types';

/**
 * 分类管理（逻辑层）：列表加载、搜索派生、表单与提交。
 * 视图见 ./categoryList/CategoryListView。
 */
function CategoryList() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const {
    data: categories,
    loading: isLoading,
    error,
    refetch: fetchCategories,
  } = useListData<Category>({ fetcher: () => api.scoreCategories.getAll(), debounceDelay: 0 });
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();

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

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>): Promise<void> => {
    e?.preventDefault();

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
    const ok = await confirmRef.current({
      message: '确定要删除该分类吗？此操作不可撤销。',
      confirmText: '确定',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await api.scoreCategories.delete(id);
      showToast('success', '删除成功');
      fetchCategories();
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
    <CategoryListView
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      isLoading={isLoading}
      error={error}
      fetchCategories={fetchCategories}
      filteredCategories={filteredCategories}
      openModal={openModal}
      closeModal={closeModal}
      editingCategory={editingCategory}
      setEditingCategory={setEditingCategory}
      setFormData={setFormData}
      formData={formData}
      formErrors={formErrors}
      setFormErrors={setFormErrors}
      handleDelete={handleDelete}
      runSubmit={runSubmit}
      handleSubmit={handleSubmit}
      submitting={submitting}
      showModal={showModal}
    />
  );
}

export default CategoryList;
