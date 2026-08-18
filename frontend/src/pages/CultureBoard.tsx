import logger from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Flag,
  Award,
  FileText,
  Image,
  X,
  Check,
  ChevronUp,
  ChevronDown,
  Search,
  Loader2,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { CultureRecord, CultureCreateInput } from '../types';
import { ClassSelect } from '../components/form/EntitySelect';
import { ToggleSwitch } from '../components/form/ToggleSwitch';

interface CultureFormData {
  id: number | null;
  category: string;
  title: string;
  content: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
}

const defaultForm: CultureFormData = {
  id: null,
  category: '标语',
  title: '',
  content: '',
  image_url: '',
  display_order: 0,
  is_active: true,
};

const categoryIcons: Record<string, React.ReactNode> = {
  标语: <Flag className='w-5 h-5' />,
  规则: <FileText className='w-5 h-5' />,
  荣誉: <Award className='w-5 h-5' />,
  其他: <Sparkles className='w-5 h-5' />,
};

const categoryColors: Record<string, string> = {
  标语: 'from-blue-500 to-cyan-500',
  规则: 'from-amber-500 to-orange-500',
  荣誉: 'from-yellow-500 to-amber-500',
  其他: 'from-emerald-500 to-teal-500',
};

const categoryBg: Record<string, string> = {
  标语: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  规则: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  荣誉: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  其他: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
};

function CultureBoard() {
  const [records, setRecords] = useState<CultureRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<CultureFormData>(defaultForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { showToast } = useStableToast();

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.culture.getAll();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('获取班级文化记录失败:', error);
      showToast('error', '获取班级文化记录失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const categories = ['全部', '标语', '规则', '荣誉', '其他'];

  const filteredRecords = records
    .filter((r) => {
      const matchSearch =
        !searchTerm ||
        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = activeCategory === '全部' || r.category === activeCategory;
      // M5: 班级筛选联动（0 = 全部班级）
      const matchClass = selectedClassId === 0 || r.class_id === selectedClassId;
      return matchSearch && matchCategory && matchClass;
    })
    .sort((a, b) => a.display_order - b.display_order);

  const groupedRecords = categories.slice(1).reduce(
    (acc, cat) => {
      acc[cat] = filteredRecords.filter((r) => r.category === cat);
      return acc;
    },
    {} as Record<string, CultureRecord[]>
  );

  const handleOpenCreate = useCallback(() => {
    setFormData(defaultForm);
    setFormErrors({});
    setShowModal(true);
  }, []);

  const handleOpenEdit = useCallback((record: CultureRecord) => {
    setFormData({
      id: record.id,
      category: record.category || '标语',
      title: record.title || '',
      content: record.content || '',
      image_url: record.image_url || '',
      display_order: record.display_order,
      is_active: record.is_active,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultForm);
    setFormErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.content?.trim()) {
      errors.content = '内容不能为空';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (!formData.id && !selectedClassId) {
      showToast('error', '请先选择班级');
      return;
    }

    try {
      const payload: CultureCreateInput = {
        class_id: formData.id ? undefined : selectedClassId,
        category: formData.category || undefined,
        title: formData.title || undefined,
        content: formData.content,
        image_url: formData.image_url || undefined,
        display_order: formData.display_order,
      };

      if (formData.id) {
        await api.culture.update(formData.id, payload);
        showToast('success', '记录更新成功');
      } else {
        await api.culture.create(payload);
        showToast('success', '记录创建成功');
      }
      handleCloseModal();
      fetchRecords();
    } catch (error) {
      logger.error('保存记录失败:', error);
      showToast('error', formData.id ? '更新记录失败' : '创建记录失败');
    }
  }, [formData, validateForm, showToast, handleCloseModal, fetchRecords, selectedClassId]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!window.confirm('确定要删除这条记录吗？')) return;
      try {
        await api.culture.delete(id);
        showToast('success', '记录删除成功');
        fetchRecords();
      } catch (error) {
        logger.error('删除记录失败:', error);
        showToast('error', '删除记录失败');
      }
    },
    [showToast, fetchRecords]
  );

  const handleMoveOrder = useCallback(
    async (id: number, direction: 'up' | 'down') => {
      const record = records.find((r) => r.id === id);
      if (!record) return;

      const sortedRecords = [...records].sort((a, b) => a.display_order - b.display_order);
      const currentIndex = sortedRecords.findIndex((r) => r.id === id);
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (swapIndex < 0 || swapIndex >= sortedRecords.length) return;

      const swapRecord = sortedRecords[swapIndex];
      const newOrder = swapRecord.display_order;

      try {
        await api.culture.update(id, { display_order: newOrder });
        await api.culture.update(swapRecord.id, { display_order: record.display_order });
        showToast('success', '排序已更新');
        fetchRecords();
      } catch (error) {
        logger.error('更新排序失败:', error);
        showToast('error', '更新排序失败');
      }
    },
    [records, showToast, fetchRecords]
  );

  const handleChange = useCallback((field: keyof CultureFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const renderRecordCard = (record: CultureRecord, index: number) => (
    <div
      key={record.id}
      className='group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-4 hover:shadow-md transition-all duration-300'
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className='flex items-start justify-between mb-2'>
        <div className='flex items-center gap-3'>
          <div
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${categoryColors[record.category || '其他']} flex items-center justify-center shadow-md`}
          >
            {categoryIcons[record.category || '其他']}
          </div>
          {record.title && (
            <h4 className='font-semibold text-slate-800 dark:text-slate-100 line-clamp-1'>{record.title}</h4>
          )}
        </div>
        <div className='flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity'>
          <button
            onClick={() => handleMoveOrder(record.id, 'up')}
            className='p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
            title='上移'
          >
            <ChevronUp className='w-4 h-4' />
          </button>
          <button
            onClick={() => handleMoveOrder(record.id, 'down')}
            className='p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
            title='下移'
          >
            <ChevronDown className='w-4 h-4' />
          </button>
          <button
            onClick={() => handleOpenEdit(record)}
            className='p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all'
            title='编辑'
          >
            <Edit2 className='w-4 h-4' />
          </button>
          <button
            onClick={() => handleDelete(record.id)}
            className='p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
            title='删除'
          >
            <Trash2 className='w-4 h-4' />
          </button>
        </div>
      </div>

      {record.image_url && (
        <div className='mb-3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700'>
          <img src={record.image_url} alt={record.title || ''} className='w-full h-32 object-cover' />
        </div>
      )}

      {record.content && (
        <p className='text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-4'>
          {record.content}
        </p>
      )}

      <div className='mt-3 flex items-center gap-2'>
        <span className={`text-xs px-2 py-0.5 rounded-full ${categoryBg[record.category || '其他']}`}>
          {record.category || '未分类'}
        </span>
        {!record.is_active && (
          <span className='text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400'>
            已停用
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20'>
                <Sparkles className='w-6 h-6 text-white' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                班级文化
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级标语、班规、荣誉等文化记录
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenCreate}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Plus className='w-5 h-5' />
            新建记录
          </button>
        </div>
      </div>

      <div className='px-6 py-4 flex items-center gap-4 flex-wrap'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='搜索标题或内容...'
            className='w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm transition-all'
          />
        </div>
        <div className='flex items-center gap-2'>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-teal-500/20'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-emerald-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className='flex-1 px-6 pb-6 overflow-y-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='w-8 h-8 text-emerald-500 animate-spin' />
            <span className='ml-3 text-slate-500 dark:text-slate-400'>加载文化记录...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-slate-400'>
            <Sparkles className='w-16 h-16 mb-4 opacity-50' />
            <p className='text-lg'>暂无文化记录</p>
            <button
              onClick={handleOpenCreate}
              className='mt-4 text-emerald-500 hover:text-emerald-600 font-medium'
            >
              创建第一条记录
            </button>
          </div>
        ) : (
          <div className='space-y-6'>
            {categories.slice(1).map((cat) => {
              const catRecords = groupedRecords[cat] || [];
              if (activeCategory !== '全部' && activeCategory !== cat) return null;
              if (catRecords.length === 0 && activeCategory === '全部') return null;

              return (
                <div key={cat}>
                  <div className='flex items-center gap-2 mb-3'>
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${categoryColors[cat]} flex items-center justify-center text-white`}
                    >
                      {categoryIcons[cat]}
                    </div>
                    <h3 className='text-lg font-semibold text-slate-800 dark:text-slate-100'>{cat}</h3>
                    <span className='text-sm text-slate-400'>({catRecords.length})</span>
                  </div>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {catRecords.map((record, idx) => renderRecordCard(record, idx))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={handleCloseModal}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                    <Sparkles className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑文化记录' : '创建文化记录'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
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
                {formData.id && (
                  <p className='mt-1 text-xs text-slate-400'>编辑时班级不可更改</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>分类</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                >
                  <option value='标语'>标语</option>
                  <option value='规则'>规则</option>
                  <option value='荣誉'>荣誉</option>
                  <option value='其他'>其他</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>标题</label>
                <input
                  type='text'
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder='输入标题（可选）'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  内容 <span className='text-red-500'>*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  placeholder='输入内容'
                  rows={4}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 ${
                    formErrors.content ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-emerald-500'
                  }`}
                />
                {formErrors.content && <p className='mt-1 text-xs text-red-500'>{formErrors.content}</p>}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  图片链接（可选）
                </label>
                <div className='relative'>
                  <Image className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                  <input
                    type='text'
                    value={formData.image_url}
                    onChange={(e) => handleChange('image_url', e.target.value)}
                    placeholder='输入图片 URL'
                    className='w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>排序</label>
                <input
                  type='number'
                  value={formData.display_order}
                  onChange={(e) => handleChange('display_order', Number(e.target.value))}
                  placeholder='显示顺序'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>启用状态</label>
                <ToggleSwitch
                  checked={formData.is_active}
                  onChange={(v) => handleChange('is_active', v)}
                  activeClass='bg-gradient-to-r from-emerald-500 to-teal-500'
                />
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-200 font-medium'
              >
                <Check className='w-5 h-5' />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CultureBoard;